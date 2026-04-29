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
  return (
    c === 'Potential bug' ||
    c === 'Investigate' ||
    p === 'P0' ||
    p === 'P1'
  );
}

export function getInvestigateTriageRecommendation(input: {
  classification?: string | null;
  priority?: string | null;
}): 'Investigate' | 'Skip' {
  return aiRecommendedInvestigate(input) ? 'Investigate' : 'Skip';
}
