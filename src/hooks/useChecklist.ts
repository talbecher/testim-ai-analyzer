import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FailureEntry, AnalyzedFailure, FlakyTestForAI, FailureForAI, AIAnalysisResult } from '@/types/testim';
import { parseFailuresCSV } from '@/lib/csvParsers';
import { detectErrorPattern, getPatternFlakiness } from '@/lib/errorPatternDetection';
import { useFlakyKB } from './useFlakyKB';

export function useChecklist() {
  const [failures, setFailures] = useState<AnalyzedFailure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const flakyKB = useFlakyKB();

  // Upload and parse failures CSV
  const uploadFailures = useCallback((content: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const parsed = parseFailuresCSV(content);
      setFailures(parsed.map(f => ({ ...f, isAnalyzing: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse CSV');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Analyze all failures with AI
  const analyzeFailures = useCallback(async () => {
    if (failures.length === 0) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    // Mark all as analyzing
    setFailures(prev => prev.map(f => ({ ...f, isAnalyzing: true })));
    
    try {
      // Prepare failures for AI with pre-processing
      const failuresForAI: FailureForAI[] = failures.map(f => {
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
      
      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke('analyze-failures', {
        body: {
          failures: failuresForAI,
          flakyTests: flakyTestsForAI,
        },
      });
      
      if (fnError) throw fnError;
      
      const results = data.results as Array<{ failureId: number; analysis: AIAnalysisResult }>;
      
      // Apply results
      setFailures(prev => prev.map((f, idx) => {
        const result = results.find(r => r.failureId === idx);
        
        // Post-processing: check Flaky KB match
        const flakyMatch = flakyKB.findFlakyTestMatch(f.testName);
        
        let analysis = result?.analysis;
        if (analysis && flakyMatch.matched) {
          analysis = {
            ...analysis,
            flakyKBMatch: true,
            matchedFlakyTestName: flakyMatch.matchedTest?.testName,
            matchedFlakyReason: flakyMatch.matchedTest?.reason,
          };
          
          // If in Flaky KB, adjust priority down one level
          if (analysis.priority === 'P0') analysis.priority = 'P1';
          else if (analysis.priority === 'P1') analysis.priority = 'P2';
          else if (analysis.priority === 'P2') analysis.priority = 'P3';
          
          // Add KB match to priority reason
          analysis.priorityReason = `• Known flaky test (Flaky KB)\n${analysis.priorityReason}`;
        }
        
        // Post-processing: adjust requiresRerun based on classification and confidence
        if (analysis) {
          if (analysis.classification === 'Likely Flaky' && analysis.confidence >= 80) {
            analysis.requiresRerun = false;
            analysis.rerunReason = 'High confidence flaky - no rerun needed';
          } else if (analysis.classification === 'Likely Flaky' && analysis.confidence < 70) {
            analysis.requiresRerun = true;
            analysis.rerunReason = 'Lower confidence - verify with rerun';
          } else if (analysis.classification === 'Real Bug') {
            analysis.requiresRerun = false;
            analysis.rerunReason = 'Real bug - needs code fix, not rerun';
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
      }));
    } catch (e) {
      console.error('Analysis failed:', e);
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setFailures(prev => prev.map(f => ({ ...f, isAnalyzing: false, error: 'Analysis failed' })));
    } finally {
      setIsAnalyzing(false);
    }
  }, [failures, flakyKB]);

  // Clear all failures
  const clearFailures = useCallback(() => {
    setFailures([]);
    setError(null);
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
      realBugs: analyzed.filter(f => f.analysis?.classification === 'Real Bug').length,
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
    uploadFailures,
    analyzeFailures,
    clearFailures,
    flakyKB,
  };
}
