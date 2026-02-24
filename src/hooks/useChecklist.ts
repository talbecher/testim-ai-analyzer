import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FailureEntry, AnalyzedFailure, FlakyTestForAI, FailureForAI, AIAnalysisResult, ReportMode, SortOption } from '@/types/testim';
import { useRegressionBuckets } from './useRegressionBuckets';
import { parseFailuresCSV, hasPreClassifiedColumns, getPreClassifiedStats } from '@/lib/csvParsers';
import { detectErrorPattern, getPatternFlakiness, extractAssertionDetails } from '@/lib/errorPatternDetection';
import { convertPreClassifiedToFeedback, convertPreClassifiedToAnalysis } from '@/lib/testimClassificationMapper';
import { detectCoFailures, createFailureToGroupMap, getCoFailureInfo } from '@/lib/coFailureDetection';
import { useFlakyKB } from './useFlakyKB';
import { useSessionPersistence } from './useSessionPersistence';

/** Post-process a single AI analysis (flaky KB, priority, requiresRerun). */
function applyPostProcessing(
  failure: AnalyzedFailure,
  analysis: AIAnalysisResult,
  flakyKB: ReturnType<typeof useFlakyKB>
): AIAnalysisResult {
  const flakyMatch = flakyKB.findFlakyTestMatch(failure.testName);
  const isInFlakyKB = flakyMatch.matched;
  let result: AIAnalysisResult = {
    ...analysis,
    flakyKBMatch: isInFlakyKB,
    matchedFlakyTestName: flakyMatch.matchedTest?.testName,
    matchedFlakyReason: flakyMatch.matchedTest?.reason,
  };
  if (isInFlakyKB) {
    if (result.priority === 'P0') result = { ...result, priority: 'P1' };
    else if (result.priority === 'P1') result = { ...result, priority: 'P2' };
    else if (result.priority === 'P2') result = { ...result, priority: 'P3' };
    result = { ...result, priorityReason: `• Known flaky test (Flaky KB)\n${result.priorityReason}` };
  }
  if (result.classification === 'Likely Flaky' && result.confidence >= 80) {
    result = { ...result, requiresRerun: false, rerunReason: 'High confidence flaky - no rerun needed' };
  } else if (result.classification === 'Likely Flaky' && result.confidence < 70) {
    result = { ...result, requiresRerun: true, rerunReason: 'Lower confidence - verify with rerun' };
  } else if (result.classification === 'Potential bug') {
    result = { ...result, requiresRerun: false, rerunReason: 'Potential bug - needs code fix, not rerun' };
  } else if (result.classification === 'Environment / Infra Issue') {
    result = { ...result, requiresRerun: true, rerunReason: 'Environment issue - rerun when stable' };
  }
  return result;
}

export interface PreClassifiedUploadStats {
  total: number;
  classified: number;
  unclassified: number;
  withBugLink: number;
}

export interface AnalysisProgress {
  completed: number;
  total: number;
}

export function useChecklist() {
  const [failures, setFailures] = useState<AnalyzedFailure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreClassifiedMode, setIsPreClassifiedMode] = useState(false);
  const [preClassifiedStats, setPreClassifiedStats] = useState<PreClassifiedUploadStats | null>(null);
  
  // Mode detection: learning if CSV has Failure Type column, production otherwise
  const [reportMode, setReportMode] = useState<ReportMode>('production');
  
  // Regression bucket for isolated learning
  const [regressionBucket, setRegressionBucket] = useState<string | null>(null);

  const { buckets: regressionBuckets } = useRegressionBuckets();
  const flakyKB = useFlakyKB();
  const { saveAnalysisSession, loadAnalysisSession } = useSessionPersistence();

  // Auto-save to sessionStorage whenever failures change
  useEffect(() => {
    if (failures.length > 0) {
      saveAnalysisSession({
        failures,
        reportMode,
        preClassifiedStats,
        isPreClassifiedMode,
      });
    }
  }, [failures, reportMode, preClassifiedStats, isPreClassifiedMode, saveAnalysisSession]);

  // Restore session from sessionStorage
  const restoreSession = useCallback(() => {
    const session = loadAnalysisSession();
    if (session) {
      setFailures(session.failures);
      setReportMode(session.reportMode);
      setPreClassifiedStats(session.preClassifiedStats);
      setIsPreClassifiedMode(session.isPreClassifiedMode);
      return true;
    }
    return false;
  }, [loadAnalysisSession]);

  // Check if there's a session to restore
  const hasSessionToRestore = useCallback(() => {
    return loadAnalysisSession() !== null;
  }, [loadAnalysisSession]);

  // Detect mode based on CSV content
  const detectMode = useCallback((content: string): ReportMode => {
    return hasPreClassifiedColumns(content) ? 'learning' : 'production';
  }, []);

  // Check if CSV has pre-classified columns
  const detectPreClassified = useCallback((content: string): boolean => {
    return hasPreClassifiedColumns(content);
  }, []);

  // Upload and parse failures CSV
  const uploadFailures = useCallback((content: string, forcePreClassified?: boolean) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const isPreClassified = forcePreClassified ?? hasPreClassifiedColumns(content);
      setIsPreClassifiedMode(isPreClassified);
      
      // Set mode based on CSV content - this is the source of truth
      const mode = detectMode(content);
      setReportMode(mode);
      
      const parsed = parseFailuresCSV(content, isPreClassified);
      
      if (isPreClassified) {
        const stats = getPreClassifiedStats(parsed);
        setPreClassifiedStats(stats);
      } else {
        setPreClassifiedStats(null);
      }
      
      setFailures(parsed.map(f => ({ ...f, isAnalyzing: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse CSV');
    } finally {
      setIsLoading(false);
    }
  }, [detectMode]);

  // Analyze all failures with AI
  const analyzeFailures = useCallback(async (selectedRegressionBucket?: string) => {
    if (failures.length === 0) return;
    
    // Validate regression bucket selection (must be in active buckets from DB)
    if (!selectedRegressionBucket || !regressionBuckets.some((b) => b.name === selectedRegressionBucket)) {
      setError('Please select a valid regression bucket before analyzing');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    // Store the selected regression bucket
    setRegressionBucket(selectedRegressionBucket);
    
    // In learning mode: AI runs on ALL failures for prediction evaluation
    // In production mode: AI runs only on unclassified failures
    const alreadyClassified = reportMode === 'learning' 
      ? [] // In learning mode, we still want AI to predict (for comparison)
      : failures.filter(f => f.preClassified?.failureType);
    const needsAnalysis = reportMode === 'learning'
      ? failures // In learning mode, analyze ALL failures
      : failures.filter(f => !f.preClassified?.failureType);
    
    // Process already-classified failures immediately (production mode only)
    const classifiedResults: AnalyzedFailure[] = alreadyClassified.map(f => ({
      ...f,
      analysis: convertPreClassifiedToAnalysis(f.preClassified!) || undefined,
      isAnalyzing: false,
    }));
    
    // If nothing needs AI analysis (production mode with all pre-classified), we're done
    if (needsAnalysis.length === 0) {
      setFailures(classifiedResults);
      setIsAnalyzing(false);
      return;
    }
    
    // Set classified results and mark unclassified as analyzing
    setFailures(prev =>
      prev.map(f =>
        f.preClassified?.failureType
          ? { ...f, analysis: convertPreClassifiedToAnalysis(f.preClassified!) || undefined, isAnalyzing: false }
          : { ...f, isAnalyzing: true }
      )
    );

    // Co-failure and flaky context (computed once, used per row)
    const coFailureGroups = detectCoFailures(needsAnalysis);
    const failureToGroup = createFailureToGroupMap(needsAnalysis, coFailureGroups);
    const flakyTestsForAI: FlakyTestForAI[] = flakyKB.tests.map(t => ({
      testName: t.testName,
      testNameNormalized: t.testNameNormalized,
      reason: t.reason,
      notes: t.notes,
    }));

    setAnalysisProgress({ completed: 0, total: needsAnalysis.length });

    const BATCH_SIZE = 3;

    const buildFailureForAI = (failure: AnalyzedFailure): FailureForAI => {
      const patternResult = detectErrorPattern(failure.errorMessage);
      const assertionDetails = extractAssertionDetails(failure.errorMessage);
      const coFailureInfo = getCoFailureInfo(failure, needsAnalysis, failureToGroup);
      return {
        testName: failure.testName,
        testNameNormalized: failure.testNameNormalized,
        folder: failure.folder,
        failureStep: failure.failureStep,
        errorMessage: failure.errorMessage,
        duration: failure.duration,
        durationMs: failure.durationMs,
        detectedErrorPattern: patternResult.pattern,
        patternConfidence: patternResult.confidence,
        assertionDetails: patternResult.pattern === 'AssertionError' ? {
          hasExpectedActual: assertionDetails.hasExpectedActual,
          isValueMismatch: assertionDetails.isValueMismatch,
          isVisualAssertion: assertionDetails.isVisualAssertion,
          isNullUndefinedMismatch: assertionDetails.isNullUndefinedMismatch,
        } : undefined,
        coFailureInfo: coFailureInfo ? {
          isPartOfGroup: coFailureInfo.isPartOfGroup,
          groupSize: coFailureInfo.groupSize,
          sharedStep: coFailureInfo.sharedStep,
          sharedErrorPattern: coFailureInfo.sharedErrorPattern,
          otherTestsInGroup: coFailureInfo.otherTestsInGroup,
          groupConfidence: coFailureInfo.groupConfidence,
        } : undefined,
      };
    };

    for (let start = 0; start < needsAnalysis.length; start += BATCH_SIZE) {
      const batch = needsAnalysis.slice(start, start + BATCH_SIZE);
      const batchPayloads = batch.map(f => ({ failure: f, forAI: buildFailureForAI(f) }));

      const settled = await Promise.allSettled(
        batchPayloads.map(({ forAI }) =>
          supabase.functions.invoke('analyze-failures', {
            body: {
              failures: [forAI],
              flakyTests: flakyTestsForAI,
              mode: reportMode,
              regressionBucket: selectedRegressionBucket,
            },
          })
        )
      );

      for (let j = 0; j < batch.length; j++) {
        const failure = batch[j];
        const result = settled[j];
        if (result.status === 'fulfilled' && !result.value.error) {
          const results = (result.value.data?.results ?? []) as Array<{ failureId: number; analysis: AIAnalysisResult }>;
          const rawAnalysis = results[0]?.analysis;
          if (rawAnalysis) {
            const analysis = applyPostProcessing(failure, rawAnalysis, flakyKB);
            setFailures(prev =>
              prev.map(f =>
                f.originalIndex === failure.originalIndex
                  ? { ...f, analysis, isAnalyzing: false, error: undefined }
                  : f
              )
            );
          } else {
            setFailures(prev =>
              prev.map(f =>
                f.originalIndex === failure.originalIndex
                  ? { ...f, isAnalyzing: false, error: 'No analysis in response' }
                  : f
              )
            );
          }
        } else {
          const err = result.status === 'rejected' ? result.reason : result.value?.error;
          console.warn(`Analysis failed for row ${failure.originalIndex + 1} (${failure.testName}):`, err);
          setFailures(prev =>
            prev.map(f =>
              f.originalIndex === failure.originalIndex
                ? { ...f, isAnalyzing: false, error: err instanceof Error ? err.message : 'Analysis failed' }
                : f
            )
          );
        }
      }

      setAnalysisProgress(prev => (prev ? { ...prev, completed: Math.min(prev.completed + batch.length, prev.total) } : null));
    }

    setAnalysisProgress(null);
    setIsAnalyzing(false);
  }, [failures, flakyKB, reportMode, regressionBuckets]);

  // Clear all failures
  const clearFailures = useCallback(() => {
    setFailures([]);
    setError(null);
    setIsPreClassifiedMode(false);
    setPreClassifiedStats(null);
    setReportMode('production');
  }, []);

  // Get sorted failures with flexible sort options
  const getSortedFailures = useCallback((sortBy: SortOption = 'original') => {
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    
    return [...failures].sort((a, b) => {
      switch (sortBy) {
        case 'original':
          return a.originalIndex - b.originalIndex;
        case 'priority':
          // First by priority, then by confidence
          const aPriority = a.analysis?.priority ?? 'P3';
          const bPriority = b.analysis?.priority ?? 'P3';
          const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];
          if (priorityDiff !== 0) return priorityDiff;
          return (b.analysis?.confidence ?? 0) - (a.analysis?.confidence ?? 0);
        case 'confidence':
          return (b.analysis?.confidence ?? 0) - (a.analysis?.confidence ?? 0);
        case 'testName':
          return a.testName.localeCompare(b.testName);
        default:
          return a.originalIndex - b.originalIndex;
      }
    });
  }, [failures]);

  // Get summary stats
  const getStats = useCallback(() => {
    const analyzed = failures.filter(f => f.analysis);
    return {
      total: failures.length,
      analyzed: analyzed.length,
      potentialBugs: analyzed.filter(f => f.analysis?.classification === 'Potential bug').length,
      flaky: analyzed.filter(f => f.analysis?.classification === 'Likely Flaky').length,
      environment: analyzed.filter(f => f.analysis?.classification === 'Environment / Infra Issue').length,
      expectedChange: analyzed.filter(f => f.analysis?.classification === 'Expected Change').length,
      p0Count: analyzed.filter(f => f.analysis?.priority === 'P0').length,
      p1Count: analyzed.filter(f => f.analysis?.priority === 'P1').length,
      requiresRerun: analyzed.filter(f => f.analysis?.requiresRerun).length,
      flakyKBMatches: analyzed.filter(f => f.analysis?.flakyKBMatch).length,
    };
  }, [failures]);

  return {
    failures,
    getSortedFailures,
    stats: getStats(),
    isLoading,
    isAnalyzing,
    analysisProgress,
    error,
    isPreClassifiedMode,
    preClassifiedStats,
    reportMode,
    detectPreClassified,
    uploadFailures,
    analyzeFailures,
    clearFailures,
    flakyKB,
    convertPreClassifiedToFeedback,
    restoreSession,
    hasSessionToRestore,
  };
}
