import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Learning mode prompt - focus on prediction accuracy evaluation
const LEARNING_PROMPT = `You are an expert QA engineer analyzing test failures from Testim for EVALUATION purposes.
The user has ALREADY classified these failures. Your job is to make predictions that will be compared against the human classifications.
Be as accurate as possible - your predictions will be used to measure AI accuracy.

## Classification Rules:
- "Potential bug": Assertion failures, unexpected behavior, logic errors. Low flakiness.
- "Likely Flaky": Element not found, timing issues, intermittent failures. High flakiness.
- "Environment / Infra Issue": Network errors, server 5xx, connection refused. Infrastructure problems.
- "Expected Change": Feature changed, UI updated, intentional changes.

## Priority Rules:
- P0: High confidence Potential bug in critical flow, or repeated assertion failures
- P1: Medium confidence Potential bug, or shared-step changes
- P2: High confidence Flaky, or Environment Issues
- P3: Low confidence Flaky, or one-time issues`;

// Production mode prompt - focus on actionable recommendations
const PRODUCTION_PROMPT = `You are an expert QA engineer analyzing test failures from Testim for DECISION SUPPORT.
The user needs your help to classify and prioritize these failures. Provide clear, actionable recommendations.
Be confident but acknowledge uncertainty when appropriate.

## Classification Rules:
- "Potential bug": Assertion failures, unexpected behavior, logic errors. Low flakiness.
- "Likely Flaky": Element not found, timing issues, intermittent failures. High flakiness.
- "Environment / Infra Issue": Network errors, server 5xx, connection refused. Infrastructure problems.
- "Expected Change": Feature changed, UI updated, intentional changes.

## Priority Rules:
- P0: High confidence Potential bug in critical flow, or repeated assertion failures - needs immediate attention
- P1: Medium confidence Potential bug, or shared-step changes - should be addressed today
- P2: High confidence Flaky, or Environment Issues - monitor and rerun
- P3: Low confidence Flaky, or one-time issues - can wait`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { failures, flakyTests, mode = 'production' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    console.log(`Analyzing ${failures.length} failures in ${mode} mode`);

    // Fetch historical corrections and passed locally patterns from database
    let historicalCorrections = '';
    let passedLocallyPatterns = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Fetch corrections ONLY from learning mode reports
      const { data: corrections, error: dbError } = await supabase
        .from('analysis_results')
        .select(`
          test_name_normalized, 
          error_pattern, 
          ai_classification, 
          user_classification,
          analysis_reports!inner(mode)
        `)
        .eq('was_correct', false)
        .eq('analysis_reports.mode', 'learning')
        .not('user_classification', 'is', null)
        .limit(100);

      if (!dbError && corrections && corrections.length > 0) {
        // Aggregate corrections
        const correctionMap = new Map<string, { from: string; to: string; pattern: string | null; count: number }>();
        corrections.forEach(row => {
          const key = `${row.error_pattern}|${row.ai_classification}|${row.user_classification}`;
          const existing = correctionMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            correctionMap.set(key, {
              from: row.ai_classification,
              to: row.user_classification,
              pattern: row.error_pattern,
              count: 1
            });
          }
        });

        const topCorrections = Array.from(correctionMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);

        if (topCorrections.length > 0) {
          historicalCorrections = `

## Historical Corrections (IMPORTANT - Learn from past mistakes):
Users have corrected the following patterns. Use these to improve your accuracy:
${topCorrections.map(c => 
  `- Error pattern "${c.pattern || 'general'}": AI said "${c.from}" but users corrected to "${c.to}" (${c.count}x)`
).join('\n')}

Pay special attention to these patterns and adjust your classifications accordingly.`;
        }
      }

      // Fetch passed locally patterns ONLY from learning mode reports
      const { data: passedLocally, error: plError } = await supabase
        .from('analysis_results')
        .select(`
          test_name_normalized, 
          error_pattern,
          analysis_reports!inner(mode)
        `)
        .eq('passed_locally', true)
        .eq('analysis_reports.mode', 'learning')
        .limit(100);

      if (!plError && passedLocally && passedLocally.length > 0) {
        // Aggregate by test name and error pattern
        const patternMap = new Map<string, { name: string; pattern: string | null; count: number }>();
        passedLocally.forEach(row => {
          const key = `${row.test_name_normalized}|${row.error_pattern}`;
          const existing = patternMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            patternMap.set(key, {
              name: row.test_name_normalized,
              pattern: row.error_pattern,
              count: 1
            });
          }
        });

        const topPatterns = Array.from(patternMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);

        if (topPatterns.length > 0) {
          passedLocallyPatterns = `

## Tests That Pass Locally (CAUTION - These are likely NOT real bugs):
These tests were flagged as "Potential bug" but passed when run locally. 
Consider "Likely Flaky" or "Environment / Infra Issue" instead:
${topPatterns.map(p => 
  `- "${p.name}" with error "${p.pattern || 'unknown'}" (passed locally ${p.count}x)`
).join('\n')}`;
        }
      }
    } catch (dbErr) {
      console.log("Could not fetch learning data, continuing without:", dbErr);
    }

    // Select prompt based on mode
    const basePrompt = mode === 'learning' ? LEARNING_PROMPT : PRODUCTION_PROMPT;

    const systemPrompt = `${basePrompt}

## Flaky KB (Known Flaky Tests):
${JSON.stringify(flakyTests, null, 2)}

If a test matches Flaky KB (even fuzzy match), note it in your response.
IMPORTANT: Flaky KB is a strong signal but NOT a hard rule. Never auto-classify solely based on this.
${historicalCorrections}
${passedLocallyPatterns}

## Failures to Analyze:
${JSON.stringify(failures, null, 2)}

For EACH failure, respond with JSON array containing objects with:
- classification: "Potential bug" | "Likely Flaky" | "Environment / Infra Issue" | "Expected Change"
- confidence: 0-100
- suggestedAction: "Open bug" | "Update shared step" | "Rerun only" | "Ignore today / monitor"
- priority: "P0" | "P1" | "P2" | "P3"
- priorityReason: bullet points explaining why
- errorPattern: the detected error pattern
- requiresRerun: true/false
- rerunReason: explanation
- flakyKBMatch: true/false if matched in Flaky KB

Return ONLY valid JSON array, no markdown.`;

    console.log(`Sending to AI (${mode} mode) with historical corrections:`, historicalCorrections ? "Yes" : "No");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze these failures and return the JSON array." }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "[]";
    
    // Clean up response
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const analyses = JSON.parse(content);
    const results = analyses.map((analysis: any, idx: number) => ({
      failureId: idx,
      analysis,
    }));

    console.log(`Analysis complete (${mode} mode), returning`, results.length, "results");

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
