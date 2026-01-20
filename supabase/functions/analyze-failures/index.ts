import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Core decision framework - shared between modes
const DECISION_FRAMEWORK = `
## DECISION FRAMEWORK (FOLLOW THIS ORDER STRICTLY)

### 1. LEARNING PATTERNS (STRONGEST SIGNAL)
Patterns generated via AI Learning Boost.
- If marked CRITICAL (3+ occurrences) -> MUST FOLLOW with 95% confidence
- If marked HIGH (2 occurrences) -> Strong signal with 80% confidence
- If marked NORMAL (1 occurrence) -> Weak reference, 60% confidence

### 2. HISTORICAL CORRECTIONS (FROM USER FEEDBACK)
- 3+ occurrences -> MUST FOLLOW (very high confidence)
- 2 occurrences -> Strong signal
- 1 occurrence -> Weak reference only

### 3. PASSED LOCALLY PATTERNS
- Passed locally 3+ times -> Very strong signal for Likely Flaky
- Passed locally 1-2 times -> Supporting signal only

### 4. FLAKY KB MATCH
- If matched -> increase probability of Likely Flaky
- This is a supporting signal, not an absolute rule

### 5. ERROR PATTERN HEURISTICS (USE ONLY IF ABOVE SIGNALS WEAK)
- Element not found -> usually Likely Flaky (UI/timing related)
- Element is not visible -> usually Likely Flaky
- Timeout -> Likely Flaky or Environment / Infra Issue
- AssertionError -> usually Potential bug
- Network / infra errors -> Environment / Infra Issue
- Null / Undefined errors -> Potential bug unless strong flaky signals exist
`;

const GUARDRAILS = `
## IMPORTANT GUARDRAILS

### P0 PRIORITY RULE
- Use P0 ONLY when confidence is extremely high (90%+) for a real Potential bug in critical flow
- NEVER use P0 for flaky, timing, or environment-related issues

### When Signals Conflict
- Follow the strongest signal based on the decision order above
- Reduce confidence when uncertain

### COMMON MISTAKES TO AVOID
❌ Do NOT ignore learning patterns or historical corrections
❌ Do NOT classify flaky UI/timing failures as P0
❌ Do NOT output high confidence when signals are weak or conflicting
❌ Do NOT invent new labels or priorities
❌ Do NOT assume "Flaky > Bug" globally

### BEST PRACTICES
✅ Prefer Likely Flaky only when supported by learning patterns, historical corrections, passed-locally data, or Flaky KB
✅ AssertionError tends to be a Potential bug unless strong flaky signals override it
✅ Prefer consistency over creativity
✅ Reduce confidence when uncertain
✅ Explain reasoning using existing fields only
`;

const OUTPUT_REQUIREMENTS = `
## OUTPUT REQUIREMENTS (CRITICAL)

### Classification Values (MUST MATCH EXACTLY - case-sensitive):
- "Potential bug"
- "Likely Flaky"
- "Environment / Infra Issue"
- "Expected Change"

Do NOT invent new labels or variations.

### Required Keys for Each Item:
- classification
- confidence
- priority
- suggestedAction
- priorityReason
- errorPattern
- requiresRerun
- rerunReason
- flakyKBMatch

### Field Alignment Rules:
- errorPattern: Use the provided error pattern as-is. Do NOT invent or replace unless clearly incorrect.
- requiresRerun: Keep consistent with classification and confidence. Avoid extreme recommendations when confidence low.
- priorityReason: Include bullet points explaining which signals were used.

### Output Rules:
- Return ONLY a valid JSON array
- Each item MUST include ALL required keys, even if some values are null
- Do NOT change key names, casing, or structure
- Do NOT add or remove keys
- Do NOT output markdown, code fences, or explanations outside the JSON
`;

// Learning mode prompt - focus on prediction accuracy evaluation
const LEARNING_PROMPT = `You are an expert QA engineer analyzing test failures from Testim for EVALUATION purposes.
The user has ALREADY classified these failures. Your job is to make predictions that will be compared against the human classifications.
Be as accurate as possible - your predictions will be used to measure AI accuracy.

${DECISION_FRAMEWORK}
${GUARDRAILS}
${OUTPUT_REQUIREMENTS}`;

// Production mode prompt - focus on actionable recommendations
const PRODUCTION_PROMPT = `You are an expert QA engineer analyzing test failures from Testim for DECISION SUPPORT.
The user needs your help to classify and prioritize these failures. Provide clear, actionable recommendations.
Be confident but acknowledge uncertainty when appropriate.

${DECISION_FRAMEWORK}
${GUARDRAILS}
${OUTPUT_REQUIREMENTS}`;

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
    let learningPatternsPrompt = '';
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Fetch corrections from ALL modes (not just learning) - INCREASED LIMIT
      const { data: corrections, error: dbError } = await supabase
        .from('analysis_results')
        .select(`
          test_name_normalized, 
          error_pattern, 
          ai_classification, 
          user_classification
        `)
        .eq('was_correct', false)
        .not('user_classification', 'is', null)
        .limit(200); // Increased from 100

      // Fetch aggregated learning patterns (from Boost)
      const { data: learningPatterns } = await supabase
        .from('learning_patterns')
        .select('*')
        .order('importance', { ascending: true }); // critical first

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
          .slice(0, 50); // Increased from 20

        if (topCorrections.length > 0) {
          // Filter by importance levels
          const criticalCorrections = topCorrections.filter(c => c.count >= 3);
          const highCorrections = topCorrections.filter(c => c.count === 2);
          const normalCorrections = topCorrections.filter(c => c.count === 1).slice(0, 10);

          historicalCorrections = `

## Historical Corrections (IMPORTANT - Learn from past mistakes):
Users have corrected the following patterns. Use these to improve your accuracy:

### CRITICAL (3+ corrections - MUST FOLLOW with 95% confidence):
${criticalCorrections.length > 0 
  ? criticalCorrections.map(c => 
    `🔴 Error pattern "${c.pattern || 'general'}": AI said "${c.from}" but users corrected to "${c.to}" (${c.count}x) -> MUST FOLLOW`
  ).join('\n')
  : 'None'}

### HIGH (2 corrections - Strong signal with 80% confidence):
${highCorrections.length > 0 
  ? highCorrections.map(c => 
    `⚠️ Error pattern "${c.pattern || 'general'}": AI said "${c.from}" but users corrected to "${c.to}" (${c.count}x) -> Strong signal`
  ).join('\n')
  : 'None'}

### NORMAL (1 correction - Weak reference, consider only if other signals align):
${normalCorrections.length > 0 
  ? normalCorrections.map(c => 
    `📝 Error pattern "${c.pattern || 'general'}": AI said "${c.from}" but users corrected to "${c.to}" (${c.count}x)`
  ).join('\n')
  : 'None'}

Pay special attention to CRITICAL and HIGH patterns - these represent repeated user corrections!`;
        }
      }

      // Fetch passed locally patterns from ALL modes
      const { data: passedLocally, error: plError } = await supabase
        .from('analysis_results')
        .select(`
          test_name_normalized, 
          error_pattern
        `)
        .eq('passed_locally', true)
        .limit(150); // Increased from 100

      // Build learning patterns section for prompt
      if (learningPatterns && learningPatterns.length > 0) {
        const criticalPatterns = learningPatterns.filter(p => p.importance === 'critical');
        const highPatterns = learningPatterns.filter(p => p.importance === 'high');
        const notesPatterns = learningPatterns.filter(p => p.pattern_type === 'notes_analysis');
        
        let patternsSection = '';
        
        if (criticalPatterns.length > 0) {
          patternsSection += `
## CRITICAL LEARNING PATTERNS (MUST FOLLOW - 95% confidence):
${criticalPatterns.map(p => {
  const notesInfo = p.user_notes_pattern ? ` | User notes: "${p.user_notes_pattern}"` : '';
  return `🔴 CRITICAL: Error "${p.error_pattern || 'general'}" - AI predicted "${p.ai_classification}" but should be "${p.correct_classification}" (happened ${p.occurrence_count}x)${notesInfo}`;
}).join('\n')}
`;
        }
        
        if (highPatterns.length > 0) {
          patternsSection += `
## HIGH IMPORTANCE PATTERNS (Strong signal - 80% confidence):
${highPatterns.map(p => {
  const notesInfo = p.user_notes_pattern ? ` | User notes: "${p.user_notes_pattern}"` : '';
  return `⚠️ HIGH: Error "${p.error_pattern || 'general'}" - AI predicted "${p.ai_classification}" but should be "${p.correct_classification}" (happened ${p.occurrence_count}x)${notesInfo}`;
}).join('\n')}
`;
        }
        
        // Add notes-based patterns
        if (notesPatterns.length > 0) {
          patternsSection += `
## USER NOTES PATTERNS (Important context from QA feedback):
${notesPatterns.map(p => {
  const keywords = p.extracted_keywords?.join(', ') || 'N/A';
  return `📝 When notes mention "${keywords}": ${p.user_notes_pattern} → Suggest "${p.correct_classification}" (seen ${p.occurrence_count}x)`;
}).join('\n')}

Examples of actionable patterns from user notes:
- "Reassign", "reassign element" → UI changed, test needs update → "Expected Change"
- "Expired", "provision file" → Test data/config outdated → "Environment / Infra Issue"
- "Deploy tab", "navigation" → Infrastructure problem → Lower priority, suggest rerun
`;
        }
        
        if (patternsSection) {
          learningPatternsPrompt = patternsSection + `
IMPORTANT: The above patterns are based on aggregated user feedback AND analysis of user notes. 
When you see similar error messages or patterns, use this learning to improve your classification accuracy!`;
        }
      }

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
          .slice(0, 25); // Increased from 15

        if (topPatterns.length > 0) {
          // Separate by strength
          const veryStrong = topPatterns.filter(p => p.count >= 3);
          const supporting = topPatterns.filter(p => p.count < 3);

          passedLocallyPatterns = `

## Tests That Pass Locally (CAUTION - These are likely NOT real bugs):
These tests were flagged as "Potential bug" but passed when run locally. 
Consider "Likely Flaky" or "Environment / Infra Issue" instead:

### VERY STRONG (3+ times passed locally - likely Likely Flaky):
${veryStrong.length > 0 
  ? veryStrong.map(p => 
    `🔴 "${p.name}" with error "${p.pattern || 'unknown'}" (passed locally ${p.count}x) -> VERY likely flaky`
  ).join('\n')
  : 'None'}

### SUPPORTING (1-2 times passed locally):
${supporting.slice(0, 15).map(p => 
  `📝 "${p.name}" with error "${p.pattern || 'unknown'}" (passed locally ${p.count}x)`
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
${learningPatternsPrompt}
${historicalCorrections}
${passedLocallyPatterns}

## Failures to Analyze:
${JSON.stringify(failures, null, 2)}

For EACH failure, respond with JSON array containing objects with:
- classification: "Potential bug" | "Likely Flaky" | "Environment / Infra Issue" | "Expected Change"
- confidence: 0-100
- suggestedAction: "Open bug" | "Update shared step" | "Rerun only" | "Ignore today / monitor"
- priority: "P0" | "P1" | "P2" | "P3"
- priorityReason: bullet points explaining which signals were used (learning patterns, historical corrections, passed locally, etc.)
- errorPattern: the detected error pattern (use provided pattern as-is)
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
        temperature: 0.3, // CRITICAL: Ensures consistent, deterministic output
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
