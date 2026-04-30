import type { ErrorPattern, AnalyzedFailure } from '@/types/testim';

export type PatternColorTone = 'bug' | 'flaky' | 'environment' | 'expected' | 'muted';

export interface PatternGroup {
  /** Stable key used for filtering (matches the normalized signature). */
  key: string;
  /** Human-readable label shown on the chip. */
  label: string;
  count: number;
  tone: PatternColorTone;
  /** Optional originating ErrorPattern enum (when the signature aligns with a known pattern). */
  pattern?: ErrorPattern;
}

// Map known ErrorPattern enums to a tone (used when we can detect them inside the message).
const PATTERN_TONE: Record<ErrorPattern, PatternColorTone> = {
  'Element not found': 'flaky',
  'Timeout': 'environment',
  'AssertionError': 'bug',
  'Network error': 'environment',
  'Null/Undefined': 'bug',
  'Other': 'muted',
  'Unknown': 'muted',
};

// Heuristics that map a normalized signature → tone, so even dynamic signatures get colored.
const TONE_HINTS: Array<{ test: RegExp; tone: PatternColorTone; pattern?: ErrorPattern }> = [
  { test: /element\s+(is\s+)?not\s+visible/i, tone: 'flaky' },
  { test: /element\s+(not\s+)?found|no\s+such\s+element|cannot\s+find\s+element|stale\s+element/i, tone: 'flaky', pattern: 'Element not found' },
  { test: /element\s+score\s+is\s+too\s+low/i, tone: 'flaky' },
  { test: /timeout|timed\s+out|deadline\s+exceeded/i, tone: 'environment', pattern: 'Timeout' },
  { test: /network|connection\s+(refused|reset|failed)|ECONNREFUSED|fetch\s+failed|cors/i, tone: 'environment', pattern: 'Network error' },
  { test: /expected[:\s].+(actual|but\s+got|received)|assertion|mismatch|data\s+is\s+not\s+equal/i, tone: 'bug', pattern: 'AssertionError' },
  { test: /null|undefined|cannot\s+read\s+propert/i, tone: 'bug', pattern: 'Null/Undefined' },
];

const MIN_OCCURRENCES = 2;
const MAX_LABEL_LENGTH = 60;

/**
 * Build a normalized signature from a raw error message so that semantically
 * equivalent failures collapse into the same group.
 *
 * Strips:
 *  - Quoted values ('...', "...")
 *  - Long hex/numeric tokens, hashes, GUIDs
 *  - URLs and file paths
 *  - Excess whitespace and trailing punctuation
 * Then truncates to MAX_LABEL_LENGTH.
 */
export function normalizeErrorSignature(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();

  // Drop everything after the first newline — usually the headline message
  const nl = s.indexOf('\n');
  if (nl > 0) s = s.slice(0, nl);

  s = s
    // URLs
    .replace(/https?:\/\/\S+/gi, '')
    // File paths
    .replace(/[a-z]:\\[^\s]+/gi, '')
    .replace(/\/[\w./-]{6,}/g, '')
    // Quoted strings
    .replace(/'[^']*'/g, '')
    .replace(/"[^"]*"/g, '')
    // GUIDs / long hex / long numbers
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/\b[0-9a-f]{16,}\b/gi, '')
    .replace(/\b\d{4,}\b/g, '')
    // Trailing colon-separated value (e.g. "Expected: foo. Actual: bar")
    .replace(/[:\-–]\s*$/g, '')
    // Punctuation cleanup
    .replace(/[.;,]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (s.length > MAX_LABEL_LENGTH) {
    s = s.slice(0, MAX_LABEL_LENGTH).trim() + '…';
  }

  return s;
}

function toneFor(label: string, fallback?: ErrorPattern): { tone: PatternColorTone; pattern?: ErrorPattern } {
  for (const hint of TONE_HINTS) {
    if (hint.test.test(label)) return { tone: hint.tone, pattern: hint.pattern };
  }
  if (fallback) return { tone: PATTERN_TONE[fallback], pattern: fallback };
  return { tone: 'muted' };
}

/**
 * Group analyzed failures by a normalized signature of their error message.
 *
 * Rules:
 *  - Empty / missing messages are skipped (we still keep an "Other" bucket for
 *    failures that produced a signature but couldn't reach MIN_OCCURRENCES).
 *  - Singletons fold into "Other".
 *  - Output is sorted by count descending.
 */
export function groupFailuresByPattern(failures: AnalyzedFailure[]): PatternGroup[] {
  const counts = new Map<string, number>();

  for (const f of failures) {
    const sig = normalizeErrorSignature(f.errorMessage);
    if (!sig) continue;
    const key = sig.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Preserve a representative original-cased label per key (first occurrence wins).
  const labelByKey = new Map<string, string>();
  for (const f of failures) {
    const sig = normalizeErrorSignature(f.errorMessage);
    if (!sig) continue;
    const key = sig.toLowerCase();
    if (!labelByKey.has(key)) labelByKey.set(key, sig);
  }

  let otherCount = 0;
  const groups: PatternGroup[] = [];

  for (const [key, count] of counts) {
    if (count < MIN_OCCURRENCES) {
      otherCount += count;
      continue;
    }
    const label = labelByKey.get(key) ?? key;
    const { tone, pattern } = toneFor(label);
    groups.push({ key, label, count, tone, pattern });
  }

  if (otherCount > 0) {
    groups.push({
      key: '__other__',
      label: 'Other',
      count: otherCount,
      tone: 'muted',
      pattern: 'Other',
    });
  }

  return groups.sort((a, b) => b.count - a.count);
}
