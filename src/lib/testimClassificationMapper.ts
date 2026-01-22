import { Classification, SuggestedAction, Priority, PreClassifiedData, AIAnalysisResult } from '@/types/testim';

/**
 * Map Testim Failure Type to our Classification system
 */
export function mapFailureTypeToClassification(failureType?: string): Classification | null {
  if (!failureType) return null;
  
  const normalized = failureType.toLowerCase().trim();
  
  // Exact mappings
  const mappings: Record<string, Classification> = {
    'bug in app': 'Potential bug',
    'bug': 'Potential bug',
    'environment issue': 'Environment / Infra Issue',
    'environment': 'Environment / Infra Issue',
    'infra': 'Environment / Infra Issue',
    'test design': 'Expected Change',
    'test update': 'Expected Change',
    'expected': 'Expected Change',
    'other': 'Likely Flaky',
    'flaky': 'Likely Flaky',
  };
  
  // Check for exact match first
  if (mappings[normalized]) {
    return mappings[normalized];
  }
  
  // Check for partial matches
  if (normalized.includes('bug')) return 'Potential bug';
  if (normalized.includes('environment') || normalized.includes('infra')) return 'Environment / Infra Issue';
  if (normalized.includes('design') || normalized.includes('update') || normalized.includes('expected')) return 'Expected Change';
  if (normalized.includes('flaky') || normalized.includes('other')) return 'Likely Flaky';
  
  return null;
}

/**
 * Map Testim Failure Sub-type to passed_locally and reason
 */
export function mapSubTypeToPassedLocally(subType?: string): {
  passedLocally: boolean;
  reason?: string;
  notes?: string;
} {
  if (!subType) return { passedLocally: false };
  
  const normalized = subType.toLowerCase().trim();
  
  // Check for "Worked locally" indicator
  if (normalized.includes('worked locally') || normalized.includes('works locally')) {
    return { passedLocally: true, reason: 'Worked locally' };
  }
  
  // Known sub-types
  const knownReasons = ['cli issue', 'reassign name', 'timeout', 'network', 'element not found'];
  for (const reason of knownReasons) {
    if (normalized.includes(reason)) {
      return { passedLocally: false, reason: subType };
    }
  }
  
  // If it's free text, put it in notes
  if (subType.length > 0) {
    return { passedLocally: false, notes: subType };
  }
  
  return { passedLocally: false };
}

/**
 * Map classification to suggested action
 * IMPORTANT: "Investigate" NEVER maps to "Open bug" - only "Verify manually" or "Rerun only"
 */
export function mapClassificationToAction(classification: Classification): SuggestedAction {
  switch (classification) {
    case 'Potential bug':
      return 'Open bug';
    case 'Expected Change':
      return 'Update shared step';
    case 'Likely Flaky':
      return 'Rerun only';
    case 'Environment / Infra Issue':
      return 'Ignore today / monitor';
    case 'Investigate':
      return 'Verify manually'; // NEVER 'Open bug' for Investigate
    default:
      return 'Rerun only';
  }
}

/**
 * Map classification to priority
 */
export function mapClassificationToPriority(classification: Classification): Priority {
  switch (classification) {
    case 'Potential bug':
      return 'P1';
    case 'Expected Change':
      return 'P2';
    case 'Likely Flaky':
      return 'P3';
    case 'Environment / Infra Issue':
      return 'P2';
    case 'Investigate':
      return 'P2'; // Medium priority for ambiguous cases
    default:
      return 'P2';
  }
}

/**
 * Convert pre-classified data to full feedback object
 */
export function convertPreClassifiedToFeedback(preClassified: PreClassifiedData): {
  classification: Classification | null;
  suggestedAction: SuggestedAction | null;
  priority: Priority | null;
  passedLocally: boolean;
  passedLocallyReason?: string;
  passedLocallyNotes?: string;
  bugLink?: string;
} {
  const classification = mapFailureTypeToClassification(preClassified.failureType);
  const passedLocallyData = mapSubTypeToPassedLocally(preClassified.failureSubType);
  
  return {
    classification,
    suggestedAction: classification ? mapClassificationToAction(classification) : null,
    priority: classification ? mapClassificationToPriority(classification) : null,
    passedLocally: passedLocallyData.passedLocally,
    passedLocallyReason: passedLocallyData.reason,
    passedLocallyNotes: passedLocallyData.notes,
    bugLink: preClassified.bugLink,
  };
}

/**
 * Convert pre-classified data to AIAnalysisResult format
 * Used for failures that are already classified in Testim
 */
export function convertPreClassifiedToAnalysis(preClassified: PreClassifiedData): AIAnalysisResult | null {
  const classification = mapFailureTypeToClassification(preClassified.failureType);
  if (!classification) return null;
  
  return {
    classification,
    confidence: 100, // User-classified = 100% confidence
    suggestedAction: mapClassificationToAction(classification),
    priority: mapClassificationToPriority(classification),
    priorityReason: `Classified in Testim as "${preClassified.failureType}"`,
    errorPattern: 'Unknown',
    requiresRerun: classification === 'Likely Flaky' || classification === 'Environment / Infra Issue',
    rerunReason: classification === 'Likely Flaky' ? 'Flaky test - rerun to verify' : 
                 classification === 'Environment / Infra Issue' ? 'Environment issue - rerun when stable' :
                 'Already classified',
    flakyKBMatch: false,
    isFromTestim: true, // Mark as coming from Testim
  };
}
