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

export interface PreClassifiedUploadStats {
  total: number;
  classified: number;
  unclassified: number;
  withBugLink: number;
}

export function useChecklist() {
  const [failures, setFailures] = useState<AnalyzedFailure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    
    // Mark only the ones needing analysis as analyzing
    setFailures(prev => prev.map(f => ({ 
      ...f, 
      isAnalyzing: !f.preClassified?.failureType 
    })));
    
    try {
      // Detect co-failure groups for systemic issue detection
      const coFailureGroups = detectCoFailures(needsAnalysis);
      const failureToGroup = createFailureToGroupMap(needsAnalysis, coFailureGroups);
      
      console.log(`Detected ${coFailureGroups.length} co-failure groups`);
      
      // Prepare failures for AI with enhanced signals
      const failuresForAI: FailureForAI[] = needsAnalysis.map(f => {
        const patternResult = detectErrorPattern(f.errorMessage);
        const assertionDetails = extractAssertionDetails(f.errorMessage);
        const coFailureInfo = getCoFailureInfo(f, needsAnalysis, failureToGroup);
        
        return {
          testName: f.testName,
          testNameNormalized: f.testNameNormalized,
          folder: f.folder,
          failureStep: f.failureStep,
          errorMessage: f.errorMessage,
          duration: f.duration,
          durationMs: f.durationMs,
          detectedErrorPattern: patternResult.pattern,
          patternConfidence: patternResult.confidence,
          // Enhanced signals
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
      });
      
      // Get flaky tests for AI
      const flakyTestsForAI: FlakyTestForAI[] = flakyKB.tests.map(t => ({
        testName: t.testName,
        testNameNormalized: t.testNameNormalized,
        reason: t.reason,
        notes: t.notes,
      }));
      
      // Call edge function with mode and regression bucket
      const { data, error: fnError } = await supabase.functions.invoke('analyze-failures', {
        body: {
          failures: failuresForAI,
          flakyTests: flakyTestsForAI,
          mode: reportMode,
          regressionBucket: selectedRegressionBucket, // Pass regression bucket for isolated learning
        },
      });
      
      if (fnError) throw fnError;
      
      const results = data.results as Array<{ failureId: number; analysis: AIAnalysisResult }>;
      
      // Process AI results
      const aiAnalyzedResults: AnalyzedFailure[] = needsAnalysis.map((f, idx) => {
        const result = results.find(r => r.failureId === idx);
        
        // Post-processing: check Flaky KB match and set is_in_flaky_kb
        const flakyMatch = flakyKB.findFlakyTestMatch(f.testName);
        const isInFlakyKB = flakyMatch.matched;
        
        let analysis = result?.analysis;
        if (analysis) {
          // Add flaky KB match info
          analysis = {
            ...analysis,
            flakyKBMatch: isInFlakyKB,
            matchedFlakyTestName: flakyMatch.matchedTest?.testName,
            matchedFlakyReason: flakyMatch.matchedTest?.reason,
          };
          
          // If in Flaky KB, adjust priority down one level (as confidence signal)
          if (isInFlakyKB) {
            if (analysis.priority === 'P0') analysis.priority = 'P1';
            else if (analysis.priority === 'P1') analysis.priority = 'P2';
            else if (analysis.priority === 'P2') analysis.priority = 'P3';
            
            // Add KB match to priority reason
            analysis.priorityReason = `• Known flaky test (Flaky KB)\n${analysis.priorityReason}`;
          }
          
          // Post-processing: adjust requiresRerun based on classification and confidence
          if (analysis.classification === 'Likely Flaky' && analysis.confidence >= 80) {
            analysis.requiresRerun = false;
            analysis.rerunReason = 'High confidence flaky - no rerun needed';
          } else if (analysis.classification === 'Likely Flaky' && analysis.confidence < 70) {
            analysis.requiresRerun = true;
            analysis.rerunReason = 'Lower confidence - verify with rerun';
          } else if (analysis.classification === 'Potential bug') {
            analysis.requiresRerun = false;
            analysis.rerunReason = 'Potential bug - needs code fix, not rerun';
          } else if (analysis.classification === 'Environment / Infra Issue') {
            analysis.requiresRerun = true;
            analysis.rerunReason = 'Environment issue - rerun when stable';
          }
        }
        
        return {
          ...f,
          analysis,
          isAnalyzing: false,
        };
      });
      
      // In learning mode: merge AI predictions with human classifications
      // The human classification comes from preClassified data
      if (reportMode === 'learning') {
        const learningResults = aiAnalyzedResults.map(f => {
          // Keep the preClassified data - AI prediction is separate
          return f;
        });
        setFailures(learningResults);
      } else {
        // In production mode: merge both classified and AI-analyzed results
        setFailures([...classifiedResults, ...aiAnalyzedResults]);
      }
    } catch (e) {
      console.error('Analysis failed:', e);
      setError(e instanceof Error ? e.message : 'Analysis failed');
      // On error, still keep the classified results
      setFailures(prev => prev.map(f => ({ 
        ...f, 
        isAnalyzing: false, 
        error: f.preClassified?.failureType ? undefined : 'Analysis failed',
        analysis: f.preClassified?.failureType ? convertPreClassifiedToAnalysis(f.preClassified!) || undefined : f.analysis
      })));
    } finally {
      setIsAnalyzing(false);
    }
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
