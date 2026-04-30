/** Split AI priority reason after sentence-ending punctuation (for collapsed preview). */
export const PRIORITY_REASON_SENTENCE_SPLIT = /(?<=[.!?])\s+/;

export function splitPriorityReasonForToggle(text: string): { first: string; rest: string } {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return { first: '', rest: '' };
  const parts = normalized.split(PRIORITY_REASON_SENTENCE_SPLIT);
  const trimmed = parts.map((p) => p.trim()).filter(Boolean);
  if (trimmed.length <= 1) return { first: normalized, rest: '' };
  return { first: trimmed[0], rest: trimmed.slice(1).join('\n') };
}
