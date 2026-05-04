/**
 * Single source of truth: should QA treat the AI output as "recommend investigate"
 * (vs skip investigation) for triage metrics and quick-review flows.
 */
export function aiRecommendedInvestigate(input: {
  classification?: string | null;
  priority?: string | null;
}): boolean {
  const c = input.classification ?? undefined;
  const p = input.priority ?? undefined;

  // Likely Flaky is always Skip — regardless of priority
  if (c === 'Likely Flaky') return false;

  // Investigate is only actionable at P0/P1
  if (c === 'Investigate') return p === 'P0' || p === 'P1';

  // Potential bug and high priority
  return c === 'Potential bug' || p === 'P0' || p === 'P1';
}

export function getInvestigateTriageRecommendation(input: {
  classification?: string | null;
  priority?: string | null;
}): 'Investigate' | 'Skip' {
  return aiRecommendedInvestigate(input) ? 'Investigate' : 'Skip';
}
