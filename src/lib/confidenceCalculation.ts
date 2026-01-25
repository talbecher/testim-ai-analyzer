/**
 * Weighted Confidence Calculation
 * Combines multiple signals to produce a final classification with breakdown
 */

export type SignalDirection = 'bug' | 'flaky' | 'environment' | 'investigate';

export interface SignalWeight {
  signalName: string;
  value: number;         // 0-100 contribution
  weight: number;        // 0-1 importance multiplier
  direction: SignalDirection;
  description: string;
}

export interface SignalBreakdown {
  bugScore: number;
  flakyScore: number;
  environmentScore: number;
  investigateScore: number;
  activeSignals: string[];
  dominantDirection: SignalDirection;
}

// Signal definitions with base confidence and weight
export const SIGNAL_WEIGHTS = {
  // Bug signals (strong indicators of real bugs)
  ASSERTION_WITH_VALUES: { base: 75, weight: 1.2, direction: 'bug' as const, desc: 'AssertionError with expected≠actual values' },
  ASSERTION_VALUE_MISMATCH: { base: 80, weight: 1.3, direction: 'bug' as const, desc: 'Clear value mismatch (not null/undefined)' },
  CO_FAILURE_GROUP_4_PLUS: { base: 85, weight: 1.3, direction: 'bug' as const, desc: '4+ tests failing with same step/error' },
  CO_FAILURE_GROUP_2_3: { base: 70, weight: 1.0, direction: 'bug' as const, desc: '2-3 tests failing with same step/error' },
  CONSISTENT_FAILURE_STREAK: { base: 80, weight: 1.1, direction: 'bug' as const, desc: '3+ consecutive failures without local pass' },
  HISTORICAL_BUG_CORRECTION: { base: 90, weight: 1.4, direction: 'bug' as const, desc: 'Historical correction to Potential bug' },
  NULL_UNDEFINED_ERROR: { base: 60, weight: 0.9, direction: 'bug' as const, desc: 'Null/undefined reference error' },
  
  // Flaky signals (strong indicators of test instability)
  FLAKY_KB_MATCH: { base: 70, weight: 1.0, direction: 'flaky' as const, desc: 'Matched in Flaky Knowledge Base' },
  INTERMITTENT_STREAK: { base: 85, weight: 1.2, direction: 'flaky' as const, desc: 'Alternating pass/fail pattern' },
  PASSED_LOCALLY_3_PLUS: { base: 90, weight: 1.3, direction: 'flaky' as const, desc: 'Passed locally 3+ times in regression' },
  PASSED_LOCALLY_1_2: { base: 60, weight: 0.8, direction: 'flaky' as const, desc: 'Passed locally 1-2 times' },
  ELEMENT_NOT_FOUND: { base: 65, weight: 0.9, direction: 'flaky' as const, desc: 'Element not found (timing issue)' },
  VISUAL_ASSERTION: { base: 55, weight: 0.7, direction: 'flaky' as const, desc: 'Visual/screenshot assertion' },
  HISTORICAL_FLAKY_CORRECTION: { base: 85, weight: 1.2, direction: 'flaky' as const, desc: 'Historical correction to Likely Flaky' },
  
  // Environment signals
  NETWORK_ERROR: { base: 80, weight: 1.0, direction: 'environment' as const, desc: 'Network/connection error' },
  TIMEOUT_SHORT: { base: 70, weight: 0.9, direction: 'environment' as const, desc: 'Short timeout (<10s)' },
  TIMEOUT_LONG: { base: 50, weight: 0.6, direction: 'environment' as const, desc: 'Long timeout (>30s) - may be real bug' },
  INFRA_PATTERN: { base: 75, weight: 1.0, direction: 'environment' as const, desc: 'Infrastructure/service error pattern' },
  CO_FAILURE_INFRA: { base: 80, weight: 1.1, direction: 'environment' as const, desc: 'Multiple tests with same infra error' },
  
  // Investigate signals (ambiguous cases)
  FIRST_SEEN_GLOBALLY: { base: 50, weight: 0.7, direction: 'investigate' as const, desc: 'First time seeing this test fail' },
  FIRST_SEEN_IN_REGRESSION: { base: 40, weight: 0.5, direction: 'investigate' as const, desc: 'First failure in this regression' },
  CONFLICTING_SIGNALS: { base: 55, weight: 1.0, direction: 'investigate' as const, desc: 'Bug and flaky signals both present' },
  MANUAL_CHANGE_DETECTED: { base: 60, weight: 1.1, direction: 'investigate' as const, desc: 'Test was manually changed' },
  LOW_HISTORY: { base: 45, weight: 0.6, direction: 'investigate' as const, desc: 'Less than 3 runs in history' },
} as const;

export type SignalKey = keyof typeof SIGNAL_WEIGHTS;

/**
 * Calculate weighted confidence scores for all directions
 */
export function calculateSignalBreakdown(
  activeSignals: SignalKey[]
): SignalBreakdown {
  let bugScore = 0;
  let flakyScore = 0;
  let environmentScore = 0;
  let investigateScore = 0;
  
  const signalNames: string[] = [];

  activeSignals.forEach(signalKey => {
    const signal = SIGNAL_WEIGHTS[signalKey];
    if (!signal) return;
    
    const contribution = signal.base * signal.weight;
    signalNames.push(signalKey);
    
    switch (signal.direction) {
      case 'bug':
        bugScore += contribution;
        break;
      case 'flaky':
        flakyScore += contribution;
        break;
      case 'environment':
        environmentScore += contribution;
        break;
      case 'investigate':
        investigateScore += contribution;
        break;
    }
  });

  // Normalize scores to percentages
  const totalScore = bugScore + flakyScore + environmentScore + investigateScore;
  
  if (totalScore > 0) {
    bugScore = Math.round((bugScore / totalScore) * 100);
    flakyScore = Math.round((flakyScore / totalScore) * 100);
    environmentScore = Math.round((environmentScore / totalScore) * 100);
    investigateScore = Math.round((investigateScore / totalScore) * 100);
  }

  // Determine dominant direction
  const scores = {
    bug: bugScore,
    flaky: flakyScore,
    environment: environmentScore,
    investigate: investigateScore,
  };
  
  const dominantDirection = (Object.entries(scores) as [SignalDirection, number][])
    .reduce((a, b) => a[1] > b[1] ? a : b)[0];

  return {
    bugScore,
    flakyScore,
    environmentScore,
    investigateScore,
    activeSignals: signalNames,
    dominantDirection,
  };
}

/**
 * Get human-readable descriptions for active signals
 */
export function getSignalDescriptions(activeSignals: SignalKey[]): string[] {
  return activeSignals
    .filter(key => SIGNAL_WEIGHTS[key])
    .map(key => SIGNAL_WEIGHTS[key].desc);
}

/**
 * Map signal breakdown to classification
 */
export function breakdownToClassification(breakdown: SignalBreakdown): string {
  switch (breakdown.dominantDirection) {
    case 'bug':
      return 'Potential bug';
    case 'flaky':
      return 'Likely Flaky';
    case 'environment':
      return 'Environment / Infra Issue';
    case 'investigate':
    default:
      return 'Investigate';
  }
}
