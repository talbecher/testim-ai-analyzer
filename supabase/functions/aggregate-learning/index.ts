import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AggregatedPattern {
  pattern_type: 'correction' | 'passed_locally' | 'manual_fix' | 'notes_analysis' | 'confirmed';
  error_pattern: string | null;
  test_name_pattern: string | null;
  ai_classification: string | null;
  correct_classification: string | null;
  occurrence_count: number;
  importance: 'critical' | 'high' | 'normal';
  user_notes_pattern: string | null;
  extracted_keywords: string[] | null;
}

interface NotesAnalysis {
  patterns: Array<{
    keyword: string;
    meaning: string;
    suggested_classification: string;
    count: number;
  }>;
  insights: string[];
}

function calculateImportance(count: number): 'critical' | 'high' | 'normal' {
  if (count >= 5) return 'critical';
  if (count >= 3) return 'high';
  return 'normal';
}

function extractKeywordsFromNotes(notes: string[]): Map<string, number> {
  const keywordCounts = new Map<string, number>();
  
  // Common patterns to look for in QA notes
  const significantPatterns = [
    'reassign', 'expired', 'provision', 'deploy', 'update', 'fix', 
    'changed', 'config', 'environment', 'timeout', 'element', 'locator',
    'data', 'api', 'backend', 'frontend', 'ui', 'button', 'click',
    'flaky', 'intermittent', 'random', 'sometimes', 'works locally',
    'permission', 'auth', 'login', 'token', 'session', 'cache',
    'mobile', 'ios', 'android', 'browser', 'chrome', 'safari',
    'tab', 'navigation', 'redirect', 'url', 'path'
  ];
  
  for (const note of notes) {
    if (!note) continue;
    const lowerNote = note.toLowerCase();
    
    for (const pattern of significantPatterns) {
      if (lowerNote.includes(pattern)) {
        keywordCounts.set(pattern, (keywordCounts.get(pattern) || 0) + 1);
      }
    }
  }
  
  return keywordCounts;
}

async function analyzeNotesWithAI(notes: string[], gatewayUrl: string): Promise<NotesAnalysis | null> {
  if (notes.length === 0) {
    return null;
  }
  
  // Take unique notes and limit to avoid token limits
  const uniqueNotes = [...new Set(notes.filter(n => n && n.trim().length > 0))];
  const limitedNotes = uniqueNotes.slice(0, 100);
  
  if (limitedNotes.length === 0) {
    return null;
  }
  
  const prompt = `Analyze these QA user notes from test failure reviews. These notes describe what the user did to fix or investigate failed tests.

USER NOTES:
${limitedNotes.map((n, i) => `${i + 1}. "${n}"`).join('\n')}

Extract patterns and provide insights. Return JSON only:
{
  "patterns": [
    {
      "keyword": "keyword found in notes",
      "meaning": "what this typically means in QA context",
      "suggested_classification": "one of: Potential bug, Likely Flaky, Environment Issue, Expected Change, Test Data Update, Config Change",
      "count": number of times this pattern appears
    }
  ],
  "insights": [
    "General insight about the patterns found",
    "Another insight"
  ]
}

Focus on actionable patterns that can help classify future failures. Look for:
- Words like "Reassign", "Update", "Expired", "Deploy" that indicate specific fix types
- Patterns suggesting test maintenance vs real bugs
- Environment/infrastructure related terms`;

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a QA patterns analyst. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('AI analysis failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Clean and parse JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as NotesAnalysis;
    }
  } catch (error) {
    console.error('Error analyzing notes with AI:', error);
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const gatewayUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';

    console.log('Starting learning aggregation with notes analysis...');

    // First, get all report IDs that are feature rollouts (to exclude from learning)
    const { data: featureRolloutReports, error: frError } = await supabase
      .from('analysis_reports')
      .select('id')
      .eq('is_feature_rollout', true);

    if (frError) {
      console.log('Error fetching feature rollout reports:', frError);
    }

    const excludeReportIds = new Set(
      featureRolloutReports?.map(r => r.id) || []
    );

    console.log(`Found ${excludeReportIds.size} feature rollout reports to exclude from learning`);

    // 1. Fetch ALL corrections (from all modes, not just learning) - EXCLUDING feature rollouts
    const { data: allCorrections, error: corrError } = await supabase
      .from('analysis_results')
      .select('report_id, test_name_normalized, error_pattern, ai_classification, user_classification, user_notes')
      .eq('was_correct', false)
      .not('user_classification', 'is', null);

    if (corrError) throw corrError;

    // Filter out results from feature rollout runs
    const corrections = allCorrections?.filter(c => !excludeReportIds.has(c.report_id)) || [];

    // 2. Fetch all passed_locally patterns with notes - EXCLUDING feature rollouts
    const { data: allPassedLocally, error: plError } = await supabase
      .from('analysis_results')
      .select('report_id, test_name_normalized, error_pattern, ai_classification, passed_locally_reason, passed_locally_notes')
      .eq('passed_locally', true);

    if (plError) throw plError;

    // Filter out results from feature rollout runs
    const passedLocally = allPassedLocally?.filter(c => !excludeReportIds.has(c.report_id)) || [];

    // 3. Fetch all manual_fix patterns with notes - EXCLUDING feature rollouts
    const { data: allManualFixes, error: mfError } = await supabase
      .from('analysis_results')
      .select('report_id, test_name_normalized, error_pattern, ai_classification, manual_fix_type, manual_fix_notes')
      .eq('required_manual_fix', true);

    if (mfError) throw mfError;

    // Filter out results from feature rollout runs
    const manualFixes = allManualFixes?.filter(c => !excludeReportIds.has(c.report_id)) || [];

    // 4. Fetch confirmed patterns (was_correct === true) - EXCLUDING feature rollouts
    const { data: allConfirmed, error: confError } = await supabase
      .from('analysis_results')
      .select('report_id, test_name_normalized, error_pattern, ai_classification')
      .eq('was_correct', true)
      .not('ai_classification', 'is', null);

    if (confError) console.log('Error fetching confirmed:', confError);
    const confirmed = allConfirmed?.filter(c => !excludeReportIds.has(c.report_id)) || [];

    console.log(`Found: ${corrections?.length || 0} corrections, ${passedLocally?.length || 0} passed locally, ${manualFixes?.length || 0} manual fixes, ${confirmed?.length || 0} confirmed (excluding ${excludeReportIds.size} feature rollout reports)`);

    // Collect all notes for AI analysis
    const allNotes: string[] = [];
    corrections?.forEach(row => { if (row.user_notes) allNotes.push(row.user_notes); });
    passedLocally?.forEach(row => { if (row.passed_locally_notes) allNotes.push(row.passed_locally_notes); });
    manualFixes?.forEach(row => { if (row.manual_fix_notes) allNotes.push(row.manual_fix_notes); });

    console.log(`Collected ${allNotes.length} notes for analysis`);

    // Extract keywords locally first
    const keywordCounts = extractKeywordsFromNotes(allNotes);
    console.log(`Extracted ${keywordCounts.size} unique keywords from notes`);

    // Analyze notes with AI if we have enough data
    let aiNotesAnalysis: NotesAnalysis | null = null;
    if (allNotes.length >= 3) {
      console.log('Sending notes to AI for pattern analysis...');
      aiNotesAnalysis = await analyzeNotesWithAI(allNotes, gatewayUrl);
      if (aiNotesAnalysis) {
        console.log(`AI found ${aiNotesAnalysis.patterns.length} patterns and ${aiNotesAnalysis.insights.length} insights`);
      }
    }

    // Aggregate patterns
    const patternMap = new Map<string, AggregatedPattern>();

    // Process corrections
    corrections?.forEach(row => {
      const key = `correction|${row.error_pattern || 'general'}|${row.ai_classification}|${row.user_classification}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.occurrence_count++;
        existing.importance = calculateImportance(existing.occurrence_count);
        // Append notes pattern if available
        if (row.user_notes && !existing.user_notes_pattern?.includes(row.user_notes)) {
          existing.user_notes_pattern = existing.user_notes_pattern 
            ? `${existing.user_notes_pattern} | ${row.user_notes}` 
            : row.user_notes;
        }
      } else {
        patternMap.set(key, {
          pattern_type: 'correction',
          error_pattern: row.error_pattern,
          test_name_pattern: null,
          ai_classification: row.ai_classification,
          correct_classification: row.user_classification,
          occurrence_count: 1,
          importance: 'normal',
          user_notes_pattern: row.user_notes || null,
          extracted_keywords: null
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
        if (row.passed_locally_notes && !existing.user_notes_pattern?.includes(row.passed_locally_notes)) {
          existing.user_notes_pattern = existing.user_notes_pattern 
            ? `${existing.user_notes_pattern} | ${row.passed_locally_notes}` 
            : row.passed_locally_notes;
        }
      } else {
        patternMap.set(key, {
          pattern_type: 'passed_locally',
          error_pattern: row.error_pattern,
          test_name_pattern: row.test_name_normalized,
          ai_classification: row.ai_classification,
          correct_classification: 'Likely Flaky',
          occurrence_count: 1,
          importance: 'normal',
          user_notes_pattern: row.passed_locally_notes || null,
          extracted_keywords: null
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
        if (row.manual_fix_notes && !existing.user_notes_pattern?.includes(row.manual_fix_notes)) {
          existing.user_notes_pattern = existing.user_notes_pattern 
            ? `${existing.user_notes_pattern} | ${row.manual_fix_notes}` 
            : row.manual_fix_notes;
        }
      } else {
        patternMap.set(key, {
          pattern_type: 'manual_fix',
          error_pattern: row.error_pattern,
          test_name_pattern: null,
          ai_classification: row.ai_classification,
          correct_classification: row.manual_fix_type || 'Required manual fix',
          occurrence_count: 1,
          importance: 'normal',
          user_notes_pattern: row.manual_fix_notes || null,
          extracted_keywords: null
        });
      }
    });

    // Process confirmed (was_correct === true) – lower importance, reinforce correct classifications
    confirmed?.forEach(row => {
      const key = `confirmed|${row.error_pattern || 'general'}|${row.ai_classification}`;
      const existing = patternMap.get(key);
      if (existing) {
        existing.occurrence_count++;
        existing.importance = existing.occurrence_count >= 5 ? 'high' : existing.occurrence_count >= 3 ? 'normal' : 'normal';
      } else {
        patternMap.set(key, {
          pattern_type: 'confirmed',
          error_pattern: row.error_pattern,
          test_name_pattern: row.test_name_normalized,
          ai_classification: row.ai_classification,
          correct_classification: row.ai_classification,
          occurrence_count: 1,
          importance: 'normal',
          user_notes_pattern: null,
          extracted_keywords: null
        });
      }
    });

    // Add AI-analyzed patterns as special entries
    if (aiNotesAnalysis?.patterns) {
      for (const pattern of aiNotesAnalysis.patterns) {
        if (pattern.count >= 2) { // Only add patterns that appear multiple times
          const key = `notes_analysis|${pattern.keyword}|${pattern.suggested_classification}`;
          patternMap.set(key, {
            pattern_type: 'notes_analysis',
            error_pattern: null,
            test_name_pattern: null,
            ai_classification: null,
            correct_classification: pattern.suggested_classification,
            occurrence_count: pattern.count,
            importance: calculateImportance(pattern.count),
            user_notes_pattern: pattern.meaning,
            extracted_keywords: [pattern.keyword]
          });
        }
      }
    }

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
      totalNotesAnalyzed: allNotes.length,
      uniqueKeywords: keywordCounts.size,
      aiPatternsFound: aiNotesAnalysis?.patterns?.length || 0,
      aiInsights: aiNotesAnalysis?.insights || [],
      topKeywords: Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count })),
      uniquePatterns: patterns.length,
      criticalPatterns: patterns.filter(p => p.importance === 'critical').length,
      highPatterns: patterns.filter(p => p.importance === 'high').length,
      normalPatterns: patterns.filter(p => p.importance === 'normal').length,
      notesPatterns: patterns.filter(p => p.pattern_type === 'notes_analysis').length,
      timestamp: new Date().toISOString()
    };

    console.log('Aggregation complete:', stats);

    return new Response(JSON.stringify({ 
      success: true, 
      stats,
      message: `Successfully aggregated ${stats.uniquePatterns} learning patterns including ${stats.notesPatterns} from notes analysis` 
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
