/** Testim session / WebDriver infrastructure errors — must override flaky-KB-style triage. */
const MARKERS = ['failed to create new session', 'webdrivererror'] as const;

export const SESSION_WEBDRIVER_INFRA_FIRST_SENTENCE =
  'Infrastructure/Environment issue - Please check with testim.io support or verify local grid status.';

/** Legacy bullet form (UI / older prompts); primary output uses FIRST_SENTENCE first. */
export const SESSION_WEBDRIVER_INFRA_PRIORITY_BULLET = `• ${SESSION_WEBDRIVER_INFRA_FIRST_SENTENCE}`;

export function isSessionWebDriverInfraError(errorMessage: string | undefined | null): boolean {
  if (!errorMessage) return false;
  const t = errorMessage.toLowerCase();
  return MARKERS.some((m) => t.includes(m));
}

export function analysisHasSessionWebDriverInfraSignal(
  analysis: { signalBreakdown?: { activeSignals?: unknown } } | undefined,
): boolean {
  const s = analysis?.signalBreakdown?.activeSignals;
  if (!Array.isArray(s)) return false;
  return s.some((x) => x === 'SESSION_WEBDRIVER_INFRA');
}

export function shouldApplySessionWebDriverInfraOverride(
  errorMessage: string | undefined | null,
  analysis: { signalBreakdown?: { activeSignals?: unknown } } | undefined,
): boolean {
  return isSessionWebDriverInfraError(errorMessage) || analysisHasSessionWebDriverInfraSignal(analysis);
}

/** Remove flaky-KB / known-flaky narrative lines (SESSION_WEBDRIVER_INFRA wins). */
export function stripFlakyKbFromPriorityReason(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines
    .filter((l) => {
      const x = l.toLowerCase();
      if (x.includes('matched known flaky')) return false;
      if (x.includes('known flaky test')) return false;
      if (x.includes('flaky kb')) return false;
      if (x.includes('known flaky') && (x.includes('kb') || x.includes('flaky kb'))) return false;
      return true;
    })
    .join('\n');
}

/** Infra instruction as the very first sentence; no flaky lines above it. */
export function priorityReasonWithInfraFirstSentence(pr: string): string {
  const infra = SESSION_WEBDRIVER_INFRA_FIRST_SENTENCE;
  let body = stripFlakyKbFromPriorityReason(pr)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => {
      const stripped = l.replace(/^•\s*/, '');
      return !stripped.startsWith(infra) && !l.includes('Infrastructure/Environment issue - Please check with testim.io support');
    })
    .join('\n')
    .trim();
  return body ? `${infra}\n${body}` : infra;
}
