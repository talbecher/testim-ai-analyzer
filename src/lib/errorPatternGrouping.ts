import type { ErrorPattern, AnalyzedFailure } from '@/types/testim';

export type PatternColorTone = 'bug' | 'flaky' | 'environment' | 'expected' | 'muted';

export interface PatternGroup {
  /** Stable key used for filtering. */
  key: string;
  /** Human-readable label shown on the chip. */
  label: string;
  count: number;
  tone: PatternColorTone;
  pattern?: ErrorPattern;
}

interface CanonicalBucket {
  key: string;
  label: string;
  tone: PatternColorTone;
  match: RegExp;
  pattern?: ErrorPattern;
}

/**
 * Canonical buckets for grouping failures.
 *
 * Order matters — first match wins. Place specific buckets before general ones
 * (e.g. "element-not-visible" before "element-not-found").
 *
 * Each bucket represents a single semantic failure cause. Any failure whose
 * error message matches the bucket's regex collapses into the same chip,
 * regardless of dynamic data (selectors, timestamps, paths, etc.).
 */
const CANONICAL_BUCKETS: CanonicalBucket[] = [
  {
    key: 'element-not-visible',
    label: 'Element is not visible',
    tone: 'flaky',
    match: /element\s+(is\s+)?(not\s+visible|hidden|invisible)|not\s+displayed/i,
  },
  {
    key: 'element-score-too-low',
    label: 'Element score is too low',
    tone: 'flaky',
    match: /element\s+score\s+(is\s+)?too\s+low|low\s+confidence\s+score/i,
  },
  {
    key: 'click-intercepted',
    label: 'Click intercepted',
    tone: 'flaky',
    match: /click\s+intercepted|other\s+element\s+would\s+receive|element\s+click\s+intercepted/i,
  },
  {
    key: 'element-not-found',
    label: 'Element not found',
    tone: 'flaky',
    match: /element\s+(was\s+)?not\s+found|no\s+such\s+element|cannot\s+find\s+element|stale\s+element|element\s+is\s+not\s+attached/i,
    pattern: 'Element not found',
  },
  {
    key: 'timeout',
    label: 'Timeout',
    tone: 'environment',
    match: /timeout|timed\s+out|deadline\s+exceeded|wait(ing)?\s+exceeded|exceeded\s+the\s+wait/i,
    pattern: 'Timeout',
  },
  {
    key: 'navigation',
    label: 'Navigation failed',
    tone: 'environment',
    match: /navigation\s+(failed|timeout)|page\s+crash|net::ERR|ERR_(CONNECTION|NETWORK|NAME_NOT_RESOLVED)/i,
  },
  {
    key: 'network',
    label: 'Network error',
    tone: 'environment',
    match: /network\s+error|ECONNREFUSED|fetch\s+failed|cors\b|connection\s+(refused|reset|failed|aborted)/i,
    pattern: 'Network error',
  },
  {
    key: 'assertion',
    label: 'Assertion mismatch',
    tone: 'bug',
    match: /assert(ion)?\s*(error|failed)?|expected[:\s].{0,40}(actual|but\s+got|received)|data\s+is\s+not\s+equal|values?\s+do\s+not\s+match/i,
    pattern: 'AssertionError',
  },
  {
    key: 'null-undefined',
    label: 'Null / Undefined',
    tone: 'bug',
    match: /\bnull\b|\bundefined\b|cannot\s+read\s+propert/i,
    pattern: 'Null/Undefined',
  },
];

const OTHER_KEY = '__other__';
const MIN_OCCURRENCES = 2;
const MAX_LABEL_LENGTH = 60;

/**
 * Returns the canonical bucket key for a given error message, or `__other__`
 * if no canonical bucket matches. This is the single source of truth used
 * both for chip counts and for list filtering, so they always agree.
 */
export function getBucketKeyForMessage(raw: string | undefined | null): string {
  if (!raw) return OTHER_KEY;
  const text = String(raw);
  for (const bucket of CANONICAL_BUCKETS) {
    if (bucket.match.test(text)) return bucket.key;
  }
  return OTHER_KEY;
}

/**
 * Legacy normalizer kept for backwards compatibility (and for the "Other"
 * fallback label when needed). Not used for grouping anymore.
 */
export function normalizeErrorSignature(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  const nl = s.indexOf('\n');
  if (nl > 0) s = s.slice(0, nl);
  s = s
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[a-z]:\\[^\s]+/gi, '')
    .replace(/\/[\w./-]{6,}/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/\b[0-9a-f]{16,}\b/gi, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/[:\-–]\s*$/g, '')
    .replace(/[.;,]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > MAX_LABEL_LENGTH) s = s.slice(0, MAX_LABEL_LENGTH).trim() + '…';
  return s;
}

/**
 * Group failures by canonical bucket.
 *
 * Counts every failure exactly once. Buckets with fewer than
 * MIN_OCCURRENCES failures collapse into a single "Other" chip together
 * with messages that didn't match any canonical bucket.
 */
export function groupFailuresByPattern(failures: AnalyzedFailure[]): PatternGroup[] {
  const counts = new Map<string, number>();

  for (const f of failures) {
    const key = getBucketKeyForMessage(f.errorMessage);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let otherCount = counts.get(OTHER_KEY) ?? 0;
  const groups: PatternGroup[] = [];

  for (const bucket of CANONICAL_BUCKETS) {
    const count = counts.get(bucket.key) ?? 0;
    if (count === 0) continue;
    if (count < MIN_OCCURRENCES) {
      otherCount += count;
      continue;
    }
    groups.push({
      key: bucket.key,
      label: bucket.label,
      count,
      tone: bucket.tone,
      pattern: bucket.pattern,
    });
  }

  if (otherCount > 0) {
    groups.push({
      key: OTHER_KEY,
      label: 'Other',
      count: otherCount,
      tone: 'muted',
      pattern: 'Other',
    });
  }

  return groups.sort((a, b) => {
    // Always push "Other" to the end regardless of count.
    if (a.key === OTHER_KEY) return 1;
    if (b.key === OTHER_KEY) return -1;
    return b.count - a.count;
  });
}
