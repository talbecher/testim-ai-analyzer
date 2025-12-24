// Testim Morning Checklist Types

export type ErrorPattern = 
  | 'Element not found' 
  | 'Timeout' 
  | 'AssertionError' 
  | 'Network error' 
  | 'Null/Undefined' 
  | 'Other' 
  | 'Unknown';

export type Classification = 
  | 'Potential bug' 
  | 'Likely Flaky' 
  | 'Environment / Infra Issue' 
  | 'Expected Change';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type SuggestedAction = 
  | 'Open bug' 
  | 'Update shared step' 
  | 'Rerun only' 
  | 'Ignore today / monitor';

// Flaky Knowledge Base
export interface FlakyTest {
  id: string;
  testName: string;
  testNameNormalized: string;
  reason?: string;
  notes?: string;
  lastReviewed?: string;
  createdAt: string;
}

export interface FlakyKBData {
  tests: FlakyTest[];
  lastUpdated: string | null;
}

// Pre-classified data from Testim export
export interface PreClassifiedData {
  failureType?: string;      // "Bug in app", "Environment Issue", "Test design", "Other"
  failureSubType?: string;   // "Worked locally", "CLI Issue", etc.
  bugLink?: string;          // Link To Issue
  testimResultUrl?: string;  // Test Result URL
}

// CSV Failure Entry
export interface FailureEntry {
  id: string;
  testName: string;
  testNameNormalized: string;
  folder?: string;
  failureStep?: string;
  errorMessage?: string;
  status?: string;
  duration?: string;
  durationMs?: number;
  preClassified?: PreClassifiedData;
}

// AI Analysis Result
export interface AIAnalysisResult {
  classification: Classification;
  confidence: number;
  suggestedAction: SuggestedAction;
  priority: Priority;
  priorityReason: string;
  errorPattern: ErrorPattern;
  requiresRerun: boolean;
  rerunReason: string;
  flakyKBMatch: boolean;
  matchedFlakyTestName?: string;
  matchedFlakyReason?: string;
  isFromTestim?: boolean; // True if classification came from Testim export
}

// Combined Failure with Analysis
export interface AnalyzedFailure extends FailureEntry {
  analysis?: AIAnalysisResult;
  isAnalyzing?: boolean;
  error?: string;
}

// For sending to AI
export interface FailureForAI {
  testName: string;
  testNameNormalized: string;
  folder?: string;
  failureStep?: string;
  errorMessage?: string;
  duration?: string;
  durationMs?: number;
  detectedErrorPattern: ErrorPattern;
  patternConfidence: number;
}

export interface FlakyTestForAI {
  testName: string;
  testNameNormalized: string;
  reason?: string;
  notes?: string;
}

// Fuzzy Match Result
export interface FuzzyMatchResult {
  matched: boolean;
  confidence: number;
  matchedTest?: FlakyTest;
}
