import { Classification, Priority, SuggestedAction, AnalyzedFailure } from './testim';

// User feedback for a single analysis result
export interface UserFeedback {
  wasCorrect: boolean;
  userClassification?: Classification;
  userPriority?: Priority;
  userAction?: SuggestedAction;
  userNotes?: string;
  // New fields for enhanced bug tracking
  bugCategory?: string;
  bugLink?: string;
  passedLocally?: boolean;
  passedLocallyReason?: string;
  passedLocallyNotes?: string;
  // Fields for manual fix tracking (when AI said skip but manual work was needed)
  requiredManualFix?: boolean;
  manualFixType?: string;
  manualFixNotes?: string;
}

// Extended failure with review state
export interface AnalyzedFailureWithFeedback extends AnalyzedFailure {
  feedback?: UserFeedback;
  isReviewed: boolean;
}

// Summary stats for the feedback popup
export interface FeedbackSummary {
  totalAnalyzed: number;
  reviewedCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercentage: number;
  commonMistakes: MistakePattern[];
}

// Pattern of AI mistakes
export interface MistakePattern {
  from: Classification;
  to: Classification;
  count: number;
}

// Run details for saving
export interface RunDetails {
  name: string;
  date: Date;
  notes: string;
  isFeatureRollout?: boolean;
}

// For saving to database
export interface ReportToSave {
  run_name: string;
  run_date: string;
  notes: string | null;
  total_analyzed: number;
  correct_count: number;
  accuracy_percentage: number;
  common_mistakes: MistakePattern[];
}

export interface ResultToSave {
  report_id: string;
  test_name: string;
  test_name_normalized: string;
  error_message: string | null;
  error_pattern: string | null;
  ai_classification: string;
  ai_priority: string;
  ai_confidence: number;
  ai_action: string | null;
  flaky_kb_matched: boolean;
  user_classification: string | null;
  user_priority: string | null;
  user_action: string | null;
  was_correct: boolean;
  user_notes: string | null;
  // New fields for enhanced bug tracking
  bug_category: string | null;
  bug_link: string | null;
  passed_locally: boolean;
  passed_locally_reason: string | null;
  passed_locally_notes: string | null;
  // Manual fix tracking fields
  required_manual_fix: boolean;
  manual_fix_type: string | null;
  manual_fix_notes: string | null;
}

// Historical correction for AI learning
export interface HistoricalCorrection {
  test_name_normalized: string;
  error_pattern: string | null;
  ai_classification: string;
  user_classification: string;
  correction_count: number;
}
