import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalyzedFailure } from '@/types/testim';
import { 
  AnalyzedFailureWithFeedback, 
  UserFeedback, 
  FeedbackSummary, 
  MistakePattern,
  RunDetails,
  ReportToSave,
  ResultToSave 
} from '@/types/feedback';
import { format } from 'date-fns';

export function useFeedback(failures: AnalyzedFailure[]) {
  const [failuresWithFeedback, setFailuresWithFeedback] = useState<AnalyzedFailureWithFeedback[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize failures with feedback state
  const initializeFeedback = useCallback((analyzedFailures: AnalyzedFailure[]) => {
    setFailuresWithFeedback(
      analyzedFailures
        .filter(f => f.analysis)
        .map(f => ({
          ...f,
          isReviewed: false,
          feedback: undefined
        }))
    );
  }, []);

  // Handle user feedback on a single failure
  const handleFeedback = useCallback((failureId: string, feedback: UserFeedback) => {
    setFailuresWithFeedback(prev => prev.map(f => {
      if (f.id === failureId) {
        return { ...f, feedback, isReviewed: true };
      }
      return f;
    }));
  }, []);

  // Calculate summary statistics
  const summary = useMemo((): FeedbackSummary => {
    const reviewed = failuresWithFeedback.filter(f => f.isReviewed);
    const correct = reviewed.filter(f => f.feedback?.wasCorrect);
    const incorrect = reviewed.filter(f => !f.feedback?.wasCorrect);
    
    // Calculate common mistakes
    const mistakeMap = new Map<string, MistakePattern>();
    incorrect.forEach(f => {
      if (f.analysis?.classification && f.feedback?.userClassification) {
        const key = `${f.analysis.classification}→${f.feedback.userClassification}`;
        const existing = mistakeMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          mistakeMap.set(key, {
            from: f.analysis.classification,
            to: f.feedback.userClassification,
            count: 1
          });
        }
      }
    });
    
    const commonMistakes = Array.from(mistakeMap.values())
      .sort((a, b) => b.count - a.count);

    return {
      totalAnalyzed: failuresWithFeedback.length,
      reviewedCount: reviewed.length,
      correctCount: correct.length,
      incorrectCount: incorrect.length,
      accuracyPercentage: reviewed.length > 0 
        ? (correct.length / reviewed.length) * 100 
        : 0,
      commonMistakes
    };
  }, [failuresWithFeedback]);

  // Check if review is complete
  const isReviewComplete = useMemo(() => {
    return failuresWithFeedback.length > 0 && 
           failuresWithFeedback.every(f => f.isReviewed);
  }, [failuresWithFeedback]);

  // Save report to database
  const saveReport = useCallback(async (runDetails: RunDetails) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Prepare report data - cast common_mistakes to JSON compatible format
      const reportData = {
        run_name: runDetails.name || 'Unnamed Run',
        run_date: format(runDetails.date, 'yyyy-MM-dd'),
        notes: runDetails.notes || null,
        total_analyzed: summary.totalAnalyzed,
        correct_count: summary.correctCount,
        accuracy_percentage: summary.accuracyPercentage,
        common_mistakes: JSON.parse(JSON.stringify(summary.commonMistakes))
      };

      // Insert report
      const { data: report, error: reportError } = await supabase
        .from('analysis_reports')
        .insert([reportData])
        .select()
        .single();

      if (reportError) throw reportError;

      // Prepare results data
      const resultsData: ResultToSave[] = failuresWithFeedback.map(f => ({
        report_id: report.id,
        test_name: f.testName,
        test_name_normalized: f.testNameNormalized,
        error_message: f.errorMessage || null,
        error_pattern: f.analysis?.errorPattern || null,
        ai_classification: f.analysis?.classification || 'Unknown',
        ai_priority: f.analysis?.priority || 'P3',
        ai_confidence: f.analysis?.confidence || 0,
        ai_action: f.analysis?.suggestedAction || null,
        flaky_kb_matched: f.analysis?.flakyKBMatch || false,
        user_classification: f.feedback?.userClassification || null,
        user_priority: f.feedback?.userPriority || null,
        user_action: f.feedback?.userAction || null,
        was_correct: f.feedback?.wasCorrect ?? true,
        user_notes: f.feedback?.userNotes || null,
        bug_category: f.feedback?.bugCategory || null,
        bug_link: f.feedback?.bugLink || null,
        passed_locally: f.feedback?.passedLocally || false
      }));

      // Insert results
      const { error: resultsError } = await supabase
        .from('analysis_results')
        .insert(resultsData);

      if (resultsError) throw resultsError;

      return true;
    } catch (error) {
      console.error('Failed to save report:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save report');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [failuresWithFeedback, summary]);

  // Reset feedback state
  const resetFeedback = useCallback(() => {
    setFailuresWithFeedback([]);
    setSaveError(null);
  }, []);

  return {
    failuresWithFeedback,
    summary,
    isReviewComplete,
    isSaving,
    saveError,
    initializeFeedback,
    handleFeedback,
    saveReport,
    resetFeedback
  };
}
