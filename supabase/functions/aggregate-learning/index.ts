import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AggregatedPattern {
  pattern_type: 'correction' | 'passed_locally' | 'manual_fix';
  error_pattern: string | null;
  test_name_pattern: string | null;
  ai_classification: string | null;
  correct_classification: string | null;
  occurrence_count: number;
  importance: 'critical' | 'high' | 'normal';
}

function calculateImportance(count: number): 'critical' | 'high' | 'normal' {
  if (count >= 5) return 'critical';
  if (count >= 3) return 'high';
  return 'normal';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting learning aggregation...');

    // 1. Fetch ALL corrections (from all modes, not just learning)
    const { data: corrections, error: corrError } = await supabase
      .from('analysis_results')
      .select('test_name_normalized, error_pattern, ai_classification, user_classification')
      .eq('was_correct', false)
      .not('user_classification', 'is', null);

    if (corrError) throw corrError;

    // 2. Fetch all passed_locally patterns
    const { data: passedLocally, error: plError } = await supabase
      .from('analysis_results')
      .select('test_name_normalized, error_pattern, ai_classification, passed_locally_reason')
      .eq('passed_locally', true);

    if (plError) throw plError;

    // 3. Fetch all manual_fix patterns
    const { data: manualFixes, error: mfError } = await supabase
      .from('analysis_results')
      .select('test_name_normalized, error_pattern, ai_classification, manual_fix_type')
      .eq('required_manual_fix', true);

    if (mfError) throw mfError;

    console.log(`Found: ${corrections?.length || 0} corrections, ${passedLocally?.length || 0} passed locally, ${manualFixes?.length || 0} manual fixes`);

    // Aggregate patterns
    const patternMap = new Map<string, AggregatedPattern>();

    // Process corrections
    corrections?.forEach(row => {
      const key = `correction|${row.error_pattern || 'general'}|${row.ai_classification}|${row.user_classification}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.occurrence_count++;
        existing.importance = calculateImportance(existing.occurrence_count);
      } else {
        patternMap.set(key, {
          pattern_type: 'correction',
          error_pattern: row.error_pattern,
          test_name_pattern: null,
          ai_classification: row.ai_classification,
          correct_classification: row.user_classification,
          occurrence_count: 1,
          importance: 'normal'
        });
      }
    });

    // Process passed_locally
    passedLocally?.forEach(row => {
      const key = `passed_locally|${row.error_pattern || 'general'}|${row.test_name_normalized}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.occurrence_count++;
        existing.importance = calculateImportance(existing.occurrence_count);
      } else {
        patternMap.set(key, {
          pattern_type: 'passed_locally',
          error_pattern: row.error_pattern,
          test_name_pattern: row.test_name_normalized,
          ai_classification: row.ai_classification,
          correct_classification: 'Likely Flaky',
          occurrence_count: 1,
          importance: 'normal'
        });
      }
    });

    // Process manual_fixes
    manualFixes?.forEach(row => {
      const key = `manual_fix|${row.error_pattern || 'general'}|${row.manual_fix_type || 'unknown'}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.occurrence_count++;
        existing.importance = calculateImportance(existing.occurrence_count);
      } else {
        patternMap.set(key, {
          pattern_type: 'manual_fix',
          error_pattern: row.error_pattern,
          test_name_pattern: null,
          ai_classification: row.ai_classification,
          correct_classification: row.manual_fix_type || 'Required manual fix',
          occurrence_count: 1,
          importance: 'normal'
        });
      }
    });

    const patterns = Array.from(patternMap.values());

    // Clear existing patterns and insert new ones
    const { error: deleteError } = await supabase
      .from('learning_patterns')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.log('Delete error (might be empty table):', deleteError);
    }

    if (patterns.length > 0) {
      const { error: insertError } = await supabase
        .from('learning_patterns')
        .insert(patterns);

      if (insertError) throw insertError;
    }

    // Calculate stats
    const stats = {
      totalCorrections: corrections?.length || 0,
      totalPassedLocally: passedLocally?.length || 0,
      totalManualFixes: manualFixes?.length || 0,
      uniquePatterns: patterns.length,
      criticalPatterns: patterns.filter(p => p.importance === 'critical').length,
      highPatterns: patterns.filter(p => p.importance === 'high').length,
      normalPatterns: patterns.filter(p => p.importance === 'normal').length,
      timestamp: new Date().toISOString()
    };

    console.log('Aggregation complete:', stats);

    return new Response(JSON.stringify({ 
      success: true, 
      stats,
      message: `Successfully aggregated ${stats.uniquePatterns} learning patterns` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Aggregation error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
