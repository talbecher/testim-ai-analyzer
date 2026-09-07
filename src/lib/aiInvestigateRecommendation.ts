/**
 * Single source of truth: should QA treat the AI output as "recommend investigate"
 * (vs skip investigation) for triage metrics and quick-review flows.
 */
export interface AIRecommendationInput {
  classification?: string | null;
  priority?: string | null;
  confidence?: number | null;
  passedLocally?: boolean | null;
  forceInvestigate?: boolean;
}

export function aiRecommendedInvestigate(input: AIRecommendationInput): boolean {
  if (input.passedLocally === true) return false;

  if (input.forceInvestigate === true) return true;

  const c = input.classification ?? undefined;
  const p = input.priority ?? undefined;
  const confidence = input.confidence;

  // Likely Flaky is always Skip — regardless of priority
  if (c === 'Likely Flaky') return false;

  // Low-confidence Investigate → Skip (even at P0/P1)
  if (c === 'Investigate') {
    if (typeof confidence === 'number' && confidence < 60) return false;
    return p === 'P0' || p === 'P1';
  }

  // Potential bug and high priority
  return c === 'Potential bug' || p === 'P0' || p === 'P1';
}

/** Measurement-only: the AI's ORIGINAL recommendation, ignoring the post-hoc passedLocally override. */
export function aiOriginalRecommendation(input: {
  classification?: string | null;
  priority?: string | null;
  confidence?: number | null;
  forceInvestigate?: boolean | null;
}): boolean {
  if (input.forceInvestigate === true) return true;
  const c = input.classification ?? undefined;
  const p = input.priority ?? undefined;
  const confidence = input.confidence;

  if (c === 'Likely Flaky') return false;
  if (c === 'Investigate') {
    if (typeof confidence === 'number' && confidence < 60) return false;
    return p === 'P0' || p === 'P1';
  }
  return c === 'Potential bug' || p === 'P0' || p === 'P1';
}

export function getInvestigateTriageRecommendation(input: AIRecommendationInput): 'Investigate' | 'Skip' {
  return aiRecommendedInvestigate(input) ? 'Investigate' : 'Skip';
}
