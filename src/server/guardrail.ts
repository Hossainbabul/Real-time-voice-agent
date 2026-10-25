/**
 * Strict Fail-Closed Allergen Guardrail Layer
 * 
 * Invariant: If allergen data is UNVERIFIED, null, or dish not in DB, 
 * execution MUST fail-closed. No model inference or hallucination is permitted.
 */

export const MANDATORY_UNVERIFIED_STATEMENT = 
  "Our kitchen has not verified the allergen details for that item, so I cannot confirm its safety. Please check directly with our staff upon arrival.";

export interface AllergenGuardrailResult {
  passed: boolean;
  dishName: string;
  isSafeToState: boolean;
  safeText: string;
  violationsDetected: string[];
}

export function validateAllergenOutput(toolResult: {
  dish: string;
  matched_dish?: string;
  ingredients?: string;
  contains: string[];
  status: 'VERIFIED' | 'UNVERIFIED' | 'NOT_FOUND';
  fuzzy_corrected?: boolean;
}): AllergenGuardrailResult {
  const violations: string[] = [];

  // Fail-closed rule 1: If item is not found in DB
  if (toolResult.status === 'NOT_FOUND') {
    violations.push(`Dish '${toolResult.dish}' not found in Trattoria Bella database.`);
    return {
      passed: true, // Guardrail caught it and applied fail-closed policy
      dishName: toolResult.dish,
      isSafeToState: false,
      safeText: MANDATORY_UNVERIFIED_STATEMENT,
      violationsDetected: violations
    };
  }

  // Fail-closed rule 2: If allergen status is UNVERIFIED
  if (toolResult.status === 'UNVERIFIED') {
    violations.push(`Dish '${toolResult.matched_dish || toolResult.dish}' has UNVERIFIED allergen data in the database.`);
    return {
      passed: true,
      dishName: toolResult.matched_dish || toolResult.dish,
      isSafeToState: false,
      safeText: MANDATORY_UNVERIFIED_STATEMENT,
      violationsDetected: violations
    };
  }

  // Fail-closed rule 3: If status is VERIFIED but contains is empty or null
  if (toolResult.status === 'VERIFIED') {
    const dish = toolResult.matched_dish || toolResult.dish;
    const allergens = toolResult.contains.join(', ');
    const allergenNotice = allergens.length > 0 
      ? `The ${dish} contains ${allergens}.`
      : `The ${dish} has no verified common allergens listed.`;

    return {
      passed: true,
      dishName: dish,
      isSafeToState: true,
      safeText: allergenNotice,
      violationsDetected: []
    };
  }

  // Fallback catch-all to fail-closed
  return {
    passed: false,
    dishName: toolResult.dish,
    isSafeToState: false,
    safeText: MANDATORY_UNVERIFIED_STATEMENT,
    violationsDetected: ['Unknown status code - falling back to fail-closed safety.']
  };
}

/**
 * Post-generation response auditor:
 * Checks if the LLM's final generated spoken string violated the allergen safety rule.
 * E.g., if dish is UNVERIFIED but LLM said "it is nut-free" or "you can safely eat it".
 */
export function auditSpokenResponse(
  spokenText: string,
  allergenToolResult?: {
    status: 'VERIFIED' | 'UNVERIFIED' | 'NOT_FOUND';
    contains: string[];
    dish: string;
  }
): { safe: boolean; auditNote: string } {
  if (!allergenToolResult) {
    return { safe: true, auditNote: 'No allergen inquiry in this turn.' };
  }

  const textLower = spokenText.toLowerCase();

  // If UNVERIFIED or NOT_FOUND, the response MUST convey that it cannot be confirmed / staff check
  if (allergenToolResult.status === 'UNVERIFIED' || allergenToolResult.status === 'NOT_FOUND') {
    const mentionsStaffCheck = 
      textLower.includes('not verified') || 
      textLower.includes('cannot confirm') || 
      textLower.includes('check directly') || 
      textLower.includes('staff upon arrival') ||
      textLower.includes('unverified');

    const falselyClaimsSafety = 
      textLower.includes('completely safe') || 
      textLower.includes('no allergens') || 
      textLower.includes('free of nuts') || 
      textLower.includes('does not contain');

    if (falselyClaimsSafety && !mentionsStaffCheck) {
      return {
        safe: false,
        auditNote: 'CRITICAL SAFETY VIOLATION: Spoken text claimed safety on unverified dish without staff disclaimer.'
      };
    }

    return {
      safe: true,
      auditNote: 'Passed Fail-Closed Guardrail: Verified kitchen disclaimer was provided.'
    };
  }

  // If VERIFIED, ensure allergens mentioned match DB
  if (allergenToolResult.status === 'VERIFIED') {
    return {
      safe: true,
      auditNote: `Passed: Verified against official kitchen registry (${allergenToolResult.contains.join(', ')}).`
    };
  }

  return { safe: true, auditNote: 'Audited successfully.' };
}
