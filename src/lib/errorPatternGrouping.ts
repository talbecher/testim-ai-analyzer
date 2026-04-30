import type { ErrorPattern, AnalyzedFailure } from '@/types/testim';

export type PatternColorTone = 'bug' | 'flaky' | 'environment' | 'expected' | 'muted';

export interface PatternGroup {
  pattern: ErrorPattern;
  count: number;
  tone: PatternColorTone;
}

// Map each error pattern to its dominant classification color tone.
// Mirrors the assumptions in errorPatternDetection.ts (flakiness baselines).
const PATTERN_TONE: Record<ErrorPattern, PatternColorTone> = {
  'Element not found': 'flaky',
  'Timeout': 'environment',
  'AssertionError': 'bug',
  'Network error': 'environment',
  'Null/Undefined': 'bug',
  'Other': 'muted',
  'Unknown': 'muted',
};

const MIN_OCCURRENCES = 2;

/**
 * Group analyzed failures by their detected error pattern.
 *
 * - Only patterns with 2+ occurrences are returned as standalone chips.
 * - Patterns with a single occurrence are folded into "Other".
 * - Returned groups are sorted by count descending.
 * - Failures without analysis (still loading) are ignored.
 */
export function groupFailuresByPattern(failures: AnalyzedFailure[]): PatternGroup[] {
  const counts = new Map<ErrorPattern, number>();

  for (const f of failures) {
    const pattern = f.analysis?.errorPattern;
    if (!pattern) continue;
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }

  // Fold singletons into "Other"
  let otherBoost = 0;
  const consolidated = new Map<ErrorPattern, number>();
  for (const [pattern, count] of counts) {
    if (count < MIN_OCCURRENCES && pattern !== 'Other') {
      otherBoost += count;
    } else {
      consolidated.set(pattern, count);
    }
  }
  if (otherBoost > 0) {
    consolidated.set('Other', (consolidated.get('Other') ?? 0) + otherBoost);
  }

  return Array.from(consolidated.entries())
    .map(([pattern, count]) => ({
      pattern,
      count,
      tone: PATTERN_TONE[pattern],
    }))
    .sort((a, b) => b.count - a.count);
}
