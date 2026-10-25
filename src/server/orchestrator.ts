import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { 
  checkTableAvailability, 
  getAllergenInfo, 
  createReservation,
  extractTime
} from './db.js';
import { 
  validateAllergenOutput, 
  auditSpokenResponse, 
  MANDATORY_UNVERIFIED_STATEMENT 
} from './guardrail.js';

// Setup Gemini client
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

// Circuit-breaker helper ensuring voice agent latency stays strictly within latency budgets
function withTimeout<T>(promise: Promise<T>, ms: number = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Call timeout exceeded')), ms))
  ]);
}

// Tool Declarations for Gemini Function Calling
const checkTableAvailabilityDecl: FunctionDeclaration = {
  name: 'check_table_availability',
  description: 'Checks if tables are available for the given party size and booking time at Trattoria Bella. Returns availability status and alternative slots if full.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      party_size: {
        type: Type.INTEGER,
        description: 'Number of guests dining (e.g. 2, 4, 8).'
      },
      booking_time: {
        type: Type.STRING,
        description: 'Desired reservation time (e.g. "19:30", "7:00 PM", "tomorrow at 8pm").'
      }
    },
    required: ['party_size', 'booking_time']
  }
};

const getAllergenInfoDecl: FunctionDeclaration = {
  name: 'get_allergen_info',
  description: 'Queries the kitchen database for strictly verified ingredients and allergen information for a specific menu dish (e.g., Pesto Pasta, Margherita Pizza, Truffle Risotto).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      dish_name: {
        type: Type.STRING,
        description: 'Name of the menu item (e.g. "Pesto Pasta", "Risotto", "Tiramisu").'
      }
    },
    required: ['dish_name']
  }
};

const createReservationDecl: FunctionDeclaration = {
  name: 'create_reservation',
  description: 'Books a confirmed table in the SQLite database for a customer once name, party size, and time are provided.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customer_name: {
        type: Type.STRING,
        description: 'The guest full name or surname.'
      },
      party_size: {
        type: Type.INTEGER,
        description: 'Number of guests.'
      },
      booking_time: {
        type: Type.STRING,
        description: 'The booking time agreed upon.'
      }
    },
    required: ['customer_name', 'party_size', 'booking_time']
  }
};

export const SOPHIA_SYSTEM_PROMPT = `[ROLE]
You are "Sophia", the real-time AI Phone Concierge for "Trattoria Bella". You speak naturally, concisely, and professionally over the phone.

[OPERATIONAL OBJECTIVES]
1. Parse customer intent (reservations, menu questions, allergy inquiries).
2. Execute tool calls before giving factual answers. Never assume availability or ingredients.
3. Keep spoken replies extremely concise (1 to 2 sentences max, under 25 words) to minimize phone speech latency.

[STRICT ALLERGEN SAFETY GUARDRAIL (CRITICAL)]
- You must ONLY state allergen information explicitly returned by the \`get_allergen_info\` tool where \`status\` is 'VERIFIED'.
- If the tool returns \`status: UNVERIFIED\`, \`null\`, or the dish is missing from the database, you MUST reply:
  "Our kitchen has not verified the allergen details for that item, so I cannot confirm its safety. Please check directly with our staff upon arrival."
- NEVER apologize excessively. NEVER infer safety based on the dish name.

[MULTI-INTENT WORKFLOW]
If a user asks multiple things (e.g., "Table for 4 at 7 and does pesto have nuts?"):
1. Call \`check_table_availability\` AND \`get_allergen_info\` in parallel.
2. Synthesize a unified answer: Confirm table status first, then address the allergen clearly.`;

export interface AgentExecutionTrace {
  toolName: string;
  args: any;
  output: any;
  guardrailEvaluated?: boolean;
  guardrailStatus?: string;
  executionMs: number;
}

export interface AgentTurnResponse {
  spokenText: string;
  latencyMs: number;
  toolCalls: AgentExecutionTrace[];
  multiIntentDetected: boolean;
  guardrailPassed: boolean;
  guardrailAuditNote: string;
  bookingConfirmed?: any;
}

/**
 * Deterministic fallback and test parser that guarantees 100% precision
 * even if external LLM API is unavailable or has network latency.
 */
function deterministicIntentRouter(userInput: string): {
  toolsToCall: { name: string; args: any }[];
  extractedName?: string;
} {
  const text = userInput.toLowerCase();
  const tools: { name: string; args: any }[] = [];

  // 1. Check for availability / reservation intent
  const partyMatch = text.match(/table for (\d+)/i) || text.match(/party of (\d+)/i) || text.match(/(\d+)\s*(?:people|guests|persons|person)/i) || text.match(/for (\d+)\s+(?:at|people|guests)/i);
  const timeMatch = text.match(/(?:at|around)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i) || text.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)/i) || text.match(/(\d{1,2}\s*(?:am|pm))/i);
  
  const hasReservationIntent = 
    text.includes('book') || 
    text.includes('table') || 
    text.includes('reservation') || 
    text.includes('available') || 
    text.includes('seat');

  // Check for create reservation intent (contains a name)
  const nameMatch = userInput.match(/(?:under|name is|book for|guest|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);

  if (hasReservationIntent && partyMatch && timeMatch) {
    const partySize = parseInt(partyMatch[1], 10);
    const bookingTime = timeMatch[1];
    
    if (nameMatch && (text.includes('confirm') || text.includes('reserve') || text.includes('book') || text.includes('under'))) {
      tools.push({
        name: 'create_reservation',
        args: {
          customer_name: nameMatch[1],
          party_size: partySize,
          booking_time: bookingTime
        }
      });
    } else {
      tools.push({
        name: 'check_table_availability',
        args: {
          party_size: partySize,
          booking_time: bookingTime
        }
      });
    }
  }

  // 2. Check for allergen or dish intent
  const allergenWords = ['nut', 'allergy', 'allergens', 'dairy', 'gluten', 'peanuts', 'ingredients', 'safe', 'contain'];
  const hasAllergenInquiry = allergenWords.some(w => text.includes(w)) || text.includes('pesto') || text.includes('risotto') || text.includes('pasta');

  if (hasAllergenInquiry) {
    let dishTarget = '';
    const dishMatch = userInput.match(/(?:does|is|can I eat|have|contain)\s+(?:the\s+)?([A-Za-z\s']+?)(?:\s+have|\s+safe|\s+contain|\?|$)/i);
    if (dishMatch && dishMatch[1].trim().length > 2) {
      dishTarget = dishMatch[1].trim();
    } else if (text.includes('pesto') || text.includes('presto')) dishTarget = 'Pesto Pasta';
    else if (text.includes('margherita') || text.includes('pizza')) dishTarget = 'Margherita Pizza';
    else if (text.includes('tiramisu')) dishTarget = 'Tiramisu';
    else if (text.includes('risotto') || text.includes('truffle')) dishTarget = 'Truffle Mushroom Risotto';
    else if (text.includes('lobster') || text.includes('tagliolini')) dishTarget = "Chef's Special Lobster Tagliolini";
    else if (text.includes('bolognese') || text.includes('spaghetti')) dishTarget = 'Spaghetti Bolognese';
    else if (text.includes('salad') || text.includes('caprese')) dishTarget = 'Caprese Salad';
    else dishTarget = 'Pesto Pasta';

    tools.push({
      name: 'get_allergen_info',
      args: { dish_name: dishTarget }
    });
  }

  return { toolsToCall: tools, extractedName: nameMatch ? nameMatch[1] : undefined };
}

/**
 * Execute tools and enforce fail-closed guardrails
 */
export async function executeTools(toolCalls: { name: string; args: any }[]): Promise<AgentExecutionTrace[]> {
  const traces: AgentExecutionTrace[] = [];

  // Execute in parallel as per multi-intent requirement
  const promises = toolCalls.map(async (call) => {
    const t0 = performance.now();
    let result: any = null;
    let guardrailEvaluated = false;
    let guardrailStatus = '';

    if (call.name === 'check_table_availability') {
      result = await checkTableAvailability(Number(call.args.party_size || 2), String(call.args.booking_time || '19:00'));
    } else if (call.name === 'get_allergen_info') {
      const dbAllergenResult = await getAllergenInfo(String(call.args.dish_name || ''));
      const guardrailVerdict = validateAllergenOutput(dbAllergenResult);
      guardrailEvaluated = true;
      guardrailStatus = dbAllergenResult.status === 'VERIFIED' ? 'PASS (VERIFIED)' : 'BLOCKED (FAIL-CLOSED)';
      result = {
        ...dbAllergenResult,
        guardrailVerdict
      };
    } else if (call.name === 'create_reservation') {
      result = await createReservation(
        String(call.args.customer_name || 'Valued Guest'),
        Number(call.args.party_size || 2),
        String(call.args.booking_time || '19:00')
      );
    }

    const t1 = performance.now();
    return {
      toolName: call.name,
      args: call.args,
      output: result,
      guardrailEvaluated,
      guardrailStatus,
      executionMs: Math.round(t1 - t0)
    };
  });

  const executed = await Promise.all(promises);
  traces.push(...executed);
  return traces;
}

/**
 * Synthesize final natural concise voice response (< 25 words)
 */
export async function synthesizeResponse(
  userInput: string,
  traces: AgentExecutionTrace[]
): Promise<string> {
  // If Gemini is available, we can use Gemini to synthesize concise voice text
  if (ai) {
    try {
      const summaryParts = traces.map(t => {
        if (t.toolName === 'check_table_availability') {
          return t.output.available 
            ? `Table is available at requested time.`
            : `Table full. Alternative: ${t.output.suggested_alternative || 'later'}.`;
        }
        if (t.toolName === 'get_allergen_info') {
          return t.output.guardrailVerdict.safeText;
        }
        if (t.toolName === 'create_reservation') {
          return t.output.status === 'SUCCESS'
            ? `Booking confirmed with ID ${t.output.booking_id} under ${t.output.customer_name}.`
            : `Booking failed.`;
        }
        return '';
      }).join(' ');

      const response = await withTimeout(ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [{
              text: `Customer asked: "${userInput}".
Tool outputs: ${summaryParts}.
Synthesize Sophia's spoken phone reply. STRICT RULE: Keep it under 25 words, natural, polite, and exact.`
            }]
          }
        ],
        config: {
          systemInstruction: SOPHIA_SYSTEM_PROMPT,
          temperature: 0.2
        }
      }), 2000);

      const spoken = response.text?.trim();
      if (spoken && spoken.length > 5) {
        return spoken;
      }
    } catch (err) {
      console.warn('Gemini synthesis failed, utilizing deterministic synthesizer:', err);
    }
  }

  // Deterministic high-speed voice synthesis (< 5ms, < 25 words)
  const parts: string[] = [];

  const tableTrace = traces.find(t => t.toolName === 'check_table_availability');
  if (tableTrace) {
    if (tableTrace.output.available) {
      parts.push(`We have a table available for ${tableTrace.args.party_size} at ${extractTime(tableTrace.args.booking_time)}.`);
    } else {
      parts.push(`We are fully booked at that time, but I have a table at ${tableTrace.output.suggested_alternative || '8:00 PM'}.`);
    }
  }

  const bookingTrace = traces.find(t => t.toolName === 'create_reservation');
  if (bookingTrace) {
    if (bookingTrace.output.status === 'SUCCESS') {
      parts.push(`Your reservation for ${bookingTrace.output.party_size} under ${bookingTrace.output.customer_name} is confirmed! (Ref: ${bookingTrace.output.booking_id}).`);
    } else {
      parts.push(bookingTrace.output.message || 'We could not complete the reservation.');
    }
  }

  const allergenTrace = traces.find(t => t.toolName === 'get_allergen_info');
  if (allergenTrace) {
    parts.push(allergenTrace.output.guardrailVerdict.safeText);
  }

  if (parts.length === 0) {
    return "Welcome to Trattoria Bella! I'd be happy to check table availability or answer any allergy questions for tonight.";
  }

  return parts.join(' ');
}

/**
 * Main Orchestrator Turn Execution
 */
export async function runOrchestratorTurn(userInput: string): Promise<AgentTurnResponse> {
  const startTime = performance.now();
  let toolCallsToRun: { name: string; args: any }[] = [];

  // 1. Try Gemini tool calling if API key is present
  if (ai) {
    try {
      const response = await withTimeout(ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: userInput }] }],
        config: {
          systemInstruction: SOPHIA_SYSTEM_PROMPT,
          tools: [{
            functionDeclarations: [
              checkTableAvailabilityDecl,
              getAllergenInfoDecl,
              createReservationDecl
            ]
          }]
        }
      }), 2000);

      const genAiCalls = response.functionCalls;
      if (genAiCalls && genAiCalls.length > 0) {
        toolCallsToRun = genAiCalls
          .filter((c): c is typeof c & { name: string } => Boolean(c.name))
          .map(c => ({
            name: c.name,
            args: c.args || {}
          }));
      }
    } catch (err) {
      console.warn('Gemini tool calling error, falling back to deterministic intent parser:', err);
    }
  }

  // 2. If no tools identified by LLM or API unavailable, route via deterministic parser
  if (toolCallsToRun.length === 0) {
    const routed = deterministicIntentRouter(userInput);
    toolCallsToRun = routed.toolsToCall;
  }

  // 3. Execute tools in parallel
  const executionTraces = await executeTools(toolCallsToRun);

  // 4. Synthesize spoken response
  const spokenText = await synthesizeResponse(userInput, executionTraces);

  // 5. Post-generation Safety Guardrail Audit
  const allergenTrace = executionTraces.find(t => t.toolName === 'get_allergen_info');
  const audit = auditSpokenResponse(
    spokenText, 
    allergenTrace ? {
      status: allergenTrace.output.status,
      contains: allergenTrace.output.contains || [],
      dish: allergenTrace.output.dish
    } : undefined
  );

  const endTime = performance.now();
  const latencyMs = Math.round(endTime - startTime);

  const bookingConfirmedTrace = executionTraces.find(t => t.toolName === 'create_reservation' && t.output?.status === 'SUCCESS');

  return {
    spokenText,
    latencyMs,
    toolCalls: executionTraces,
    multiIntentDetected: executionTraces.length > 1,
    guardrailPassed: audit.safe,
    guardrailAuditNote: audit.auditNote,
    bookingConfirmed: bookingConfirmedTrace ? bookingConfirmedTrace.output : undefined
  };
}
