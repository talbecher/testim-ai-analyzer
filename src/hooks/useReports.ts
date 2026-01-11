import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReportData {
  id: string;
  run_name: string;
  run_date: string;
  notes: string | null;
  total_analyzed: number;
  correct_count: number;
  accuracy_percentage: number | null;
  common_mistakes: any[];
  created_at: string;
  updated_at: string | null;
}

export interface ReportResult {
  id: string;
  report_id: string;
  test_name: string;
  test_name_normalized: string;
  error_message: string | null;
  error_pattern: string | null;
  ai_classification: string;
  ai_priority: string;
  ai_confidence: number;
  ai_action: string | null;
  flaky_kb_matched: boolean | null;
  user_classification: string | null;
  user_priority: string | null;
  user_action: string | null;
  was_correct: boolean | null;
  user_notes: string | null;
  bug_category: string | null;
  bug_link: string | null;
  passed_locally: boolean | null;
  passed_locally_reason: string | null;
  passed_locally_notes: string | null;
  required_manual_fix: boolean | null;
  manual_fix_type: string | null;
  manual_fix_notes: string | null;
  created_at: string;
}

export interface LearningInsight {
  pattern: string | null;
  aiClassification: string;
  userClassification: string;
  count: number;
}

export function useReports() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [currentResults, setCurrentResults] = useState<ReportResult[]>([]);
  const [learningInsights, setLearningInsights] = useState<LearningInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('analysis_reports')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;
      setReports((data || []) as ReportData[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch reports';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReportById = useCallback(async (reportId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch report
      const { data: reportData, error: reportError } = await supabase
        .from('analysis_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError) throw reportError;
      setCurrentReport(reportData as ReportData);

      // Fetch results
      const { data: resultsData, error: resultsError } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (resultsError) throw resultsError;
      setCurrentResults((resultsData || []) as ReportResult[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch report';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateReport = useCallback(async (reportId: string, updates: Partial<ReportData>) => {
    setIsLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('analysis_reports')
        .update({
          run_name: updates.run_name,
          notes: updates.notes,
          accuracy_percentage: updates.accuracy_percentage,
          correct_count: updates.correct_count,
          common_mistakes: updates.common_mistakes,
        })
        .eq('id', reportId);

      if (updateError) throw updateError;
      toast.success('Report updated successfully');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update report';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateResult = useCallback(async (resultId: string, updates: Partial<ReportResult>) => {
    try {
      const { error: updateError } = await supabase
        .from('analysis_results')
        .update({
          user_classification: updates.user_classification,
          user_priority: updates.user_priority,
          user_action: updates.user_action,
          user_notes: updates.user_notes,
          was_correct: updates.was_correct,
          bug_category: updates.bug_category,
          bug_link: updates.bug_link,
          passed_locally: updates.passed_locally,
          passed_locally_reason: updates.passed_locally_reason,
          passed_locally_notes: updates.passed_locally_notes,
        })
        .eq('id', resultId);

      if (updateError) throw updateError;
      
      // Update local state
      setCurrentResults(prev => 
        prev.map(r => r.id === resultId ? { ...r, ...updates } : r)
      );
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update result';
      toast.error(message);
      return false;
    }
  }, []);

  const deleteReport = useCallback(async (reportId: string) => {
    setIsLoading(true);
    try {
      // Delete results first (cascade should handle this, but being explicit)
      const { error: resultsError } = await supabase
        .from('analysis_results')
        .delete()
        .eq('report_id', reportId);

      if (resultsError) throw resultsError;

      // Delete report
      const { error: reportError } = await supabase
        .from('analysis_reports')
        .delete()
        .eq('id', reportId);

      if (reportError) throw reportError;

      setReports(prev => prev.filter(r => r.id !== reportId));
      toast.success('Report deleted');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete report';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLearningInsights = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all corrections where AI was wrong - ONLY from learning mode reports
      const { data, error: fetchError } = await supabase
        .from('analysis_results')
        .select(`
          error_pattern, 
          ai_classification, 
          user_classification,
          analysis_reports!inner(mode)
        `)
        .eq('was_correct', false)
        .eq('analysis_reports.mode', 'learning')
        .not('user_classification', 'is', null);

      if (fetchError) throw fetchError;

      // Aggregate by pattern
      const insightMap = new Map<string, LearningInsight>();
      (data || []).forEach(row => {
        const key = `${row.error_pattern}|${row.ai_classification}|${row.user_classification}`;
        const existing = insightMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          insightMap.set(key, {
            pattern: row.error_pattern,
            aiClassification: row.ai_classification,
            userClassification: row.user_classification!,
            count: 1,
          });
        }
      });

      const insights = Array.from(insightMap.values())
        .sort((a, b) => b.count - a.count);
      
      setLearningInsights(insights);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch learning insights';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getLearningStats = useCallback(async () => {
    try {
      const { data: corrections, error: corrError } = await supabase
        .from('analysis_results')
        .select('id')
        .eq('was_correct', false)
        .not('user_classification', 'is', null);

      const { data: passedLocally, error: plError } = await supabase
        .from('analysis_results')
        .select('id')
        .eq('passed_locally', true);

      return {
        totalCorrections: corrections?.length || 0,
        totalPassedLocally: passedLocally?.length || 0,
      };
    } catch {
      return { totalCorrections: 0, totalPassedLocally: 0 };
    }
  }, []);

  return {
    reports,
    currentReport,
    currentResults,
    learningInsights,
    isLoading,
    error,
    fetchReports,
    fetchReportById,
    updateReport,
    updateResult,
    deleteReport,
    fetchLearningInsights,
    getLearningStats,
    setCurrentReport,
    setCurrentResults,
  };
}
