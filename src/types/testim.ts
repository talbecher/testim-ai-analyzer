// Testim Morning Checklist Types

// Report mode - Learning for evaluation, Production for decision support
export type ReportMode = 'learning' | 'production';

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
  | 'Expected Change'
  | 'Investigate';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type SuggestedAction = 
  | 'Open bug' 
  | 'Update shared step' 
  | 'Rerun only' 
  | 'Ignore today / monitor'
  | 'Verify manually'
  | 'Skip';

// Regression bucket name (list is dynamic from DB; see useRegressionBuckets)
export type RegressionBucket = string;

// Regression test history for run-to-run comparison
export interface RegressionTestHistory {
  testNameNormalized: string;
  totalRunsInRegression: number;
  failCountInRegression: number;
  passedLocallyCount: number;
  currentStreak: number;
  isFirstSeenInRegression: boolean;
  isFirstSeenGlobally: boolean;
  isIntermittent: boolean;
  recentPassRate: number;
}

// Streak analysis for intermittent detection
export interface TestStreakInfo {
  totalRuns: number;
  failedRuns: number;
  passedLocallyRuns: number;
  currentStreak: 'pass' | 'fail' | 'alternating';
  streakLength: number;
  alternationCount: number;
  isIntermittent: boolean;          // 2+ alternations in 4+ runs
  isConsistentFailure: boolean;     // 3+ consecutive fails
  lastClassifications: string[];
}

/** Global cross-run history (server-computed; implicit pass = not in failures for that upload). */
export type TestHistoryPattern =
  | 'first-seen'
  | 'was-passing-now-failing'
  | 'consistent-failure'
  | 'intermittent'
  | 'sporadic-failure';

export interface TestHistoryRunDetail {
  outcome: 'pass' | 'fail';
  runName?: string;
  runDate?: string;
  bucket?: string;
  aiClassification?: string;
  aiPriority?: string;
  /** Present on fail squares when analysis_results row includes feedback. */
  passedLocally?: boolean | null;
  wasCorrect?: boolean | null;
  userClassification?: string | null;
  requiredManualFix?: boolean | null;
  bugLink?: string | null;
}

export interface TestHistory {
  totalRunsKnown: number;
  failedRuns: number;
  passedRuns: number;
  lastNOutcomes: ('pass' | 'fail')[];
  lastNRunDetails?: TestHistoryRunDetail[];
  currentFailStreak: number;
  currentPassStreak: number;
  recentPassRate: number;
  isFirstSeenGlobally: boolean;
  pattern: TestHistoryPattern;
}

// Co-failure information for AI analysis
export interface CoFailureInfoForAI {
  isPartOfGroup: boolean;
  groupSize: number;
  sharedStep?: string;
  sharedErrorPattern?: string;
  otherTestsInGroup: string[];
  groupConfidence: number;
}

// Assertion details for better bug/flaky differentiation
export interface AssertionDetailsForAI {
  hasExpectedActual: boolean;
  isValueMismatch: boolean;
  isVisualAssertion: boolean;
  isNullUndefinedMismatch: boolean;
}

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

// Sort options for failure list
export type SortOption = 'original' | 'priority' | 'confidence' | 'testName';

// CSV Failure Entry
export interface FailureEntry {
  id: string;
  originalIndex: number;
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

// Signal breakdown for transparency
export interface SignalBreakdownData {
  bugScore: number;
  flakyScore: number;
  environmentScore: number;
  investigateScore: number;
  activeSignals: string[];
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
  
  // NEW: Enhanced signals for transparency
  signalBreakdown?: SignalBreakdownData;
  coFailureInfo?: CoFailureInfoForAI;
  streakInfo?: TestStreakInfo;
  assertionDetails?: AssertionDetailsForAI;
  /** Global upload history (last ~30 runs in DB); attached by Edge, not from LLM JSON. */
  history?: TestHistory;
  /** True when RAG historical similar-failures context was injected server-side. */
  rag_used?: boolean;
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
  
  // Enhanced signals for AI analysis (client sends assertionDetails, coFailureInfo; edge adds streakInfo + history)
  assertionDetails?: AssertionDetailsForAI;
  coFailureInfo?: CoFailureInfoForAI;
  streakInfo?: TestStreakInfo;
  history?: TestHistory;
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
