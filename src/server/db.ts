import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

// Levenshtein distance implementation for STT error recovery (e.g. "Presto" -> "Pesto Pasta")
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bLower.length][aLower.length];
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  db = new SQL.Database();

  // Create tables according to exact schema specified in prompt
  db.run(`
    CREATE TABLE tables (
      table_id INTEGER PRIMARY KEY,
      capacity INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE menu_items (
      item_id INTEGER PRIMARY KEY,
      dish_name TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      verified_allergens TEXT,
      allergen_status TEXT CHECK(allergen_status IN ('VERIFIED', 'UNVERIFIED'))
    );

    CREATE TABLE reservations (
      reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      reservation_time TEXT NOT NULL,
      status TEXT DEFAULT 'CONFIRMED'
    );
  `);

  // Seed default restaurant state
  seedDatabase(db);
  return db;
}

export function seedDatabase(database: Database) {
  // Clear any existing data
  database.run('DELETE FROM reservations;');
  database.run('DELETE FROM menu_items;');
  database.run('DELETE FROM tables;');

  // Tables: 2-seaters, 4-seaters, 6-seaters, 8-seaters
  const tables = [
    [1, 2, 1],
    [2, 2, 1],
    [3, 4, 1],
    [4, 4, 1],
    [5, 6, 1],
    [6, 8, 1],
  ];
  for (const t of tables) {
    database.run('INSERT INTO tables (table_id, capacity, is_active) VALUES (?, ?, ?);', t);
  }

  // Menu items: Note deliberate UNVERIFIED and NULL items for Fail-Closed safety tests
  const menu = [
    [1, 'Pesto Pasta', 'Trofie pasta, Genovese basil, pine nuts, garlic, Parmigiano Reggiano, extra virgin olive oil', 'nuts, dairy, gluten', 'VERIFIED'],
    [2, 'Margherita Pizza', 'San Marzano tomatoes, fresh mozzarella, fresh basil, extra virgin olive oil, wheat crust', 'dairy, gluten', 'VERIFIED'],
    [3, 'Tiramisu', 'Mascarpone cheese, eggs, savoiardi ladyfingers, espresso, cocoa, marsala wine', 'dairy, eggs, gluten', 'VERIFIED'],
    [4, 'Spaghetti Bolognese', 'Spaghetti pasta, slow-braised beef and veal ragù, San Marzano tomatoes, mirepoix, red wine', 'gluten, celery', 'VERIFIED'],
    [5, 'Truffle Mushroom Risotto', 'Carnaroli rice, black winter truffle carpaccio, porcini mushrooms, butter, stock', 'dairy', 'UNVERIFIED'], // Guardrail target!
    [6, "Chef's Special Lobster Tagliolini", 'Fresh Mediterranean lobster, squid-ink egg pasta, cherry tomatoes, white wine, chili', null, 'UNVERIFIED'], // Guardrail target!
    [7, 'Caprese Salad', 'Buffalo mozzarella, heirloom tomatoes, fresh basil, 12-year balsamic vinegar, olive oil', 'dairy', 'VERIFIED'],
    [8, 'Crostini Della Casa', 'Artisan toasted sourdough bread, chicken liver pâté, rosemary, sage', 'gluten', 'VERIFIED']
  ];

  for (const m of menu) {
    database.run('INSERT INTO menu_items (item_id, dish_name, ingredients, verified_allergens, allergen_status) VALUES (?, ?, ?, ?, ?);', m);
  }

  // Pre-seed conflict reservations for today at 19:30 for all tables >= 4 (to test slot clash & alternative suggestion)
  const todayStr = new Date().toISOString().split('T')[0];
  database.run(`
    INSERT INTO reservations (customer_name, party_size, reservation_time, status)
    VALUES 
      ('Marco Rossi', 4, '${todayStr} 19:30', 'CONFIRMED'),
      ('Elena Bianchi', 4, '${todayStr} 19:30', 'CONFIRMED'),
      ('Antonio Conte', 6, '${todayStr} 19:30', 'CONFIRMED'),
      ('Giovanni Bellini', 8, '${todayStr} 19:30', 'CONFIRMED'),
      ('David Miller', 2, '${todayStr} 20:00', 'CONFIRMED');
  `);
}

// Tool 1: check_table_availability
export async function checkTableAvailability(partySize: number, bookingTime: string): Promise<{
  available: boolean;
  table_id?: number;
  capacity?: number;
  suggested_alternative?: string;
  reason?: string;
}> {
  const database = await getDatabase();
  
  // Standardize time formatting
  const normalizedTime = normalizeDateTime(bookingTime);

  // 1. Find all active tables that can seat this party size
  const tableStmt = database.prepare('SELECT table_id, capacity FROM tables WHERE is_active = 1 AND capacity >= ? ORDER BY capacity ASC');
  tableStmt.bind([partySize]);

  const candidateTables: { table_id: number; capacity: number }[] = [];
  while (tableStmt.step()) {
    const row = tableStmt.getAsObject();
    candidateTables.push({ table_id: Number(row.table_id), capacity: Number(row.capacity) });
  }
  tableStmt.free();

  if (candidateTables.length === 0) {
    return {
      available: false,
      reason: `Trattoria Bella has a maximum table capacity of 8. For parties larger than 8, please call our events desk directly.`
    };
  }

  // Check which tables are free at this exact time (standard dining duration: 90 mins window)
  const resStmt = database.prepare(`
    SELECT reservation_id, party_size, reservation_time 
    FROM reservations 
    WHERE status = 'CONFIRMED' AND reservation_time = ?
  `);
  resStmt.bind([normalizedTime]);

  const bookedReservations: { party_size: number }[] = [];
  while (resStmt.step()) {
    const r = resStmt.getAsObject();
    bookedReservations.push({ party_size: Number(r.party_size) });
  }
  resStmt.free();

  // Count how many matching capacity tables exist vs already booked
  const availableTables = candidateTables.length - bookedReservations.filter(r => r.party_size >= partySize).length;

  if (availableTables > 0) {
    const chosenTable = candidateTables[0];
    return {
      available: true,
      table_id: chosenTable.table_id,
      capacity: chosenTable.capacity
    };
  }

  // Slot conflict! Suggest closest alternative time slot (+30 mins or +60 mins)
  const suggested = calculateAlternativeSlot(normalizedTime);
  return {
    available: false,
    suggested_alternative: suggested,
    reason: `All tables for ${partySize} are booked at ${extractTime(normalizedTime)}. Alternative slot available at ${suggested}.`
  };
}

// Tool 2: get_allergen_info with STT fuzzy matching (Levenshtein distance)
export async function getAllergenInfo(dishName: string): Promise<{
  dish: string;
  matched_dish?: string;
  ingredients?: string;
  contains: string[];
  status: 'VERIFIED' | 'UNVERIFIED' | 'NOT_FOUND';
  fuzzy_corrected?: boolean;
}> {
  const database = await getDatabase();
  const trimmed = dishName.trim();

  // Fetch all menu items
  const stmt = database.prepare('SELECT dish_name, ingredients, verified_allergens, allergen_status FROM menu_items');
  const items: any[] = [];
  while (stmt.step()) {
    items.push(stmt.getAsObject());
  }
  stmt.free();

  // 1. Direct or substring match
  let matched = items.find(item => 
    item.dish_name.toLowerCase().includes(trimmed.toLowerCase()) || 
    trimmed.toLowerCase().includes(item.dish_name.toLowerCase())
  );

  let fuzzyCorrected = false;

  // 2. Fuzzy match using Levenshtein distance (for STT transcription errors like "Presto" -> "Pesto Pasta")
  if (!matched) {
    let lowestDist = Infinity;
    let closestItem: any = null;

    for (const item of items) {
      const dist = levenshteinDistance(trimmed, item.dish_name);
      // Also test with single words (e.g. "Presto" vs "Pesto")
      const words = item.dish_name.split(' ');
      let wordDist = Infinity;
      for (const w of words) {
        const d = levenshteinDistance(trimmed, w);
        if (d < wordDist) wordDist = d;
      }

      const effectiveDist = Math.min(dist, wordDist);
      if (effectiveDist < lowestDist) {
        lowestDist = effectiveDist;
        closestItem = item;
      }
    }

    // Distance threshold: allows for common STT phonetic variations
    if (lowestDist <= 3 && closestItem) {
      matched = closestItem;
      fuzzyCorrected = true;
    }
  }

  if (!matched) {
    return {
      dish: dishName,
      contains: [],
      status: 'NOT_FOUND'
    };
  }

  const allergenList = matched.verified_allergens 
    ? (matched.verified_allergens as string).split(',').map((s: string) => s.trim())
    : [];

  return {
    dish: dishName,
    matched_dish: matched.dish_name,
    ingredients: matched.ingredients,
    contains: allergenList,
    status: matched.allergen_status as 'VERIFIED' | 'UNVERIFIED',
    fuzzy_corrected: fuzzyCorrected
  };
}

// Tool 3: create_reservation
export async function createReservation(
  customerName: string,
  partySize: number,
  bookingTime: string
): Promise<{
  booking_id: string;
  status: 'SUCCESS' | 'FAILED';
  customer_name: string;
  party_size: number;
  booking_time: string;
  message: string;
}> {
  const database = await getDatabase();
  const normalizedTime = normalizeDateTime(bookingTime);

  // First verify availability to avoid double-booking
  const avail = await checkTableAvailability(partySize, normalizedTime);
  if (!avail.available) {
    return {
      booking_id: '',
      status: 'FAILED',
      customer_name: customerName,
      party_size: partySize,
      booking_time: normalizedTime,
      message: `Cannot book: ${avail.reason}`
    };
  }

  const bookingId = `RES-${Math.floor(1000 + Math.random() * 9000)}`;
  
  database.run(
    'INSERT INTO reservations (customer_name, party_size, reservation_time, status) VALUES (?, ?, ?, ?);',
    [customerName, partySize, normalizedTime, 'CONFIRMED']
  );

  return {
    booking_id: bookingId,
    status: 'SUCCESS',
    customer_name: customerName,
    party_size: partySize,
    booking_time: normalizedTime,
    message: `Table confirmed for ${partySize} under ${customerName} at ${extractTime(normalizedTime)}.`
  };
}

// Helper: Normalize date/time string to 'YYYY-MM-DD HH:MM'
export function normalizeDateTime(input: string): string {
  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];

  // If already in 'YYYY-MM-DD HH:MM' format
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input)) {
    return input;
  }

  // Handle common natural time expressions (e.g., "7:00 PM", "19:00", "7:30", "tomorrow at 8:00")
  let targetDate = todayDateStr;
  if (/tomorrow/i.test(input)) {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    targetDate = tmr.toISOString().split('T')[0];
  }

  // Extract hours and minutes
  const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3]?.toLowerCase();

    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    // Default evening assumptions for restaurant reservations if < 12 and no AM/PM specified
    if (!period && hour >= 1 && hour <= 11) {
      if (hour >= 5 && hour <= 11) hour += 12; // 7 -> 19
    }

    const hourStr = hour.toString().padStart(2, '0');
    const minStr = minute.toString().padStart(2, '0');
    return `${targetDate} ${hourStr}:${minStr}`;
  }

  return `${todayDateStr} 19:00`;
}

export function extractTime(dateTimeStr: string): string {
  const parts = dateTimeStr.split(' ');
  return parts[1] || dateTimeStr;
}

function calculateAlternativeSlot(dateTimeStr: string): string {
  const [date, time] = dateTimeStr.split(' ');
  const [h, m] = (time || '19:00').split(':').map(Number);
  
  // Suggest +30 minutes
  let newM = m + 30;
  let newH = h;
  if (newM >= 60) {
    newM -= 60;
    newH += 1;
  }
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}
