import { ReportResult } from '@/hooks/useReports';
import { AnalyzedFailureWithFeedback } from '@/types/feedback';
import {
  Classification,
  ErrorPattern,
  Priority,
  SuggestedAction,
} from '@/types/testim';

export function mapReportResultToFailure(
  result: ReportResult,
  wasCorrect?: boolean,
): AnalyzedFailureWithFeedback {
  return {
    id: result.id,
    originalIndex: 0,
    testName: result.test_name,
    testNameNormalized: result.test_name_normalized,
    errorMessage: result.error_message ?? undefined,
    analysis: {
      classification: result.ai_classification as Classification,
      priority: result.ai_priority as Priority,
      confidence: result.ai_confidence,
      errorPattern: (result.error_pattern ?? 'N/A') as ErrorPattern,
      priorityReason: result.ai_priority_reason ?? '',
      flakyKBMatch: result.flaky_kb_matched ?? false,
      forceInvestigate: false,
      suggestedAction: (result.ai_action ?? 'Ignore today / monitor') as SuggestedAction,
      requiresRerun: false,
      rerunReason: '',
    },
    feedback: {
      wasCorrect: wasCorrect ?? result.was_correct ?? true,
      userClassification: (result.user_classification ?? undefined) as Classification | undefined,
      passedLocally: result.passed_locally ?? false,
      requiredManualFix: result.required_manual_fix ?? false,
    },
    isReviewed: true,
  };
}
