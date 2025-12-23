import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { failures, flakyTests } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const systemPrompt = `You are an expert QA engineer analyzing test failures from Testim. Classify each failure accurately.

## Classification Rules:
- "Potential bug": Assertion failures, unexpected behavior, logic errors. Low flakiness.
- "Likely Flaky": Element not found, timing issues, intermittent failures. High flakiness.
- "Environment / Infra Issue": Network errors, server 5xx, connection refused. Infrastructure problems.
- "Expected Change": Feature changed, UI updated, intentional changes.

## Priority Rules:
- P0: High confidence Potential bug in critical flow, or repeated assertion failures
- P1: Medium confidence Potential bug, or shared-step changes
- P2: High confidence Flaky, or Environment Issues
- P3: Low confidence Flaky, or one-time issues

## Flaky KB (Known Flaky Tests):
${JSON.stringify(flakyTests, null, 2)}

If a test matches Flaky KB (even fuzzy match), note it in your response.

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
