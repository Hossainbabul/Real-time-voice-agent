export interface TableRow {
  table_id: number;
  capacity: number;
  is_active: number;
}

export interface MenuItemRow {
  item_id: number;
  dish_name: string;
  ingredients: string;
  verified_allergens: string | null;
  allergen_status: 'VERIFIED' | 'UNVERIFIED';
}

export interface ReservationRow {
  reservation_id: number;
  customer_name: string;
  party_size: number;
  reservation_time: string;
  status: string;
}

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
  bookingConfirmed?: {
    booking_id: string;
    customer_name: string;
    party_size: number;
    booking_time: string;
  };
}

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
  toolCallingAccuracy: number;
  allergenFailClosedRate: number;
  avgTurnaroundLatencyMs: number;
  taskCompletionRate: number;
  results: TestCaseResult[];
}
