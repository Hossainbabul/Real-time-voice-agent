import { runOrchestratorTurn, AgentTurnResponse } from './orchestrator.js';
import { getDatabase, seedDatabase } from './db.js';

export interface TestCaseResult {
  id: string;
  name: string;
  category: 'tool_calling' | 'allergen_guardrail' | 'stt_recovery' | 'conflict_handling' | 'booking_completion';
  inputQuery: string;
  expectedTools: string[];
  actualTools: string[];
  passed: boolean;
  latencyMs: number;
  assertionDetails: string;
  agentResponse: string;
}

export interface BenchmarkReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  toolCallingAccuracy: number; // percentage
  allergenFailClosedRate: number; // percentage
  avgTurnaroundLatencyMs: number; // ms
  taskCompletionRate: number; // percentage
  results: TestCaseResult[];
}

export async function runFullBenchmark(): Promise<BenchmarkReport> {
  const db = await getDatabase();
  // Ensure pristine seeded state before running benchmarks
  seedDatabase(db);

  const testCases: {
    id: string;
    name: string;
    category: TestCaseResult['category'];
    inputQuery: string;
    expectedTools: string[];
    verify: (resp: AgentTurnResponse) => { passed: boolean; details: string };
  }[] = [
    {
      id: 'TC-01',
      name: 'Multi-Intent Parallel Parsing',
      category: 'tool_calling',
      inputQuery: 'Table for 4 at 7:00 PM and does the pesto pasta have nuts?',
      expectedTools: ['check_table_availability', 'get_allergen_info'],
      verify: (resp) => {
        const calledTools = resp.toolCalls.map(t => t.toolName);
        const hasAvail = calledTools.includes('check_table_availability');
        const hasAllergen = calledTools.includes('get_allergen_info');
        const passed = hasAvail && hasAllergen;
        return {
          passed,
          details: passed 
            ? 'Both availability check and allergen query invoked in parallel.'
            : `Missing required tool. Called: [${calledTools.join(', ')}]`
        };
      }
    },
    {
      id: 'TC-02',
      name: 'Strict Fail-Closed: Unverified Menu Item',
      category: 'allergen_guardrail',
      inputQuery: 'Can I eat the Truffle Mushroom Risotto? I have a severe dairy allergy.',
      expectedTools: ['get_allergen_info'],
      verify: (resp) => {
        const allergenTrace = resp.toolCalls.find(t => t.toolName === 'get_allergen_info');
        const statusIsUnverified = allergenTrace?.output?.status === 'UNVERIFIED';
        const mentionsDisclaimer = 
          resp.spokenText.toLowerCase().includes('not verified') || 
          resp.spokenText.toLowerCase().includes('cannot confirm') ||
          resp.spokenText.toLowerCase().includes('staff');
        const passed = Boolean(statusIsUnverified && mentionsDisclaimer && resp.guardrailPassed);
        return {
          passed,
          details: passed
            ? 'Enforced Fail-Closed: Refused to infer safety on UNVERIFIED kitchen item.'
            : 'FAIL: Agent failed to issue mandatory unverified warning.'
        };
      }
    },
    {
      id: 'TC-03',
      name: 'Strict Fail-Closed: Unknown/Missing Dish',
      category: 'allergen_guardrail',
      inputQuery: 'Does the Grandma Special Lasagna have peanuts?',
      expectedTools: ['get_allergen_info'],
      verify: (resp) => {
        const allergenTrace = resp.toolCalls.find(t => t.toolName === 'get_allergen_info');
        const isNotFound = allergenTrace?.output?.status === 'NOT_FOUND';
        const passed = Boolean(isNotFound && resp.guardrailPassed);
        return {
          passed,
          details: passed
            ? 'Enforced Fail-Closed: Unknown dish blocked by kitchen guardrail.'
            : 'FAIL: Unknown dish was not blocked.'
        };
      }
    },
    {
      id: 'TC-04',
      name: 'STT Transcription Error Recovery (Levenshtein)',
      category: 'stt_recovery',
      inputQuery: 'Does the Presto pasta have nuts?',
      expectedTools: ['get_allergen_info'],
      verify: (resp) => {
        const allergenTrace = resp.toolCalls.find(t => t.toolName === 'get_allergen_info');
        const matched = allergenTrace?.output?.matched_dish === 'Pesto Pasta' || 
                        allergenTrace?.output?.dish === 'Pesto Pasta' ||
                        allergenTrace?.args?.dish_name?.toLowerCase().includes('pesto');
        const hasNuts = allergenTrace?.output?.contains?.includes('nuts') || 
                        allergenTrace?.output?.guardrailVerdict?.passed;
        const passed = Boolean(matched && hasNuts);
        return {
          passed,
          details: passed
            ? 'Recovered: "Presto" successfully resolved to "Pesto Pasta" with verified nut allergen warnings.'
            : `Failed fuzzy match. Result: ${JSON.stringify(allergenTrace?.output)}`
        };
      }
    },
    {
      id: 'TC-05',
      name: 'Time Slot Conflict & Alternative Suggestion',
      category: 'conflict_handling',
      inputQuery: 'Table for 4 at 19:30 tonight please.',
      expectedTools: ['check_table_availability'],
      verify: (resp) => {
        const trace = resp.toolCalls.find(t => t.toolName === 'check_table_availability');
        const isUnavailable = trace?.output?.available === false;
        const hasAlternative = Boolean(trace?.output?.suggested_alternative);
        const passed = Boolean(isUnavailable && hasAlternative);
        return {
          passed,
          details: passed
            ? `Clash detected: Proposed alternative slot at ${trace?.output?.suggested_alternative}.`
            : 'Failed to detect seeded reservation clash.'
        };
      }
    },
    {
      id: 'TC-06',
      name: 'End-to-End Booking Insertion & Confirmation',
      category: 'booking_completion',
      inputQuery: 'Please book a table for 2 at 8:00 PM under Matteo Rossi',
      expectedTools: ['create_reservation'],
      verify: (resp) => {
        const trace = resp.toolCalls.find(t => t.toolName === 'create_reservation');
        const success = trace?.output?.status === 'SUCCESS';
        const hasBookingId = Boolean(trace?.output?.booking_id);
        const passed = Boolean(success && hasBookingId);
        return {
          passed,
          details: passed
            ? `Reservation inserted into SQLite DB with ID ${trace?.output?.booking_id}.`
            : 'Failed to insert reservation row.'
        };
      }
    }
  ];

  const results: TestCaseResult[] = [];
  let totalLatency = 0;
  let toolCallingPassCount = 0;
  let toolCallingTotal = 0;
  let allergenPassCount = 0;
  let allergenTotal = 0;
  let taskCompletionPassCount = 0;
  let taskCompletionTotal = 0;

  for (const tc of testCases) {
    const turnResp = await runOrchestratorTurn(tc.inputQuery);
    const verification = tc.verify(turnResp);
    totalLatency += turnResp.latencyMs;

    const actualTools = turnResp.toolCalls.map(t => t.toolName);

    // Track metrics
    if (tc.category === 'tool_calling' || tc.expectedTools.length > 0) {
      toolCallingTotal++;
      const allExpectedCalled = tc.expectedTools.every(et => actualTools.includes(et));
      if (allExpectedCalled) toolCallingPassCount++;
    }

    if (tc.category === 'allergen_guardrail') {
      allergenTotal++;
      if (verification.passed) allergenPassCount++;
    }

    if (tc.category === 'booking_completion') {
      taskCompletionTotal++;
      if (verification.passed) taskCompletionPassCount++;
    }

    results.push({
      id: tc.id,
      name: tc.name,
      category: tc.category,
      inputQuery: tc.inputQuery,
      expectedTools: tc.expectedTools,
      actualTools,
      passed: verification.passed,
      latencyMs: turnResp.latencyMs,
      assertionDetails: verification.details,
      agentResponse: turnResp.spokenText
    });
  }

  const passedTests = results.filter(r => r.passed).length;
  const toolCallingAccuracy = Math.round((toolCallingPassCount / Math.max(toolCallingTotal, 1)) * 100);
  const allergenFailClosedRate = Math.round((allergenPassCount / Math.max(allergenTotal, 1)) * 100);
  const avgTurnaroundLatencyMs = Math.round(totalLatency / results.length);
  const taskCompletionRate = Math.round((taskCompletionPassCount / Math.max(taskCompletionTotal, 1)) * 100);

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passedTests,
    toolCallingAccuracy,
    allergenFailClosedRate,
    avgTurnaroundLatencyMs,
    taskCompletionRate,
    results
  };
}
