import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { runOrchestratorTurn } from './src/server/orchestrator.js';
import { getDatabase, seedDatabase } from './src/server/db.js';
import { runFullBenchmark } from './src/server/benchmark.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

const rawApiKey = process.env.GEMINI_API_KEY;
const isValidKey = Boolean(rawApiKey && rawApiKey !== 'MY_GEMINI_API_KEY' && rawApiKey.trim().length > 10);
const ai = isValidKey ? new GoogleGenAI({
  apiKey: rawApiKey!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

// Initialize SQLite database
getDatabase().then(() => {
  console.log('✓ SQLite database initialized with tables, menu items, and reservations');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// 1. Voice Agent Turn Endpoint (STT Text -> Orchestrator & Multi-Tool Router -> Spoken Text)
app.post('/api/chat', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text prompt is required.' });
    }

    const response = await runOrchestratorTurn(text);
    res.json(response);
  } catch (err: any) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ 
      error: 'Our voice system encountered a temporary error. Please try again or speak with restaurant reception.' 
    });
  }
});

// 2. Gemini Flash Lite TTS Endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    if (!ai) {
      // Instruct client to use native browser SpeechSynthesis
      return res.json({ fallbackWebSpeech: true, reason: 'Gemini API key not configured' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 300), // Keep concise as per Sophia phone persona
              speechMetadata: {
                style: 'Warm, natural Italian restaurant concierge, articulate and polite'
              }
            }
          ]
        }
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' } // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({
        fallbackWebSpeech: false,
        audioBase64: base64Audio,
        format: 'audio/wav'
      });
    }

    return res.json({ fallbackWebSpeech: true });
  } catch (err: any) {
    console.warn('TTS error (falling back to Web Speech):', err.message);
    res.json({ fallbackWebSpeech: true, error: err.message });
  }
});

// 3. Database State Inspector Endpoint
app.get('/api/db/state', async (_req, res) => {
  try {
    const db = await getDatabase();
    
    // Fetch tables
    const tablesStmt = db.prepare('SELECT * FROM tables ORDER BY table_id ASC');
    const tables: any[] = [];
    while (tablesStmt.step()) tables.push(tablesStmt.getAsObject());
    tablesStmt.free();

    // Fetch menu items
    const menuStmt = db.prepare('SELECT * FROM menu_items ORDER BY item_id ASC');
    const menuItems: any[] = [];
    while (menuStmt.step()) menuItems.push(menuStmt.getAsObject());
    menuStmt.free();

    // Fetch reservations
    const resStmt = db.prepare('SELECT * FROM reservations ORDER BY reservation_id DESC');
    const reservations: any[] = [];
    while (resStmt.step()) reservations.push(resStmt.getAsObject());
    resStmt.free();

    res.json({ tables, menuItems, reservations });
  } catch (err: any) {
    console.error('Error in /api/db/state:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Reset Database
app.post('/api/db/reset', async (_req, res) => {
  try {
    const db = await getDatabase();
    seedDatabase(db);
    res.json({ success: true, message: 'Database reset to default Trattoria Bella seed state.' });
  } catch (err: any) {
    console.error('Error resetting database:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Raw SQL Query execution (for developer console inspection)
app.post('/api/db/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'SQL statement is required.' });
    }

    const db = await getDatabase();
    const trimmed = sql.trim();

    if (trimmed.toLowerCase().startsWith('select')) {
      const stmt = db.prepare(trimmed);
      const rows: any[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return res.json({ success: true, rows, count: rows.length });
    }

    // Run DDL / DML
    db.run(trimmed);
    res.json({ success: true, message: 'SQL executed successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Automated Benchmark Suite
app.post('/api/benchmark/run', async (_req, res) => {
  try {
    const report = await runFullBenchmark();
    res.json(report);
  } catch (err: any) {
    console.error('Error running benchmark:', err);
    res.status(500).json({ error: err.message });
  }
});

// Full-stack Vite middleware integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const path = await import('path');
    const staticPath = path.resolve('dist');
    app.use(express.static(staticPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (dev: ${!isProd})`);
  });
}

startServer();
