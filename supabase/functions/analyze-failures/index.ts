import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// P0 Safety Rule - Absolute priority
const P0_SAFETY_RULE = `
## 0. P0 SAFETY RULE (ABSOLUTE - NEVER VIOLATE)

NEVER classify as "Potential bug" if:
- The failure required a manual TEST change (locator, assertion, step update)
- The expected result was modified to pass
- The test logic was changed to accommodate new behavior

These MUST be classified as:
→ "Expected Change" if intentional product change
→ "Likely Flaky" if test needed maintenance
→ "Investigate" if intent is unclear (see Investigate Fallback rule)
`;

// Investigate Fallback Rule - For ambiguous cases
const INVESTIGATE_FALLBACK = `
## 1. INVESTIGATE FALLBACK (EXPLICIT CLASSIFICATION)

When a failure required manual test changes BUT intent is unclear:
- Cannot determine if it was a product change vs test issue
- Conflicting signals make classification uncertain
- Human verification is needed

→ Classify as: "Investigate" (NOT Bug/Flaky with reduced confidence)
→ Set confidence: 40-60% (low to moderate)
→ Set suggestedAction: "Verify manually" (NEVER "Open bug" for Investigate)
→ Set requiresRerun: true
→ Add to priorityReason: "Manual intervention detected - root cause ambiguous"

CRITICAL: "Investigate" classification MUST use "Verify manually" or "Rerun only" action - NEVER "Open bug"!
`;

// Regression-specific learning framework
const REGRESSION_LEARNING = `
## 2. REGRESSION-SPECIFIC LEARNING (STRONGEST SIGNAL)

All patterns below are from THIS regression bucket ONLY.
Do NOT apply patterns from other regressions.

### CRITICAL (3+ occurrences in this regression):
- Base confidence: 90%
- STRONG DEFAULT - follow unless contradicted by:
  • A historical correction that overrode a similar case
  • Manual test changes detected (locator/assertion/logic update)
  • Intermittent behavior within this regression (pass/fail alternating)
  • Conflicting passed-locally signals exist
  
When exceptions apply:
→ Reduce confidence by 15-20%
→ Add reasoning: "CRITICAL pattern present but [exception reason]"

### HIGH (2 occurrences in this regression):
- Base confidence: 75%
- Strong signal to follow

### NORMAL (1 occurrence in this regression):
- Base confidence: 55%
- Weak reference only - use other signals to confirm
`;

// First-seen handling with global familiarity
const FIRST_SEEN_HANDLING = `
## 3. RUN-TO-RUN HISTORY (THIS REGRESSION)

### FIRST-SEEN HANDLING (IMPORTANT DISTINCTION)

"First seen in this regression" ≠ "First seen globally"

- First in regression BUT seen globally before:
  → Test has history in other buckets
  → Reduce uncertainty by 10% (global familiarity helps)
  → Reference global patterns if strong

- First in regression AND first globally:
  → Truly new failure, no historical reference
  → Reduce confidence by 15-20%
  → Recommend monitoring before decisive classification

### OTHER HISTORY SIGNALS:
- Intermittent pattern (3+ alternations) → +20% confidence for Likely Flaky
- Failing 4+ runs consecutively → +15% confidence for Potential bug
- High passed-locally rate (>70%) → Strong flaky signal
`;

// Standard decision framework (lower priority signals)
const DECISION_FRAMEWORK = `
## 4. HISTORICAL CORRECTIONS (FROM USER FEEDBACK IN THIS REGRESSION)
- 3+ occurrences → MUST FOLLOW (very high confidence)
- 2 occurrences → Strong signal
- 1 occurrence → Weak reference only

## 5. PASSED LOCALLY PATTERNS (THIS REGRESSION ONLY)
- Passed locally 3+ times → Very strong signal for Likely Flaky
- Passed locally 1-2 times → Supporting signal only

## 6. FLAKY KB MATCH (GLOBAL)
- If matched → increase probability of Likely Flaky
- This is a supporting signal, not an absolute rule

## 7. ERROR PATTERN HEURISTICS (USE ONLY IF ABOVE SIGNALS WEAK)
- Element not found → usually Likely Flaky (UI/timing related)
- Element is not visible → usually Likely Flaky
- Timeout → Likely Flaky or Environment / Infra Issue
- AssertionError → usually Potential bug
- Network / infra errors → Environment / Infra Issue
- Null / Undefined errors → Potential bug unless strong flaky signals exist

## 7b. ASSERTION ERROR DIFFERENTIATION (ENHANCED)
When error pattern is AssertionError, check assertionDetails:
- hasExpectedActual: true + isValueMismatch: true → 75-80% confidence Potential bug
- hasExpectedActual: true + isNullUndefinedMismatch: true → 60% confidence, could be either
- isVisualAssertion: true → 50% confidence (visual checks can be flaky)
- No details → 55% confidence, use other signals

GUARDRAIL: AssertionError with clear expected≠actual is STRONG bug evidence.
Only classify as Flaky if 3+ passed_locally in this regression OR explicit historical correction.

## 8. CO-FAILURE DETECTION (SYSTEMIC ISSUE SIGNAL)
When coFailureInfo is present:
- groupSize 4+ → 85% confidence for Potential bug or Environment Issue
- groupSize 2-3 → 70% confidence, strong supporting signal
- sharedStep failures → likely shared component broke (Potential bug)
- sharedErrorPattern → likely infrastructure/environment (check error type)

Priority boost for co-failures:
- Co-failure group of 4+ tests → increase priority by 1 level (P2→P1, P1→P0)
- Add to priorityReason: "Part of co-failure group (X tests with same [step/error])"

## 9. STREAK ANALYSIS (INTERMITTENT DETECTION)
When streakInfo is present:
- isIntermittent: true (2+ alternations in 4+ runs) → 80-85% confidence Likely Flaky
- isConsistentFailure: true (3+ consecutive fails, no local pass) → 85% confidence Potential bug
- streakLength < 3 → Low history, reduce confidence by 10%

Add to priorityReason when applicable:
- "Intermittent pattern (X alternations) - strong flaky signal"
- "Failed X times consecutively - consistent failure pattern"
`;

// Enhanced assertion rules
const ASSERTION_RULES = `
## ASSERTION ERROR RULE (CRITICAL FOR BUG DETECTION)

AssertionError with clear expected≠actual is STRONG evidence for Potential bug:
- Value mismatch (neither null/undefined) → 80% base confidence
- Has expected/actual but with null/undefined → 60% confidence
- Visual assertion (screenshot/pixel) → 50% confidence (may be rendering flake)

Only override to Likely Flaky if:
• 3+ passed_locally occurrences in this regression
• OR explicit historical correction to Flaky exists
• OR visual assertion in element known to be unstable
`;

// Co-failure detection rules
const CO_FAILURE_RULES = `
## CO-FAILURE DETECTION RULES (SYSTEMIC ISSUES)

When multiple tests fail with the SAME shared step or error pattern:
- This indicates a systemic issue, not individual test problems
- Treat the GROUP as a single investigation item

Classification logic:
- Same shared step failing → Potential bug (shared component broke)
- Same infrastructure error → Environment / Infra Issue
- Co-failure + AssertionError → VERY strong Potential bug signal

Priority and confidence:
- Group size 4+ → 85% confidence, boost priority by 1
- Group size 2-3 → 70% confidence, strong signal
- Always mention in priorityReason
`;

const GUARDRAILS = `
## IMPORTANT GUARDRAILS

### P0 PRIORITY RULE
- Use P0 ONLY when confidence is extremely high (90%+) for a real Potential bug in critical flow
- NEVER use P0 for flaky, timing, or environment-related issues
- P0 reserved for CRITICAL application bugs with high certainty

### INVESTIGATE CLASSIFICATION GUARDRAIL
- "Investigate" MUST NEVER use suggestedAction "Open bug"
- Only allowed actions for "Investigate": "Verify manually" or "Rerun only"

### When Signals Conflict
- Follow the strongest signal based on the decision order above
- Reduce confidence when uncertain
- If truly ambiguous, use "Investigate" classification

### COMMON MISTAKES TO AVOID
❌ Do NOT ignore regression-specific patterns
❌ Do NOT classify flaky UI/timing failures as P0
❌ Do NOT output high confidence when signals are weak or conflicting
❌ Do NOT invent new labels or priorities
❌ Do NOT classify as "Potential bug" if test was manually changed
❌ Do NOT use "Open bug" for "Investigate" classification

### BEST PRACTICES
✅ Prefer Likely Flaky only when supported by regression-specific data
✅ Use "Investigate" for ambiguous cases requiring human verification
✅ AssertionError tends to be a Potential bug unless strong flaky signals override
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
- "Investigate"

Do NOT invent new labels or variations.

### SuggestedAction Values:
- "Open bug" (NEVER for "Investigate")
- "Update shared step"
- "Rerun only"
- "Ignore today / monitor"
- "Verify manually" (preferred for "Investigate")

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
- signalBreakdown (NEW - for transparency)

### signalBreakdown Object (REQUIRED):
Return signal scores to explain the decision:
{
  "bugScore": 0-100,           // Weighted contribution of bug signals
  "flakyScore": 0-100,         // Weighted contribution of flaky signals
  "environmentScore": 0-100,   // Weighted contribution of env signals
  "investigateScore": 0-100,   // Weighted contribution of investigate signals
  "activeSignals": ["SIGNAL_NAME_1", "SIGNAL_NAME_2", ...]
}

Available signal names:
- ASSERTION_WITH_VALUES, ASSERTION_VALUE_MISMATCH, CO_FAILURE_GROUP_4_PLUS, CO_FAILURE_GROUP_2_3
- CONSISTENT_FAILURE_STREAK, HISTORICAL_BUG_CORRECTION, NULL_UNDEFINED_ERROR
- FLAKY_KB_MATCH, INTERMITTENT_STREAK, PASSED_LOCALLY_3_PLUS, PASSED_LOCALLY_1_2
- ELEMENT_NOT_FOUND, VISUAL_ASSERTION, HISTORICAL_FLAKY_CORRECTION
- NETWORK_ERROR, TIMEOUT_SHORT, TIMEOUT_LONG, INFRA_PATTERN, CO_FAILURE_INFRA
- FIRST_SEEN_GLOBALLY, FIRST_SEEN_IN_REGRESSION, CONFLICTING_SIGNALS, MANUAL_CHANGE_DETECTED, LOW_HISTORY

### Field Alignment Rules:
- errorPattern: Use the provided error pattern as-is
- requiresRerun: Keep consistent with classification and confidence
- priorityReason: Include bullet points explaining which signals were used
- signalBreakdown: Must sum to ~100% across scores

### Output Rules:
- Return ONLY a valid JSON array
- Each item MUST include ALL required keys
- Do NOT output markdown, code fences, or explanations outside the JSON
`;

// Learning mode prompt - focus on prediction accuracy evaluation
const LEARNING_PROMPT = `You are an expert QA engineer analyzing test failures from Testim for EVALUATION purposes.
The user has ALREADY classified these failures. Your job is to make predictions that will be compared against the human classifications.
Be as accurate as possible - your predictions will be used to measure AI accuracy.

${P0_SAFETY_RULE}
${INVESTIGATE_FALLBACK}
${REGRESSION_LEARNING}
${FIRST_SEEN_HANDLING}
${DECISION_FRAMEWORK}
${ASSERTION_RULES}
${CO_FAILURE_RULES}
${GUARDRAILS}
${OUTPUT_REQUIREMENTS}`;

// Production mode prompt - focus on actionable recommendations
const PRODUCTION_PROMPT = `You are an expert QA engineer analyzing test failures from Testim for DECISION SUPPORT.
The user needs your help to classify and prioritize these failures. Provide clear, actionable recommendations.
Be confident but acknowledge uncertainty when appropriate.

${P0_SAFETY_RULE}
${INVESTIGATE_FALLBACK}
${REGRESSION_LEARNING}
${FIRST_SEEN_HANDLING}
${DECISION_FRAMEWORK}
${ASSERTION_RULES}
${CO_FAILURE_RULES}
${GUARDRAILS}
${OUTPUT_REQUIREMENTS}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { failures, flakyTests, mode = 'production', regressionBucket } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    // Validate regression bucket
    if (!regressionBucket) {
      throw new Error('Regression bucket is required for analysis');
    }

    console.log(`Analyzing ${failures.length} failures for "${regressionBucket}" in ${mode} mode`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build regression-specific context
    let regressionContext = '';
    let historicalCorrections = '';
    let passedLocallyPatterns = '';
    let learningPatternsPrompt = '';
    let globalFamiliarityInfo = '';

    try {
      // Step 1: Get report IDs for THIS regression bucket only
      const { data: regressionReports, error: reportsError } = await supabase
        .from('analysis_reports')
        .select('id')
        .eq('regression_bucket', regressionBucket);

      const reportIds = regressionReports?.map(r => r.id) || [];
      
      console.log(`Found ${reportIds.length} historical reports for "${regressionBucket}"`);

      if (reportIds.length > 0) {
        // Step 2: Query corrections ONLY from this regression (LIMIT 200)
        const { data: corrections, error: corrError } = await supabase
          .from('analysis_results')
          .select(`
            test_name_normalized, 
            error_pattern, 
            ai_classification, 
            user_classification
          `)
          .in('report_id', reportIds)
          .eq('was_correct', false)
          .not('user_classification', 'is', null)
          .limit(200);

        if (!corrError && corrections && corrections.length > 0) {
          // Aggregate corrections for this regression
          const correctionMap = new Map<string, { from: string; to: string; pattern: string | null; count: number; testExamples: string[] }>();
          corrections.forEach(row => {
            const key = `${row.error_pattern}|${row.ai_classification}|${row.user_classification}`;
            const existing = correctionMap.get(key);
            if (existing) {
              existing.count++;
              if (existing.testExamples.length < 3) {
                existing.testExamples.push(row.test_name_normalized);
              }
            } else {
              correctionMap.set(key, {
                from: row.ai_classification,
                to: row.user_classification,
                pattern: row.error_pattern,
                count: 1,
                testExamples: [row.test_name_normalized]
              });
            }
          });

          const topCorrections = Array.from(correctionMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 50);

          if (topCorrections.length > 0) {
            const criticalCorrections = topCorrections.filter(c => c.count >= 3);
            const highCorrections = topCorrections.filter(c => c.count === 2);
            const normalCorrections = topCorrections.filter(c => c.count === 1).slice(0, 10);

            historicalCorrections = `

## Historical Corrections for "${regressionBucket}" (REGRESSION-SPECIFIC):

### CRITICAL (3+ corrections - MUST FOLLOW with 90% confidence unless contradicted):
${criticalCorrections.length > 0 
  ? criticalCorrections.map(c => 
    `🔴 Error "${c.pattern || 'general'}": AI said "${c.from}" → users corrected to "${c.to}" (${c.count}x)\n   Examples: ${c.testExamples.slice(0, 2).join(', ')}`
  ).join('\n')
  : 'None in this regression'}

### HIGH (2 corrections - Strong signal with 75% confidence):
${highCorrections.length > 0 
  ? highCorrections.map(c => 
    `⚠️ Error "${c.pattern || 'general'}": AI said "${c.from}" → corrected to "${c.to}" (${c.count}x)`
  ).join('\n')
  : 'None in this regression'}

### NORMAL (1 correction - Weak reference):
${normalCorrections.length > 0 
  ? normalCorrections.map(c => 
    `📝 Error "${c.pattern || 'general'}": "${c.from}" → "${c.to}" (1x)`
  ).join('\n')
  : 'None'}`;
          }
        }

        // Step 3: Query passed locally ONLY from this regression (LIMIT 100)
        const { data: passedLocally, error: plError } = await supabase
          .from('analysis_results')
          .select('test_name_normalized, error_pattern')
          .in('report_id', reportIds)
          .eq('passed_locally', true)
          .limit(100);

        if (!plError && passedLocally && passedLocally.length > 0) {
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
            .slice(0, 25);

          if (topPatterns.length > 0) {
            const veryStrong = topPatterns.filter(p => p.count >= 3);
            const supporting = topPatterns.filter(p => p.count < 3);

            passedLocallyPatterns = `

## Passed Locally in "${regressionBucket}" (REGRESSION-SPECIFIC):

### VERY STRONG (3+ times passed locally - Likely Flaky):
${veryStrong.length > 0 
  ? veryStrong.map(p => 
    `🔴 "${p.name}" with "${p.pattern || 'unknown'}" (${p.count}x) → VERY likely flaky`
  ).join('\n')
  : 'None in this regression'}

### SUPPORTING (1-2 times):
${supporting.slice(0, 15).map(p => 
  `📝 "${p.name}" with "${p.pattern || 'unknown'}" (${p.count}x)`
).join('\n')}`;
          }
        }
      }

      // Step 4: Check global familiarity for current failures
      const testNames = failures.map((f: any) => f.testNameNormalized);
      const { data: globalOccurrences } = await supabase
        .from('analysis_results')
        .select('test_name_normalized, report_id')
        .in('test_name_normalized', testNames)
        .limit(500);

      if (globalOccurrences && globalOccurrences.length > 0) {
        const globalTestMap = new Map<string, { total: number; inThisRegression: number }>();
        globalOccurrences.forEach(row => {
          const existing = globalTestMap.get(row.test_name_normalized) || { total: 0, inThisRegression: 0 };
          existing.total++;
          if (reportIds.includes(row.report_id)) {
            existing.inThisRegression++;
          }
          globalTestMap.set(row.test_name_normalized, existing);
        });

        const firstSeenInRegression = testNames.filter((t: string) => {
          const data = globalTestMap.get(t);
          return data && data.inThisRegression === 0 && data.total > 0;
        });
        
        const firstSeenGlobally = testNames.filter((t: string) => !globalTestMap.has(t));

        if (firstSeenInRegression.length > 0 || firstSeenGlobally.length > 0) {
          globalFamiliarityInfo = `

## First-Seen Status for Current Failures:

### First in "${regressionBucket}" but SEEN GLOBALLY (reduce uncertainty by 10%):
${firstSeenInRegression.length > 0 
  ? firstSeenInRegression.slice(0, 10).map((t: string) => `• ${t} (has global history)`).join('\n')
  : 'None'}

### First GLOBALLY (reduce confidence by 15-20%, recommend monitoring):
${firstSeenGlobally.length > 0 
  ? firstSeenGlobally.slice(0, 10).map((t: string) => `• ${t} (truly new)`).join('\n')
  : 'None'}`;
        }
      }

      // Fetch aggregated learning patterns (global, from Boost)
      const { data: learningPatterns } = await supabase
        .from('learning_patterns')
        .select('*')
        .order('importance', { ascending: true });

      if (learningPatterns && learningPatterns.length > 0) {
        const criticalPatterns = learningPatterns.filter(p => p.importance === 'critical');
        const highPatterns = learningPatterns.filter(p => p.importance === 'high');
        const notesPatterns = learningPatterns.filter(p => p.pattern_type === 'notes_analysis');
        
        let patternsSection = '';
        
        if (criticalPatterns.length > 0) {
          patternsSection += `
## CRITICAL LEARNING PATTERNS (Global - from AI Boost):
${criticalPatterns.map(p => {
  const notesInfo = p.user_notes_pattern ? ` | Notes: "${p.user_notes_pattern}"` : '';
  return `🔴 Error "${p.error_pattern || 'general'}" - "${p.ai_classification}" should be "${p.correct_classification}" (${p.occurrence_count}x)${notesInfo}`;
}).join('\n')}
`;
        }
        
        if (highPatterns.length > 0) {
          patternsSection += `
## HIGH IMPORTANCE PATTERNS (Global):
${highPatterns.map(p => {
  const notesInfo = p.user_notes_pattern ? ` | Notes: "${p.user_notes_pattern}"` : '';
  return `⚠️ Error "${p.error_pattern || 'general'}" - "${p.ai_classification}" should be "${p.correct_classification}" (${p.occurrence_count}x)${notesInfo}`;
}).join('\n')}
`;
        }
        
        if (notesPatterns.length > 0) {
          patternsSection += `
## USER NOTES PATTERNS:
${notesPatterns.map(p => {
  const keywords = p.extracted_keywords?.join(', ') || 'N/A';
  return `📝 Keywords "${keywords}": ${p.user_notes_pattern} → "${p.correct_classification}" (${p.occurrence_count}x)`;
}).join('\n')}
`;
        }
        
        if (patternsSection) {
          learningPatternsPrompt = patternsSection;
        }
      }

    } catch (dbErr) {
      console.log("Could not fetch historical data, continuing without:", dbErr);
    }

    // Build regression context summary
    regressionContext = `
## REGRESSION CONTEXT: "${regressionBucket}"

All historical data below is ONLY from previous runs of "${regressionBucket}".
Do NOT apply patterns from other regressions.
${globalFamiliarityInfo}
${historicalCorrections}
${passedLocallyPatterns}
${learningPatternsPrompt}
`;

    // Select prompt based on mode
    const basePrompt = mode === 'learning' ? LEARNING_PROMPT : PRODUCTION_PROMPT;

    const systemPrompt = `${basePrompt}

${regressionContext}

## Flaky KB (Known Flaky Tests - Global):
${JSON.stringify(flakyTests, null, 2)}

If a test matches Flaky KB (even fuzzy match), note it in your response.
IMPORTANT: Flaky KB is a supporting signal, not a hard rule.

## Failures to Analyze:
${JSON.stringify(failures, null, 2)}

For EACH failure, respond with JSON array containing objects with:
- classification: "Potential bug" | "Likely Flaky" | "Environment / Infra Issue" | "Expected Change" | "Investigate"
- confidence: 0-100
- suggestedAction: "Open bug" | "Update shared step" | "Rerun only" | "Ignore today / monitor" | "Verify manually"
- priority: "P0" | "P1" | "P2" | "P3"
- priorityReason: bullet points explaining which signals were used (regression-specific data, global patterns, etc.)
- errorPattern: the detected error pattern (use provided pattern as-is)
- requiresRerun: true/false
- rerunReason: explanation
- flakyKBMatch: true/false if matched in Flaky KB

CRITICAL REMINDERS:
1. "Investigate" MUST use "Verify manually" or "Rerun only" - NEVER "Open bug"
2. Check first-seen status for confidence adjustments
3. Prioritize regression-specific data over global patterns

Return ONLY valid JSON array, no markdown.`;

    console.log(`Sending to AI (${mode} mode) for "${regressionBucket}"`);

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
    
    // Post-process to enforce Investigate guardrails
    const processedAnalyses = analyses.map((analysis: any) => {
      // Enforce: Investigate NEVER uses "Open bug"
      if (analysis.classification === 'Investigate' && analysis.suggestedAction === 'Open bug') {
        analysis.suggestedAction = 'Verify manually';
      }
      return analysis;
    });
    
    const results = processedAnalyses.map((analysis: any, idx: number) => ({
      failureId: idx,
      analysis,
    }));

    console.log(`Analysis complete for "${regressionBucket}" (${mode} mode), returning ${results.length} results`);

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
