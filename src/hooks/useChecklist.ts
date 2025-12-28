import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FailureEntry, AnalyzedFailure, FlakyTestForAI, FailureForAI, AIAnalysisResult, ReportMode } from '@/types/testim';
import { parseFailuresCSV, hasPreClassifiedColumns, getPreClassifiedStats } from '@/lib/csvParsers';
import { detectErrorPattern, getPatternFlakiness } from '@/lib/errorPatternDetection';
import { convertPreClassifiedToFeedback, convertPreClassifiedToAnalysis } from '@/lib/testimClassificationMapper';
import { useFlakyKB } from './useFlakyKB';

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
  
  const flakyKB = useFlakyKB();

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
  const analyzeFailures = useCallback(async () => {
    if (failures.length === 0) return;
    
    setIsAnalyzing(true);
    setError(null);
    
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
      // Prepare only unclassified failures for AI
      const failuresForAI: FailureForAI[] = needsAnalysis.map(f => {
        const patternResult = detectErrorPattern(f.errorMessage);
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
        };
      });
      
      // Get flaky tests for AI
      const flakyTestsForAI: FlakyTestForAI[] = flakyKB.tests.map(t => ({
        testName: t.testName,
        testNameNormalized: t.testNameNormalized,
        reason: t.reason,
        notes: t.notes,
      }));
      
      // Call edge function with mode
      const { data, error: fnError } = await supabase.functions.invoke('analyze-failures', {
        body: {
          failures: failuresForAI,
          flakyTests: flakyTestsForAI,
          mode: reportMode, // Pass mode to edge function
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
  }, [failures, flakyKB, reportMode]);

  // Clear all failures
  const clearFailures = useCallback(() => {
    setFailures([]);
    setError(null);
    setIsPreClassifiedMode(false);
    setPreClassifiedStats(null);
    setReportMode('production');
  }, []);

  // Get sorted failures (by priority, then confidence)
  const getSortedFailures = useCallback(() => {
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    
    return [...failures].sort((a, b) => {
      // First by priority
      const aPriority = a.analysis?.priority ?? 'P3';
      const bPriority = b.analysis?.priority ?? 'P3';
      const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by confidence (higher first)
      const aConf = a.analysis?.confidence ?? 0;
      const bConf = b.analysis?.confidence ?? 0;
      return bConf - aConf;
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
    sortedFailures: getSortedFailures(),
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
  };
}
