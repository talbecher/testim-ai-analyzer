import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PatternType = 'correction' | 'passed_locally' | 'manual_fix' | 'notes_analysis';
export type Importance = 'critical' | 'high' | 'normal';

export interface LearningPattern {
  id: string;
  pattern_type: PatternType;
  error_pattern: string | null;
  test_name_pattern: string | null;
  ai_classification: string | null;
  correct_classification: string | null;
  occurrence_count: number;
  importance: Importance;
  user_notes_pattern: string | null;
  extracted_keywords: string[] | null;
  created_at: string;
  last_updated: string;
}

// Human-readable explanation for patterns
export interface PatternExplanation {
  aiRecommendation: 'Investigate' | 'Skip';
  actualOutcome: string;
  wasAIWrong: boolean;
  title: string;
  description: string;
  userNotes: string[];
  whatAILearned: string;
}

// Determine if AI would recommend "Investigate" based on classification
function getAIRecommendation(classification: string | null): 'Investigate' | 'Skip' {
  if (!classification) return 'Skip';
  if (classification === 'Potential bug') return 'Investigate';
  return 'Skip';
}

// Generate human-readable explanation for a pattern
export function explainPattern(pattern: LearningPattern): PatternExplanation {
  const aiRec = getAIRecommendation(pattern.ai_classification);
  const correctRec = getAIRecommendation(pattern.correct_classification);
  
  // Parse user notes into array
  const userNotes = pattern.user_notes_pattern
    ? pattern.user_notes_pattern.split(' | ').filter(n => n.trim())
    : [];

  // For notes_analysis patterns
  if (pattern.pattern_type === 'notes_analysis') {
    const keyword = pattern.extracted_keywords?.[0] || 'Unknown';
    return {
      aiRecommendation: 'Skip',
      actualOutcome: pattern.correct_classification || 'Unknown',
      wasAIWrong: true,
      title: `Keyword Pattern: "${keyword}"`,
      description: pattern.user_notes_pattern || 'Pattern identified from user notes',
      userNotes: [],
      whatAILearned: `When notes contain "${keyword}" → likely "${pattern.correct_classification}"`
    };
  }

  // For passed_locally patterns
  if (pattern.pattern_type === 'passed_locally') {
    return {
      aiRecommendation: aiRec,
      actualOutcome: 'Passed locally (no real bug)',
      wasAIWrong: aiRec === 'Investigate',
      title: 'False Positive: Passed Locally',
      description: `AI classified as "${pattern.ai_classification}" but test passed in local verification`,
      userNotes,
      whatAILearned: pattern.error_pattern
        ? `When error pattern is "${pattern.error_pattern}" and classified as "${pattern.ai_classification}" → likely a false positive, recommend Skip`
        : `Similar tests to "${pattern.test_name_pattern}" often pass locally → recommend Skip`
    };
  }

  // For manual_fix patterns
  if (pattern.pattern_type === 'manual_fix') {
    const fixType = pattern.correct_classification || 'Manual fix';
    return {
      aiRecommendation: aiRec,
      actualOutcome: `Required manual work: ${fixType}`,
      wasAIWrong: aiRec === 'Skip',
      title: `Manual Work Needed: ${fixType}`,
      description: `AI said "${aiRec}" but manual intervention was required (${fixType})`,
      userNotes,
      whatAILearned: `When error pattern is "${pattern.error_pattern || 'similar'}" and fix type is "${fixType}" → recommend Investigate`
    };
  }

  // For correction patterns
  // Check if this is a "same classification" case (should be filtered out, but handle gracefully)
  if (pattern.ai_classification === pattern.correct_classification) {
    return {
      aiRecommendation: aiRec,
      actualOutcome: pattern.correct_classification || 'Unknown',
      wasAIWrong: false,
      title: 'Classification Confirmed',
      description: `AI classification "${pattern.ai_classification}" was confirmed`,
      userNotes,
      whatAILearned: 'Classification was correct - no learning needed'
    };
  }

  // Real correction
  const wasWrong = aiRec !== correctRec;
  return {
    aiRecommendation: aiRec,
    actualOutcome: `Actually: ${pattern.correct_classification}`,
    wasAIWrong: wasWrong,
    title: wasWrong
      ? `AI said "${aiRec}" but needed "${correctRec === 'Investigate' ? 'Investigation' : 'Skip'}"`
      : `Classification changed: ${pattern.ai_classification} → ${pattern.correct_classification}`,
    description: wasWrong
      ? `AI recommended ${aiRec} (${pattern.ai_classification}), but the correct action was ${correctRec} (${pattern.correct_classification})`
      : `AI recommendation was correct, but classification was refined from "${pattern.ai_classification}" to "${pattern.correct_classification}"`,
    userNotes,
    whatAILearned: pattern.error_pattern
      ? `When error pattern is "${pattern.error_pattern}" → classify as "${pattern.correct_classification}" (not "${pattern.ai_classification}")`
      : `Similar failures should be classified as "${pattern.correct_classification}"`
  };
}

export function useLearningPatterns() {
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('learning_patterns')
        .select('*')
        .order('occurrence_count', { ascending: false });

      if (fetchError) throw fetchError;

      // Filter out patterns where AI classification equals correct classification
      // (these are not real corrections)
      const realPatterns = (data || []).filter(p => {
        // Keep notes_analysis patterns always
        if (p.pattern_type === 'notes_analysis') return true;
        // Keep passed_locally and manual_fix patterns always (these are real learnings)
        if (p.pattern_type === 'passed_locally' || p.pattern_type === 'manual_fix') return true;
        // For corrections, filter out same-to-same
        return p.ai_classification !== p.correct_classification;
      }) as LearningPattern[];

      setPatterns(realPatterns);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patterns';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get patterns grouped by type for display
  const getGroupedPatterns = useCallback(() => {
    const groups = {
      wrongRecommendations: [] as (LearningPattern & { explanation: PatternExplanation })[],
      refinedClassifications: [] as (LearningPattern & { explanation: PatternExplanation })[],
      notesInsights: [] as (LearningPattern & { explanation: PatternExplanation })[],
    };

    patterns.forEach(pattern => {
      const explanation = explainPattern(pattern);
      const withExplanation = { ...pattern, explanation };

      if (pattern.pattern_type === 'notes_analysis') {
        groups.notesInsights.push(withExplanation);
      } else if (explanation.wasAIWrong) {
        groups.wrongRecommendations.push(withExplanation);
      } else {
        groups.refinedClassifications.push(withExplanation);
      }
    });

    return groups;
  }, [patterns]);

  // Get statistics
  const getStats = useCallback(() => {
    const grouped = getGroupedPatterns();
    return {
      totalPatterns: patterns.length,
      wrongRecommendations: grouped.wrongRecommendations.reduce((sum, p) => sum + p.occurrence_count, 0),
      refinedClassifications: grouped.refinedClassifications.reduce((sum, p) => sum + p.occurrence_count, 0),
      notesInsights: grouped.notesInsights.length,
      criticalPatterns: patterns.filter(p => p.importance === 'critical').length,
    };
  }, [patterns, getGroupedPatterns]);

  return {
    patterns,
    isLoading,
    error,
    fetchPatterns,
    getGroupedPatterns,
    getStats,
    explainPattern,
  };
}
