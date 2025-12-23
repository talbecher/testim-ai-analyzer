import { supabase } from '@/integrations/supabase/client';
import { HistoricalCorrection } from '@/types/feedback';

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
