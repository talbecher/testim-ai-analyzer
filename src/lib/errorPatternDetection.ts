import { ErrorPattern } from '@/types/testim';

interface PatternMatch {
  pattern: ErrorPattern;
  confidence: number;
}

// Error message patterns and their classifications
const ERROR_PATTERNS: Array<{
  regex: RegExp;
  pattern: ErrorPattern;
  baseConfidence: number;
}> = [
  // Element not found patterns
  { regex: /element\s+(not\s+)?found/i, pattern: 'Element not found', baseConfidence: 75 },
  { regex: /no\s+such\s+element/i, pattern: 'Element not found', baseConfidence: 75 },
  { regex: /cannot\s+find\s+element/i, pattern: 'Element not found', baseConfidence: 75 },
  { regex: /element\s+does\s+not\s+exist/i, pattern: 'Element not found', baseConfidence: 75 },
  { regex: /unable\s+to\s+locate/i, pattern: 'Element not found', baseConfidence: 70 },
  { regex: /stale\s+element/i, pattern: 'Element not found', baseConfidence: 80 },
  { regex: /element\s+is\s+not\s+attached/i, pattern: 'Element not found', baseConfidence: 80 },
  { regex: /element\s+reference/i, pattern: 'Element not found', baseConfidence: 65 },
  
  // Timeout patterns
  { regex: /timeout/i, pattern: 'Timeout', baseConfidence: 70 },
  { regex: /timed\s+out/i, pattern: 'Timeout', baseConfidence: 70 },
  { regex: /exceeded\s+.*time/i, pattern: 'Timeout', baseConfidence: 65 },
  { regex: /wait\s+.*expired/i, pattern: 'Timeout', baseConfidence: 70 },
  { regex: /deadline\s+exceeded/i, pattern: 'Timeout', baseConfidence: 75 },
  
  // Assertion patterns
  { regex: /assertion\s*(error|fail)/i, pattern: 'AssertionError', baseConfidence: 20 },
  { regex: /expected\s+.+\s+(but\s+)?got/i, pattern: 'AssertionError', baseConfidence: 20 },
  { regex: /expect.*to\s+(be|equal|have|contain)/i, pattern: 'AssertionError', baseConfidence: 25 },
  { regex: /assert.*fail/i, pattern: 'AssertionError', baseConfidence: 20 },
  { regex: /mismatch/i, pattern: 'AssertionError', baseConfidence: 25 },
  { regex: /does\s+not\s+match/i, pattern: 'AssertionError', baseConfidence: 25 },
  { regex: /should\s+(be|have|equal)/i, pattern: 'AssertionError', baseConfidence: 30 },
  
  // Network patterns
  { regex: /network\s+error/i, pattern: 'Network error', baseConfidence: 80 },
  { regex: /connection\s+(refused|reset|failed)/i, pattern: 'Network error', baseConfidence: 80 },
  { regex: /ERR_CONNECTION/i, pattern: 'Network error', baseConfidence: 85 },
  { regex: /ECONNREFUSED/i, pattern: 'Network error', baseConfidence: 85 },
  { regex: /fetch\s+failed/i, pattern: 'Network error', baseConfidence: 75 },
  { regex: /failed\s+to\s+fetch/i, pattern: 'Network error', baseConfidence: 75 },
  { regex: /net::/i, pattern: 'Network error', baseConfidence: 70 },
  { regex: /cors/i, pattern: 'Network error', baseConfidence: 70 },
  { regex: /500\s+internal\s+server/i, pattern: 'Network error', baseConfidence: 60 },
  { regex: /502|503|504/i, pattern: 'Network error', baseConfidence: 65 },
  
  // Null/Undefined patterns
  { regex: /null/i, pattern: 'Null/Undefined', baseConfidence: 55 },
  { regex: /undefined/i, pattern: 'Null/Undefined', baseConfidence: 55 },
  { regex: /cannot\s+read\s+propert/i, pattern: 'Null/Undefined', baseConfidence: 60 },
  { regex: /is\s+not\s+a\s+function/i, pattern: 'Null/Undefined', baseConfidence: 50 },
  { regex: /typeerror/i, pattern: 'Null/Undefined', baseConfidence: 45 },
];

/**
 * Detect error pattern from error message
 * Returns the detected pattern and confidence level
 */
export function detectErrorPattern(errorMessage: string | undefined): PatternMatch {
  if (!errorMessage || errorMessage.trim() === '') {
    return { pattern: 'Unknown', confidence: 0 };
  }
  
  const message = errorMessage.toLowerCase();
  let bestMatch: PatternMatch = { pattern: 'Other', confidence: 30 };
  
  for (const { regex, pattern, baseConfidence } of ERROR_PATTERNS) {
    if (regex.test(message)) {
      if (baseConfidence > bestMatch.confidence) {
        bestMatch = { pattern, confidence: baseConfidence };
      }
    }
  }
  
  return bestMatch;
}

/**
 * Determine if error pattern is typically flaky
 * Returns a flakiness probability (0-100)
 */
export function getPatternFlakiness(pattern: ErrorPattern, durationMs?: number): number {
  const baseFlakiness: Record<ErrorPattern, number> = {
    'Element not found': 75,
    'Timeout': 60,
    'AssertionError': 20, // Usually real bugs
    'Network error': 80,
    'Null/Undefined': 55,
    'Other': 50,
    'Unknown': 50,
  };
  
  let flakiness = baseFlakiness[pattern];
  
  // Adjust based on duration
  if (durationMs !== undefined) {
    if (pattern === 'Element not found' && durationMs < 5000) {
      // Fast failure on element not found - likely page didn't load
      flakiness = Math.max(flakiness - 10, 0);
    }
    
    if (pattern === 'Timeout' && durationMs > 30000) {
      // Very long timeout - might be infinite loop (real bug)
      flakiness = Math.max(flakiness - 30, 0);
    }
    
    if (pattern === 'Timeout' && durationMs < 10000) {
      // Short timeout - likely environment issue
      flakiness = Math.min(flakiness + 10, 100);
    }
  }
  
  return flakiness;
}

/**
 * Determine if this error likely requires a rerun
 */
export function shouldRerun(pattern: ErrorPattern, confidence: number): boolean {
  // AssertionErrors with high confidence are likely real bugs
  if (pattern === 'AssertionError' && confidence > 70) {
    return false;
  }
  
  // Network errors and timeouts often resolve with rerun
  if (pattern === 'Network error' || pattern === 'Timeout') {
    return true;
  }
  
  // Element not found with high confidence is flaky
  if (pattern === 'Element not found') {
    return confidence < 80;
  }
  
  return true;
}
