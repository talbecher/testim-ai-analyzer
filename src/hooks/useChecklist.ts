import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FailureEntry, AnalyzedFailure, FlakyTestForAI, FailureForAI, AIAnalysisResult, ReportMode, SortOption } from '@/types/testim';
import { useRegressionBuckets } from './useRegressionBuckets';
import { parseFailuresCSV, hasPreClassifiedColumns, getPreClassifiedStats } from '@/lib/csvParsers';
import { detectErrorPattern, getPatternFlakiness, extractAssertionDetails } from '@/lib/errorPatternDetection';
import { convertPreClassifiedToFeedback, convertPreClassifiedToAnalysis } from '@/lib/testimClassificationMapper';
import { detectCoFailures, createFailureToGroupMap, getCoFailureInfo } from '@/lib/coFailureDetection';
import { useFlakyKB } from './useFlakyKB';
import { useSessionPersistence } from './useSessionPersistence';
import {
  shouldApplySessionWebDriverInfraOverride,
  priorityReasonWithInfraFirstSentence,
} from '@/lib/sessionWebDriverInfra';
import { coercePriorityReasonText } from '@/lib/priorityReasonToggle';

/** Post-process a single AI analysis (flaky KB, priority, requiresRerun). */
function applyPostProcessing(
  failure: AnalyzedFailure,
  analysis: AIAnalysisResult,
  flakyKB: ReturnType<typeof useFlakyKB>
): AIAnalysisResult {
  const analysisIn: AIAnalysisResult = {
    ...analysis,
    priorityReason: coercePriorityReasonText(analysis.priorityReason as unknown),
    rerunReason: coercePriorityReasonText((analysis as { rerunReason?: unknown }).rerunReason),
  };

  const sessionWebDriverInfra = shouldApplySessionWebDriverInfraOverride(failure.errorMessage, analysisIn);

  if (sessionWebDriverInfra) {
    const pr = priorityReasonWithInfraFirstSentence(analysisIn.priorityReason || '');
    let result: AIAnalysisResult = {
      ...analysisIn,
      classification: 'Environment / Infra Issue',
      suggestedAction: 'Verify manually',
      priority: 'P1',
      confidence: Math.max(analysis.confidence ?? 0, 85),
      flakyKBMatch: false,
      matchedFlakyTestName: undefined,
      matchedFlakyReason: undefined,
      priorityReason: pr,
      requiresRerun: true,
      rerunReason:
        'Session/WebDriver infrastructure — confirm grid/session health before rerun (Flaky KB does not apply).',
      signalBreakdown: {
        bugScore: 5,
        flakyScore: 5,
        environmentScore: 88,
        investigateScore: 5,
        activeSignals: ['SESSION_WEBDRIVER_INFRA'],
      },
    };
    return result;
  }

  const flakyMatch = flakyKB.findFlakyTestMatch(failure.testName);
  const isInFlakyKB = flakyMatch.matched;
  let result: AIAnalysisResult = {
    ...analysisIn,
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

    const BATCH_SIZE = 1;
    /** Pace between rows — OpenAI free/low tiers 429 easily with sub-second bursts. */
    const BASE_ROW_DELAY_MS = 1500;
    const RATE_LIMIT_RETRIES = 2;

    const formatInvokeError = (err: unknown): string => {
      if (typeof err === 'string') return err;
      if (err instanceof Error) return err.message;
      if (err && typeof err === 'object' && 'message' in err) {
        const msg = (err as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim()) return msg;
      }
      return 'Analysis failed';
    };

    const isRateLimitMessage = (msg: string) =>
      /rate limit/i.test(msg) || /rate_limit_exceeded/i.test(msg);

    /** Prefer JSON body from non-2xx function responses (e.g. HTTP 429). */
    const extractInvokeFailureMessage = async (
      data: unknown,
      error: unknown,
    ): Promise<string> => {
      if (data && typeof data === 'object' && data !== null && 'error' in data) {
        const bodyErr = (data as { error?: unknown; code?: unknown }).error;
        const code = (data as { code?: unknown }).code;
        if (typeof bodyErr === 'string' && bodyErr.trim()) {
          if (code === 'rate_limit_exceeded' || isRateLimitMessage(bodyErr)) {
            return 'Rate limit exceeded';
          }
          return bodyErr;
        }
      }

      // FunctionsHttpError may expose the Response on `.context`
      const ctx = error && typeof error === 'object' && error !== null && 'context' in error
        ? (error as { context?: unknown }).context
        : undefined;
      if (ctx && typeof ctx === 'object' && ctx !== null && 'json' in ctx && typeof (ctx as { json: unknown }).json === 'function') {
        try {
          const body = await (ctx as Response).clone().json() as { error?: string; code?: string };
          if (body?.code === 'rate_limit_exceeded' || (body?.error && isRateLimitMessage(body.error))) {
            return 'Rate limit exceeded';
          }
          if (typeof body?.error === 'string' && body.error.trim()) return body.error;
        } catch {
          // ignore parse errors
        }
      }

      const fallback = formatInvokeError(error);
      if (isRateLimitMessage(fallback)) return 'Rate limit exceeded';
      return fallback;
    };

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

    type RowOutcome =
      | { ok: true; analysis: AIAnalysisResult }
      | { ok: false; error: string };

    const invokeOnce = async (forAI: FailureForAI): Promise<RowOutcome> => {
      const { data, error } = await supabase.functions.invoke('analyze-failures', {
        body: {
          failures: [forAI],
          flakyTests: flakyTestsForAI,
          mode: reportMode,
          regressionBucket: selectedRegressionBucket,
        },
      });

      // Legacy soft-fail body (HTTP 200 + fallback) — still handle if an old deploy is live
      const legacyFallback =
        data && (data as { fallback?: boolean; error?: string }).fallback
          ? (data as { error?: string }).error || 'AI temporarily unavailable'
          : null;

      if (!error && !legacyFallback) {
        const results = (data?.results ?? []) as Array<{ failureId: number; analysis: AIAnalysisResult }>;
        const rawAnalysis = results[0]?.analysis;
        if (rawAnalysis) return { ok: true, analysis: rawAnalysis };
        return { ok: false, error: 'No analysis in response' };
      }

      if (legacyFallback) {
        return { ok: false, error: legacyFallback };
      }

      const message = await extractInvokeFailureMessage(data, error);
      return { ok: false, error: message };
    };

    const analyzeRowWithRetries = async (forAI: FailureForAI): Promise<RowOutcome> => {
      let last: RowOutcome = { ok: false, error: 'Analysis failed' };
      for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
        last = await invokeOnce(forAI);
        if (last.ok) return last;
        if (!isRateLimitMessage(last.error) || attempt === RATE_LIMIT_RETRIES) return last;
        // 8s, 16s — give OpenAI RPM window time to recover
        const waitMs = 8000 * 2 ** attempt;
        console.warn(`Rate limited; waiting ${waitMs}ms before retry ${attempt + 1}/${RATE_LIMIT_RETRIES}`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
      return last;
    };

    let successCount = 0;
    let failCount = 0;
    let lastFailMessage = '';

    for (let start = 0; start < needsAnalysis.length; start += BATCH_SIZE) {
      const batch = needsAnalysis.slice(start, start + BATCH_SIZE);

      for (const failure of batch) {
        const forAI = buildFailureForAI(failure);
        const outcome = await analyzeRowWithRetries(forAI);

        if (outcome.ok) {
          successCount += 1;
          const analysis = applyPostProcessing(failure, outcome.analysis, flakyKB);
          setFailures(prev =>
            prev.map(f =>
              f.originalIndex === failure.originalIndex
                ? { ...f, analysis, isAnalyzing: false, error: undefined }
                : f
            )
          );
        } else {
          failCount += 1;
          lastFailMessage = outcome.error;
          console.warn(`Analysis failed for row ${failure.originalIndex + 1} (${failure.testName}):`, outcome.error);
          setFailures(prev =>
            prev.map(f =>
              f.originalIndex === failure.originalIndex
                ? { ...f, isAnalyzing: false, error: outcome.error }
                : f
            )
          );
        }
      }

      setAnalysisProgress(prev => (prev ? { ...prev, completed: Math.min(prev.completed + batch.length, prev.total) } : null));

      if (start + BATCH_SIZE < needsAnalysis.length) {
        const delay = failCount > successCount ? BASE_ROW_DELAY_MS * 2 : BASE_ROW_DELAY_MS;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    if (failCount > 0 && successCount === 0) {
      const rateLimited = isRateLimitMessage(lastFailMessage);
      const msg = rateLimited
        ? `OpenAI rate limit exceeded — all ${failCount} analyses failed. Wait a minute, then try Analyze again. (Replace OPENAI_API_KEY in Supabase secrets if this persists.)`
        : `All ${failCount} analyses failed${lastFailMessage ? `: ${lastFailMessage}` : ''}. Wait a minute and try Analyze again.`;
      setError(msg);
      toast.error(rateLimited ? 'OpenAI rate limit exceeded' : 'Analysis failed', { description: msg });
    } else if (failCount > 0) {
      const rateLimited = isRateLimitMessage(lastFailMessage);
      const msg = rateLimited
        ? `${failCount} of ${successCount + failCount} analyses hit OpenAI rate limits. Successful rows are shown below — wait and re-run Analyze for the rest.`
        : `${failCount} of ${successCount + failCount} analyses failed${lastFailMessage ? ` (e.g. ${lastFailMessage})` : ''}. Successful rows are shown below.`;
      setError(msg);
      toast.error(rateLimited ? 'OpenAI rate limit exceeded' : 'Some analyses failed', { description: msg });
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
