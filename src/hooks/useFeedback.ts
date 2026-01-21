import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalyzedFailure, ReportMode, PreClassifiedData, AIAnalysisResult } from '@/types/testim';
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
import { convertPreClassifiedToFeedback } from '@/lib/testimClassificationMapper';
import { useSessionPersistence } from './useSessionPersistence';

// Did AI recommend investigation? (based on classification and priority)
const aiRecommendedInvestigate = (analysis: AIAnalysisResult | undefined): boolean => {
  if (!analysis) return false;
  return analysis.classification === 'Potential bug' || 
         analysis.priority === 'P0' || 
         analysis.priority === 'P1';
};

// Did this actually require manual work? (based on human classification)
const requiredManualWork = (preClassified: PreClassifiedData | undefined): boolean => {
  if (!preClassified?.failureType) return false;
  const type = preClassified.failureType.toLowerCase();
  const subType = preClassified.failureSubType?.toLowerCase() || '';
  
  // Worked locally = NO manual work needed
  if (subType.includes('worked locally') || subType.includes('works locally')) {
    return false;
  }
  
  // Bug in App = manual work needed
  if (type.includes('bug')) return true;
  
  // Test design/update/reassign = manual work needed  
  if (type.includes('test design') || type.includes('update') || type.includes('ui')) return true;
  if (subType.includes('reassign')) return true;
  
  // Environment/Infra = manual work needed
  if (type.includes('environment') || type.includes('infra')) return true;
  
  return true; // Default: assume manual work needed
};

export function useFeedback(failures: AnalyzedFailure[], reportMode: ReportMode = 'production') {
  const [failuresWithFeedback, setFailuresWithFeedback] = useState<AnalyzedFailureWithFeedback[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { saveFeedbackSession, loadFeedbackSession } = useSessionPersistence();

  // Auto-save feedback to sessionStorage whenever it changes
  useEffect(() => {
    if (failuresWithFeedback.length > 0) {
      saveFeedbackSession(failuresWithFeedback);
    }
  }, [failuresWithFeedback, saveFeedbackSession]);

  // Restore feedback session
  const restoreFeedbackSession = useCallback(() => {
    const session = loadFeedbackSession();
    if (session) {
      setFailuresWithFeedback(session.failuresWithFeedback);
      return true;
    }
    return false;
  }, [loadFeedbackSession]);

  // Check if there's feedback to restore
  const hasFeedbackToRestore = useCallback(() => {
    return loadFeedbackSession() !== null;
  }, [loadFeedbackSession]);

  // Initialize failures with feedback state, auto-populating pre-classified entries
  const initializeFeedback = useCallback((analyzedFailures: AnalyzedFailure[]) => {
    setFailuresWithFeedback(
      analyzedFailures
        .filter(f => f.analysis)
        .map(f => {
          // Check if this failure has pre-classified data
          if (f.preClassified?.failureType) {
            const mapped = convertPreClassifiedToFeedback(f.preClassified);
            
            // Auto-fill feedback from pre-classification
            // wasCorrect is based on whether AI recommendation matched actual need for manual work
            const autoFeedback: UserFeedback = {
              wasCorrect: aiRecommendedInvestigate(f.analysis) === requiredManualWork(f.preClassified),
              userClassification: mapped.classification || f.analysis?.classification,
              userPriority: mapped.priority || f.analysis?.priority,
              userAction: mapped.suggestedAction || f.analysis?.suggestedAction,
              passedLocally: mapped.passedLocally,
              passedLocallyReason: mapped.passedLocallyReason,
              passedLocallyNotes: mapped.passedLocallyNotes,
              bugLink: mapped.bugLink,
            };

            return {
              ...f,
              isReviewed: true, // Pre-classified = already reviewed
              feedback: autoFeedback
            };
          }

          return {
            ...f,
            isReviewed: false,
            feedback: undefined
          };
        })
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
      // Prepare report data with mode and feature rollout flag
      const reportData = {
        run_name: runDetails.name || 'Unnamed Run',
        run_date: format(runDetails.date, 'yyyy-MM-dd'),
        notes: runDetails.notes || null,
        total_analyzed: summary.totalAnalyzed,
        correct_count: summary.correctCount,
        accuracy_percentage: summary.accuracyPercentage,
        common_mistakes: JSON.parse(JSON.stringify(summary.commonMistakes)),
        mode: reportMode, // Save mode to database
        is_feature_rollout: runDetails.isFeatureRollout || false // Exclude from AI learning
      };

      // Insert report
      const { data: report, error: reportError } = await supabase
        .from('analysis_reports')
        .insert([reportData])
        .select()
        .single();

      if (reportError) throw reportError;

      // Prepare results data with is_in_flaky_kb
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
        is_in_flaky_kb: f.analysis?.flakyKBMatch || false, // New field
        user_classification: f.feedback?.userClassification || null,
        user_priority: f.feedback?.userPriority || null,
        user_action: f.feedback?.userAction || null,
        was_correct: f.feedback?.wasCorrect ?? true,
        user_notes: f.feedback?.userNotes || null,
        bug_category: f.feedback?.bugCategory || null,
        bug_link: f.feedback?.bugLink || null,
        passed_locally: f.feedback?.passedLocally || false,
        passed_locally_reason: f.feedback?.passedLocallyReason || null,
        passed_locally_notes: f.feedback?.passedLocallyNotes || null,
        required_manual_fix: f.feedback?.requiredManualFix || false,
        manual_fix_type: f.feedback?.manualFixType || null,
        manual_fix_notes: f.feedback?.manualFixNotes || null
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
  }, [failuresWithFeedback, summary, reportMode]);

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
    resetFeedback,
    restoreFeedbackSession,
    hasFeedbackToRestore,
  };
}
