/** Split AI priority reason after sentence-ending punctuation (for collapsed preview). */
export const PRIORITY_REASON_SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/** Coerce LLM / API values (sometimes array or non-string) to a single display string. */
export function coercePriorityReasonText(text: unknown): string {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  if (Array.isArray(text)) {
    return text.map((x) => (x == null ? '' : typeof x === 'string' ? x : String(x))).join('\n');
  }
  return String(text);
}

export function splitPriorityReasonForToggle(text: unknown): { first: string; rest: string } {
  const normalized = coercePriorityReasonText(text).replace(/\r\n/g, '\n').trim();
  if (!normalized) return { first: '', rest: '' };
  const parts = normalized.split(PRIORITY_REASON_SENTENCE_SPLIT);
  const trimmed = parts.map((p) => p.trim()).filter(Boolean);
  if (trimmed.length <= 1) return { first: normalized, rest: '' };
  return { first: trimmed[0], rest: trimmed.slice(1).join('\n') };
}
