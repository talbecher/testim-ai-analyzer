import { supabase } from '@/integrations/supabase/client';
import { HistoricalCorrection } from '@/types/feedback';

export interface PassedLocallyPattern {
  test_name_normalized: string;
  error_pattern: string | null;
  count: number;
}

// Fetch historical corrections for AI learning
export async function fetchHistoricalCorrections(): Promise<HistoricalCorrection[]> {
  try {
    // Get corrections where user disagreed with AI
    const { data, error } = await supabase
      .from('analysis_results')
      .select('test_name_normalized, error_pattern, ai_classification, user_classification')
      .eq('was_correct', false)
      .not('user_classification', 'is', null);

    if (error) {
      console.error('Error fetching corrections:', error);
      return [];
    }

    // Aggregate corrections by pattern
    const correctionMap = new Map<string, HistoricalCorrection>();
    
    data?.forEach(row => {
      const key = `${row.test_name_normalized}|${row.error_pattern}|${row.ai_classification}|${row.user_classification}`;
      const existing = correctionMap.get(key);
      
      if (existing) {
        existing.correction_count++;
      } else {
        correctionMap.set(key, {
          test_name_normalized: row.test_name_normalized,
          error_pattern: row.error_pattern,
          ai_classification: row.ai_classification,
          user_classification: row.user_classification || '',
          correction_count: 1
        });
      }
    });

    // Sort by correction count and return top patterns
    return Array.from(correctionMap.values())
      .sort((a, b) => b.correction_count - a.correction_count)
      .slice(0, 50); // Top 50 patterns
  } catch (error) {
    console.error('Failed to fetch corrections:', error);
    return [];
  }
}

// Fetch patterns where tests passed locally (AI incorrectly flagged as bugs)
export async function fetchPassedLocallyPatterns(): Promise<PassedLocallyPattern[]> {
  try {
    const { data, error } = await supabase
      .from('analysis_results')
      .select('test_name_normalized, error_pattern')
      .eq('passed_locally', true);

    if (error) {
      console.error('Error fetching passed locally patterns:', error);
      return [];
    }

    // Aggregate by test name and error pattern
    const patternMap = new Map<string, PassedLocallyPattern>();
    
    data?.forEach(row => {
      const key = `${row.test_name_normalized}|${row.error_pattern}`;
      const existing = patternMap.get(key);
      
      if (existing) {
        existing.count++;
      } else {
        patternMap.set(key, {
          test_name_normalized: row.test_name_normalized,
          error_pattern: row.error_pattern,
          count: 1
        });
      }
    });

    return Array.from(patternMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 30); // Top 30 patterns
  } catch (error) {
    console.error('Failed to fetch passed locally patterns:', error);
    return [];
  }
}

// Format corrections for AI prompt
export function formatCorrectionsForAI(corrections: HistoricalCorrection[]): string {
  if (corrections.length === 0) return '';

  const formatted = corrections.map(c => 
    `- "${c.test_name_normalized}" with error "${c.error_pattern || 'unknown'}": AI said "${c.ai_classification}" but should be "${c.user_classification}" (corrected ${c.correction_count}x)`
  ).join('\n');

  return `
## Historical Corrections (Learn from past mistakes):
The following are patterns where the AI was previously corrected by users. Use these to improve accuracy:
${formatted}
`;
}

// Format passed locally patterns for AI prompt
export function formatPassedLocallyForAI(patterns: PassedLocallyPattern[]): string {
  if (patterns.length === 0) return '';

  const formatted = patterns.map(p => 
    `- "${p.test_name_normalized}" with error "${p.error_pattern || 'unknown'}" (passed locally ${p.count}x)`
  ).join('\n');

  return `
## Tests That Often Pass Locally (Be careful - these may NOT be real bugs):
The following tests were flagged as "Potential bug" but actually passed when run locally. 
Consider classifying these as "Likely Flaky" or "Environment / Infra Issue" instead:
${formatted}
`;
}
