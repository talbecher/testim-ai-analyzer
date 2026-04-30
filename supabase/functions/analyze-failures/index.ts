import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Strip volatile noise from error text before LLM context (IDs, timestamps, URLs). */
function sanitizeErrorMessage(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  let s = raw;
  s = s.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    '<id>',
  );
  s = s.replace(
    /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2,4})?/gi,
    '<ts>',
  );
  s = s.replace(/\b\d{10,16}\b/g, '<num>');
  s = s.replace(/https?:\/\/[^\s)]+/gi, '<url>');
  s = s.replace(/\s+/g, ' ').trim();
  const MAX = 8000;
  if (s.length > MAX) return `${s.slice(0, MAX)}…`;
  return s;
}

function isSessionWebDriverInfraErrorMessage(errorMessage: unknown): boolean {
  if (typeof errorMessage !== 'string') return false;
  const t = errorMessage.toLowerCase();
  return t.includes('failed to create new session') || t.includes('webdrivererror');
}

function analysisHasSessionWebDriverInfraSignal(analysis: Record<string, unknown>): boolean {
  const sb = analysis.signalBreakdown as { activeSignals?: unknown } | undefined;
  if (!sb || !Array.isArray(sb.activeSignals)) return false;
  return (sb.activeSignals as unknown[]).some((x) => x === 'SESSION_WEBDRIVER_INFRA');
}

function shouldEnforceSessionWebDriverInfra(analysis: Record<string, unknown>, rawErrorMessage: unknown): boolean {
  return isSessionWebDriverInfraErrorMessage(rawErrorMessage) || analysisHasSessionWebDriverInfraSignal(analysis);
}

const SESSION_WEBDRIVER_INFRA_FIRST_SENTENCE =
  'Infrastructure/Environment issue - Please check with testim.io support or verify local grid status.';

function stripFlakyKbFromPriorityReasonEdge(text: string): string {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines
    .filter((l) => {
      const x = l.toLowerCase();
      if (x.includes('matched known flaky')) return false;
      if (x.includes('known flaky test')) return false;
      if (x.includes('flaky kb')) return false;
      if (x.includes('known flaky') && (x.includes('kb') || x.includes('flaky kb'))) return false;
      return true;
    })
    .join('\n');
}

function priorityReasonWithInfraFirstSentenceEdge(pr: string): string {
  const infra = SESSION_WEBDRIVER_INFRA_FIRST_SENTENCE;
  let body = stripFlakyKbFromPriorityReasonEdge(pr)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => {
      const stripped = l.replace(/^•\s*/, '');
      return !stripped.startsWith(infra) && !l.includes('Infrastructure/Environment issue - Please check with testim.io support');
    })
    .join('\n')
    .trim();
  return body ? `${infra}\n${body}` : infra;
}

/** After AI + alignSignal: force env/verify path; Flaky KB / history must not win (P1 → investigate headline). */
function enforceSessionWebDriverInfraOverride(analysis: Record<string, unknown>, rawErrorMessage: unknown): void {
  if (!shouldEnforceSessionWebDriverInfra(analysis, rawErrorMessage)) return;
  analysis.classification = 'Environment / Infra Issue';
  analysis.suggestedAction = 'Verify manually';
  analysis.requiresRerun = true;
  analysis.flakyKBMatch = false;
  analysis.confidence = Math.max(Number(analysis.confidence) || 0, 85);
  analysis.priority = 'P1';
  analysis.rerunReason =
    typeof analysis.rerunReason === 'string' && analysis.rerunReason.trim()
      ? `Session/WebDriver infrastructure — verify grid before rerun. ${analysis.rerunReason}`
      : 'Session/WebDriver infrastructure — verify grid/session stability before rerun';

  const sb = (analysis.signalBreakdown as Record<string, unknown>) || {};
  const prevSignals = Array.isArray(sb.activeSignals) ? (sb.activeSignals as string[]) : [];
  const filtered = prevSignals.filter(
    (s) =>
      typeof s === 'string' &&
      !/^FLAKY_KB/i.test(s) &&
      s !== 'FLAKY_KB_MATCH' &&
      !/^PASSED_LOCALLY/i.test(s),
  );
  const activeSignals = Array.from(new Set([...filtered, 'SESSION_WEBDRIVER_INFRA']));
  analysis.signalBreakdown = {
    ...sb,
    bugScore: 5,
    flakyScore: 5,
    environmentScore: 88,
    investigateScore: 5,
    activeSignals,
  };

  const rawPr = typeof analysis.priorityReason === 'string' ? analysis.priorityReason : '';
  analysis.priorityReason = priorityReasonWithInfraFirstSentenceEdge(rawPr);
}

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

// Session / WebDriver infrastructure — must not be dismissed as low-priority or skip-style triage
const INFRASTRUCTURE_SESSION_WEBDRIVER_RULE = `
## 1b. TESTIM SESSION / WEBDRIVER INFRASTRUCTURE (MANDATORY WHEN TRIGGERED)

Apply this block when **either** is true:
- **errorMessage** (case-insensitive) contains \`Failed to create new session\` OR \`WebDriverError\`, **OR**
- You already set **activeSignals** to include \`SESSION_WEBDRIVER_INFRA\` for this failure.

Then you MUST (STRICT OVERRIDE — beats Flaky KB, regression "passed locally" / flaky history, and dismissive triage):
1. **Classification:** \`Environment / Infra Issue\` ONLY — never Likely Flaky, never Potential bug for this failure.
2. **suggestedAction:** \`Verify manually\` ONLY — never "Ignore today / monitor" as the primary action.
3. **flakyKBMatch:** \`false\` in JSON output even if the test name would match Flaky KB (do not cite Flaky KB as the driver for this row).
4. **Confidence:** 85–95%.
5. **priority:** \`P1\` (so triage treats this as requiring human follow-up, not skip-investigate).
6. **requiresRerun:** \`true\`; **rerunReason** must say grid/session must be stable before rerun.
7. **priorityReason:** The **very first sentence** (first line of text) MUST be exactly:
   Infrastructure/Environment issue - Please check with testim.io support or verify local grid status.
   Do NOT mention "Matched known flaky test", "Known flaky", or "Flaky KB" anywhere in priorityReason for this row.
8. **signalBreakdown:** \`environmentScore\` ≥ 85; \`flakyScore\` ≤ 15; include \`SESSION_WEBDRIVER_INFRA\`; do NOT list FLAKY_KB_MATCH, PASSED_LOCALLY*, or other flaky-history signals for this row.

**Priority:** This block **strictly overrides** §4–§6 (historical flaky, passed-locally, Flaky KB) whenever triggered — including when only \`SESSION_WEBDRIVER_INFRA\` is present in activeSignals.
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
- **IGNORE for classification/suggestedAction** when §1b applies (\`SESSION_WEBDRIVER_INFRA\` / session-WebDriver error text): do not steer toward Likely Flaky from old corrections

## 5. PASSED LOCALLY PATTERNS (THIS REGRESSION ONLY)
- Passed locally 3+ times → Very strong signal for Likely Flaky
- Passed locally 1-2 times → Supporting signal only
- **IGNORE** when §1b \`SESSION_WEBDRIVER_INFRA\` applies — infrastructure failures are not disproved by local passes

## 6. FLAKY KB MATCH (GLOBAL)
- If matched → increase probability of Likely Flaky
- This is a supporting signal, not an absolute rule
- **STRICT EXCEPTION (§1b):** If SESSION_WEBDRIVER_INFRA applies (\`Failed to create new session\` or \`WebDriverError\` in errorMessage), **ignore Flaky KB** for classification and suggestedAction; set flakyKBMatch false; do not prepend "Known flaky" to priorityReason

## 7. ERROR PATTERN HEURISTICS (USE ONLY IF ABOVE SIGNALS WEAK)
- Element not found → usually Likely Flaky (UI/timing related)
- Element is not visible → usually Likely Flaky
- Timeout → Likely Flaky or Environment / Infra Issue
- AssertionError → usually Potential bug
- Network / infra errors → Environment / Infra Issue
- Null / Undefined errors → Potential bug unless strong flaky signals exist

## 7.5. CROSS-RUN HISTORY (GLOBAL — HIGH WEIGHT)

Each failure may include a \`history\` object built from prior **uploaded** runs (all regression buckets). A run is a row in \`analysis_reports\`. A test **failed** in a run if it appears in that run's failures; **passed** implicitly if it was already "known" from an earlier failing upload and has no failure row for that run.

Use \`history\` as a **HIGH-WEIGHT** narrative signal. The model may override it only when **§0 P0 safety**, **§1 Investigate fallback**, or **§1b SESSION_WEBDRIVER_INFRA** applies — history must **never** contradict those.

Guidance (also nudge **signalBreakdown** scores and **priorityReason** accordingly):
- **pattern=\`was-passing-now-failing\`** (e.g. ≥2 passes in the last 3 prior uploads): strongly lean **Investigate** (regression smell). Bump **investigateScore** by ~25; mention "passed in last N runs" in **priorityReason**.
- **pattern=\`consistent-failure\`** (≥3 consecutive fails including this run): lean **Potential bug** when **assertion mismatch**, **real selector failure**, or other bug signals align; bump **bugScore** by ~15.
- **pattern=\`intermittent\`**: lean **Likely Flaky**; bump **flakyScore** by ~15.
- **pattern=\`first-seen\`**: reduce confidence by ~10–15% when ambiguous; prefer **Investigate** as tie-breaker; do **not** stack extra penalties beyond existing first-seen rules.
- **pattern=\`sporadic-failure\`**: neutral weight; use other signals.

Add to **activeSignals** when applicable: \`GLOBAL_HISTORY_REGRESSION_SMELL\`, \`GLOBAL_HISTORY_CONSISTENT_FAIL\`, \`GLOBAL_HISTORY_INTERMITTENT\`, \`GLOBAL_HISTORY_FIRST_SEEN\`.

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

## 9. STREAK ANALYSIS (BUCKET-SCOPED — passed_locally)
When streakInfo is present (this regression bucket only):
- isIntermittent: true (2+ alternations in 4+ runs) → 80-85% confidence Likely Flaky
- isConsistentFailure: true (3+ consecutive fails, no local pass) → 85% confidence Potential bug
- streakLength < 3 → Low history, reduce confidence by 10%

Add to priorityReason when applicable:
- "Intermittent pattern (X alternations) - strong flaky signal"
- "Failed X times consecutively - consistent failure pattern"

**Note:** \`streakInfo\` is regression-scoped. \`history\` (§7.5) is **global** across uploads — use both; when they conflict, prefer **§7.5** for "was passing, now failing" regression smell, and **§9** for passed-locally flaky evidence.
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

const HIERARCHY_OF_EVIDENCE = `
## HIERARCHY OF EVIDENCE (TRIAGE vs CLASSIFICATION)

Apply signals in this order when they conflict:
1) P0 safety, Investigate fallback, and §1b session/WebDriver infra (absolute)
2) Regression-specific corrections and passed-locally history (this bucket only)
3) **Global cross-run history** (\`history.pattern\`, §7.5) — regression smell vs intermittent vs consistent global fails
4) Co-failure / systemic signals and bucket-scoped **streakInfo** (§9)
5) Flaky KB and environment-style error families
6) Heuristic error-pattern hints (use last)

### Assertions vs "Expected Change" (UI copy / data only)
- Assertion failures still warrant **human triage**: keep **suggestedAction** in the "verify" family ("Verify manually" or "Rerun only") when the failure is an assertion — QA should confirm before closing.
- For **classification**: when the mismatch is clearly **UI text/copy**, **labels**, **cosmetic strings**, or **stale test data / fixture** (not broken product logic), prefer **"Expected Change"** over **"Potential bug"**, unless regression corrections or co-failure strongly indicate a real defect.
- True application logic or API contract breaks → **"Potential bug"** remains appropriate.

Do not use "Open bug" for "Investigate". Prefer lowering confidence over guessing when evidence is split between Expected Change and bug.
`;

// Streak info shape (matches TestStreakInfo from frontend types)
interface StreakInfo {
  totalRuns: number;
  failedRuns: number;
  passedLocallyRuns: number;
  currentStreak: 'pass' | 'fail' | 'alternating';
  streakLength: number;
  alternationCount: number;
  isIntermittent: boolean;
  isConsistentFailure: boolean;
  lastClassifications: string[];
}

function computeStreakInfo(
  rows: Array<{ report_id: string; passed_locally: boolean | null; ai_classification: string }>,
  reportIdToDate: Map<string, string>
): StreakInfo {
  if (rows.length === 0) {
    return {
      totalRuns: 0,
      failedRuns: 0,
      passedLocallyRuns: 0,
      currentStreak: 'fail',
      streakLength: 0,
      alternationCount: 0,
      isIntermittent: false,
      isConsistentFailure: false,
      lastClassifications: [],
    };
  }
  const sorted = [...rows].sort(
    (a, b) => (reportIdToDate.get(a.report_id) || '').localeCompare(reportIdToDate.get(b.report_id) || '')
  );
  const totalRuns = sorted.length;
  const failedRuns = sorted.filter((r) => r.passed_locally !== true).length;
  const passedLocallyRuns = sorted.filter((r) => r.passed_locally === true).length;
  const outcomes = sorted.map((r) => (r.passed_locally === true ? 'pass' : 'fail'));
  let alternationCount = 0;
  for (let i = 1; i < outcomes.length; i++) {
    if (outcomes[i] !== outcomes[i - 1]) alternationCount++;
  }
  const rev = [...outcomes].reverse();
  let streakLength = 0;
  const firstOutcome = rev[0];
  for (const o of rev) {
    if (o !== firstOutcome) break;
    streakLength++;
  }
  const currentStreak: 'pass' | 'fail' | 'alternating' =
    rev.length >= 2 && rev[0] !== rev[1] ? 'alternating' : firstOutcome === 'pass' ? 'pass' : 'fail';
  const isIntermittent = totalRuns >= 4 && alternationCount >= 2;
  const consecutiveFailsFromEnd = rev.findIndex((o) => o === 'pass');
  const failStreak = consecutiveFailsFromEnd < 0 ? rev.length : consecutiveFailsFromEnd;
  const isConsistentFailure = failStreak >= 3;
  const lastClassifications = [...sorted]
    .reverse()
    .slice(0, 5)
    .map((r) => r.ai_classification || '');
  return {
    totalRuns,
    failedRuns,
    passedLocallyRuns,
    currentStreak,
    streakLength,
    alternationCount,
    isIntermittent,
    isConsistentFailure,
    lastClassifications,
  };
}

type TestHistoryPattern =
  | 'first-seen'
  | 'was-passing-now-failing'
  | 'consistent-failure'
  | 'intermittent'
  | 'sporadic-failure';

interface TestHistory {
  totalRunsKnown: number;
  failedRuns: number;
  passedRuns: number;
  lastNOutcomes: ('pass' | 'fail')[];
  currentFailStreak: number;
  currentPassStreak: number;
  recentPassRate: number;
  isFirstSeenGlobally: boolean;
  pattern: TestHistoryPattern;
}

/** Global implicit pass/fail series from last 30 uploads; current run is not in DB — streak includes this failure as +1. */
async function computeGlobalTestHistoryMap(
  supabase: ReturnType<typeof createClient>,
  testNames: string[],
  globalRowCountByTest: Map<string, number>,
): Promise<Map<string, TestHistory>> {
  const out = new Map<string, TestHistory>();
  const unique = [...new Set(testNames)];
  if (unique.length === 0) return out;

  const { data: recentReports } = await supabase
    .from('analysis_reports')
    .select('id, run_date, created_at')
    .order('run_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);

  const reportsChrono = [...(recentReports || [])].reverse() as Array<{ id: string; run_date: string; created_at: string }>;
  const reportIds = reportsChrono.map((r) => r.id);
  const failsByReport = new Map<string, Set<string>>();

  if (reportIds.length > 0) {
    const { data: failRows } = await supabase
      .from('analysis_results')
      .select('report_id, test_name_normalized')
      .in('report_id', reportIds)
      .in('test_name_normalized', unique);

    for (const row of failRows || []) {
      const rid = row.report_id as string;
      const tn = row.test_name_normalized as string;
      if (!failsByReport.has(rid)) failsByReport.set(rid, new Set());
      failsByReport.get(rid)!.add(tn);
    }
  }

  for (const T of unique) {
    const globalTotal = globalRowCountByTest.get(T) ?? 0;
    const isFirstSeenGlobally = globalTotal === 0;

    let firstIdx = -1;
    for (let i = 0; i < reportsChrono.length; i++) {
      if (failsByReport.get(reportsChrono[i].id)?.has(T)) {
        firstIdx = i;
        break;
      }
    }

    const priorOutcomes: ('pass' | 'fail')[] = [];
    if (firstIdx >= 0) {
      for (let i = firstIdx; i < reportsChrono.length; i++) {
        const rid = reportsChrono[i].id;
        priorOutcomes.push(failsByReport.get(rid)?.has(T) ? 'fail' : 'pass');
      }
    }

    let trailingFails = 0;
    for (let j = priorOutcomes.length - 1; j >= 0; j--) {
      if (priorOutcomes[j] === 'fail') trailingFails++;
      else break;
    }
    const currentFailStreak = 1 + trailingFails;

    let trailingPasses = 0;
    for (let j = priorOutcomes.length - 1; j >= 0; j--) {
      if (priorOutcomes[j] === 'pass') trailingPasses++;
      else break;
    }
    const currentPassStreak = trailingPasses;

    const last5 = priorOutcomes.slice(-5);
    const recentPassRate = last5.length === 0 ? 0 : last5.filter((o) => o === 'pass').length / last5.length;

    const failedRuns = priorOutcomes.filter((o) => o === 'fail').length;
    const passedRuns = priorOutcomes.filter((o) => o === 'pass').length;
    const lastNOutcomes = [...priorOutcomes].reverse().slice(0, 10) as ('pass' | 'fail')[];

    let pattern: TestHistoryPattern;
    if (isFirstSeenGlobally) {
      pattern = 'first-seen';
    } else {
      const last3 = priorOutcomes.slice(-3);
      const passesInLast3 = last3.filter((o) => o === 'pass').length;
      if (priorOutcomes.length >= 2 && passesInLast3 >= 2) {
        pattern = 'was-passing-now-failing';
      } else if (currentFailStreak >= 3) {
        pattern = 'consistent-failure';
      } else {
        const last5ForAlt = priorOutcomes.slice(-5);
        let transitions = 0;
        for (let i = 1; i < last5ForAlt.length; i++) {
          if (last5ForAlt[i] !== last5ForAlt[i - 1]) transitions++;
        }
        if (last5ForAlt.length >= 3 && transitions >= 2) {
          pattern = 'intermittent';
        } else {
          pattern = 'sporadic-failure';
        }
      }
    }

    out.set(T, {
      totalRunsKnown: priorOutcomes.length,
      failedRuns,
      passedRuns,
      lastNOutcomes,
      currentFailStreak,
      currentPassStreak,
      recentPassRate: Math.round(recentPassRate * 100) / 100,
      isFirstSeenGlobally,
      pattern,
    });
  }

  return out;
}

// Map dominant signal direction to expected classification (for signalBreakdown alignment)
function getClassificationFromDominant(bugScore: number, flakyScore: number, environmentScore: number, investigateScore: number): string {
  const scores = [
    ['Potential bug', bugScore],
    ['Likely Flaky', flakyScore],
    ['Environment / Infra Issue', environmentScore],
    ['Investigate', investigateScore],
  ] as [string, number][];
  const dominant = scores.reduce((a, b) => (a[1] >= b[1] ? a : b));
  return dominant[0];
}

const HARD_TRIAGE_CLASSES = new Set([
  'Potential bug',
  'Likely Flaky',
  'Environment / Infra Issue',
]);

/** Bug vs flaky vs env disagree — needs escalation; soft classes handled with confidence only. */
function isCriticalSignalClassificationMismatch(current: string, expected: string): boolean {
  if (current === expected) return false;
  if (!HARD_TRIAGE_CLASSES.has(current) || !HARD_TRIAGE_CLASSES.has(expected)) return false;
  return current !== expected;
}

// Critical mismatch → Investigate; minor mismatch → lower confidence only
function alignSignalBreakdownWithClassification(analysis: Record<string, unknown>): void {
  const sb = analysis.signalBreakdown as { bugScore?: number; flakyScore?: number; environmentScore?: number; investigateScore?: number } | undefined;
  if (!sb || (typeof sb.bugScore !== 'number' && typeof sb.flakyScore !== 'number')) return;
  const bug = typeof sb.bugScore === 'number' ? sb.bugScore : 0;
  const flaky = typeof sb.flakyScore === 'number' ? sb.flakyScore : 0;
  const env = typeof sb.environmentScore === 'number' ? sb.environmentScore : 0;
  const inv = typeof sb.investigateScore === 'number' ? sb.investigateScore : 0;
  const expected = getClassificationFromDominant(bug, flaky, env, inv);
  const current = analysis.classification as string;
  if (current === expected) return;

  if (isCriticalSignalClassificationMismatch(current, expected)) {
    analysis.confidence = Math.min(Number(analysis.confidence) || 70, 65);
    analysis.classification = 'Investigate';
    analysis.suggestedAction = 'Verify manually';
    if (typeof analysis.priorityReason === 'string') {
      analysis.priorityReason = `• signalBreakdown indicated "${expected}" vs classification "${current}"; escalated to Investigate.\n${analysis.priorityReason}`;
    }
    return;
  }

  const prev = Number(analysis.confidence) || 70;
  analysis.confidence = Math.max(0, Math.min(prev, prev - 12));
  if (typeof analysis.priorityReason === 'string') {
    analysis.priorityReason = `• signalBreakdown leaned "${expected}" vs classification "${current}"; lowered confidence only.\n${analysis.priorityReason}`;
  }
}

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
- NETWORK_ERROR, TIMEOUT_SHORT, TIMEOUT_LONG, INFRA_PATTERN, CO_FAILURE_INFRA, SESSION_WEBDRIVER_INFRA
- FIRST_SEEN_GLOBALLY, FIRST_SEEN_IN_REGRESSION, CONFLICTING_SIGNALS, MANUAL_CHANGE_DETECTED, LOW_HISTORY
- GLOBAL_HISTORY_REGRESSION_SMELL, GLOBAL_HISTORY_CONSISTENT_FAIL, GLOBAL_HISTORY_INTERMITTENT, GLOBAL_HISTORY_FIRST_SEEN

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
${INFRASTRUCTURE_SESSION_WEBDRIVER_RULE}
${REGRESSION_LEARNING}
${FIRST_SEEN_HANDLING}
${DECISION_FRAMEWORK}
${ASSERTION_RULES}
${CO_FAILURE_RULES}
${GUARDRAILS}
${HIERARCHY_OF_EVIDENCE}
${OUTPUT_REQUIREMENTS}`;

// Production mode prompt - focus on actionable recommendations
const PRODUCTION_PROMPT = `You are an expert QA engineer analyzing test failures from Testim for DECISION SUPPORT.
The user needs your help to classify and prioritize these failures. Provide clear, actionable recommendations.
Be confident but acknowledge uncertainty when appropriate.

${P0_SAFETY_RULE}
${INVESTIGATE_FALLBACK}
${INFRASTRUCTURE_SESSION_WEBDRIVER_RULE}
${REGRESSION_LEARNING}
${FIRST_SEEN_HANDLING}
${DECISION_FRAMEWORK}
${ASSERTION_RULES}
${CO_FAILURE_RULES}
${GUARDRAILS}
${HIERARCHY_OF_EVIDENCE}
${OUTPUT_REQUIREMENTS}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { failures, flakyTests, mode = 'production', regressionBucket } = await req.json();

    // Feature toggle: OpenAI if key exists and is valid; else Lovable fallback
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const useOpenAI = Boolean(
      OPENAI_API_KEY?.trim() &&
      !OPENAI_API_KEY.toLowerCase().includes('waiting_for_token')
    );
    if (!useOpenAI && !LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured (required when OPENAI_API_KEY is not set)');
    }

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
    let confirmedPatterns = '';
    let passedLocallyPatterns = '';
    let learningPatternsPrompt = '';
    let globalFamiliarityInfo = '';
    let fewShotExamples = '';
    const streakMap = new Map<string, StreakInfo>();
    let historyByTest = new Map<string, TestHistory>();
    const testNames = failures.map((f: { testNameNormalized: string }) => f.testNameNormalized);

    try {
      const globalTestMap = new Map<string, { total: number; inThisRegression: number }>();

      // Step 1: Get report IDs and run_date for THIS regression bucket (for streak ordering)
      const { data: regressionReports, error: reportsError } = await supabase
        .from('analysis_reports')
        .select('id, run_date')
        .eq('regression_bucket', regressionBucket);

      const reportIds = regressionReports?.map((r: { id: string }) => r.id) || [];
      const reportIdToDate = new Map<string, string>(
        (regressionReports || []).map((r: { id: string; run_date: string }) => [r.id, r.run_date])
      );
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
            // Few-shot: 2–3 examples from corrections for this regression
            const forFewShot = [...criticalCorrections, ...highCorrections].slice(0, 3);
            if (forFewShot.length > 0) {
              fewShotExamples = `

## FEW-SHOT EXAMPLES (from this regression – follow these patterns):
${forFewShot.map((c, i) => `Example ${i + 1}: For failures with error_pattern "${c.pattern || 'general'}", users in "${regressionBucket}" corrected AI "${c.from}" to "${c.to}" (${c.count}x). Prefer classification "${c.to}" and mention the correction in priorityReason.`).join('\n')}
`;
            }
          }
        }

        // Step 2b: Confirmed patterns (was_correct === true) – positive feedback for same regression
        const { data: confirmed, error: confError } = await supabase
          .from('analysis_results')
          .select('test_name_normalized, error_pattern, ai_classification')
          .in('report_id', reportIds)
          .eq('was_correct', true)
          .not('ai_classification', 'is', null)
          .limit(200);

        if (!confError && confirmed && confirmed.length > 0) {
          const confMap = new Map<string, { pattern: string | null; classification: string; count: number; examples: string[] }>();
          confirmed.forEach((row: { test_name_normalized: string; error_pattern: string | null; ai_classification: string }) => {
            const key = `${row.error_pattern || 'general'}|${row.ai_classification}`;
            const existing = confMap.get(key);
            if (existing) {
              existing.count++;
              if (existing.examples.length < 2) existing.examples.push(row.test_name_normalized);
            } else {
              confMap.set(key, {
                pattern: row.error_pattern,
                classification: row.ai_classification,
                count: 1,
                examples: [row.test_name_normalized],
              });
            }
          });
          const topConfirmed = Array.from(confMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
          if (topConfirmed.length > 0) {
            confirmedPatterns = `

## Confirmed Patterns for "${regressionBucket}" (user agreed with AI):
${topConfirmed.map((c) => `• Error "${c.pattern || 'general'}": AI said "${c.classification}" → user confirmed (${c.count}x). Examples: ${c.examples.slice(0, 2).join(', ')}`).join('\n')}`;
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
      const { data: globalOccurrences } = await supabase
        .from('analysis_results')
        .select('test_name_normalized, report_id')
        .in('test_name_normalized', testNames)
        .limit(500);

      if (globalOccurrences && globalOccurrences.length > 0) {
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

      // Step 5: Streak history for current failures (for DECISION_FRAMEWORK §9)
      if (reportIds.length > 0 && testNames.length > 0) {
        const { data: streakRows, error: streakErr } = await supabase
          .from('analysis_results')
          .select('report_id, test_name_normalized, passed_locally, ai_classification')
          .in('report_id', reportIds)
          .in('test_name_normalized', testNames);

        if (!streakErr && streakRows && streakRows.length > 0) {
          const byTest = new Map<string, typeof streakRows>();
          streakRows.forEach((row: { report_id: string; test_name_normalized: string; passed_locally: boolean | null; ai_classification: string }) => {
            const list = byTest.get(row.test_name_normalized) || [];
            list.push(row);
            byTest.set(row.test_name_normalized, list);
          });
          byTest.forEach((rows, testName) => {
            streakMap.set(testName, computeStreakInfo(rows, reportIdToDate));
          });
          console.log(`Computed streakInfo for ${streakMap.size} tests`);
        }
      }

      const globalRowCountByTest = new Map<string, number>();
      globalTestMap.forEach((v, k) => globalRowCountByTest.set(k, v.total));
      try {
        historyByTest = await computeGlobalTestHistoryMap(supabase, testNames, globalRowCountByTest);
        console.log(`Computed global cross-run history for ${historyByTest.size} tests`);
      } catch (hErr) {
        console.log('computeGlobalTestHistoryMap failed:', hErr);
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
        const confirmedLearning = learningPatterns.filter((p: { pattern_type: string }) => p.pattern_type === 'confirmed');
        if (confirmedLearning.length > 0) {
          patternsSection += `
## CONFIRMED PATTERNS (user agreed with AI - reinforce these):
${confirmedLearning.slice(0, 15).map((p: { error_pattern: string | null; ai_classification: string | null; occurrence_count: number }) =>
  `✓ Error "${p.error_pattern || 'general'}": "${p.ai_classification}" confirmed (${p.occurrence_count}x)`
).join('\n')}
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
${confirmedPatterns}
${passedLocallyPatterns}
${learningPatternsPrompt}
`;

    // Enrich failures with streakInfo (§9) and global history (§7.5)
    const failuresForPrompt = failures.map((f: { testNameNormalized: string; errorMessage?: string; [key: string]: unknown }) => ({
      ...f,
      errorMessage: sanitizeErrorMessage(f.errorMessage),
      streakInfo: streakMap.get(f.testNameNormalized) ?? undefined,
      history: historyByTest.get(f.testNameNormalized) ?? undefined,
    }));

    // Select prompt based on mode
    const basePrompt = mode === 'learning' ? LEARNING_PROMPT : PRODUCTION_PROMPT;

    const systemPrompt = `${basePrompt}

${regressionContext}

## Flaky KB (Known Flaky Tests - Global):
${JSON.stringify(flakyTests, null, 2)}

If a test matches Flaky KB (even fuzzy match), note it in your response.
IMPORTANT: Flaky KB is a supporting signal, not a hard rule.

## Failures to Analyze:
Each failure may include **streakInfo** (this regression bucket, passed_locally) and **history** (global cross-run uploads, §7.5). Use both; **history** drives regression smell vs global intermittent/consistent failure.
When streakInfo is present: isIntermittent → Likely Flaky; isConsistentFailure → Potential bug (bucket-scoped).
When history is present: follow §7.5 score nudges and priorityReason cues.
${JSON.stringify(failuresForPrompt, null, 2)}

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
2. Recommend Investigate when classification is Potential bug or Investigate, or priority is P0/P1; otherwise recommend Skip (when classification is Investigate, suggest Verify manually).
3. Check first-seen status for confidence adjustments
4. Prioritize regression-specific data over global patterns
${fewShotExamples}

Return ONLY valid JSON array, no markdown.`;

    const userMessage = useOpenAI
      ? "Analyze these failures. Output a JSON object with a single key 'analyses' containing an array of classification objects. Each object must have: classification, confidence, suggestedAction, priority, priorityReason, errorPattern, requiresRerun, rerunReason, flakyKBMatch, signalBreakdown."
      : "Analyze these failures and return the JSON array.";

    const aiUrl = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiKey = useOpenAI ? OPENAI_API_KEY! : LOVABLE_API_KEY!;
    const modelName = useOpenAI ? "gpt-4o-mini" : "google/gemini-2.5-flash";
    const aiBody: Record<string, unknown> = {
      model: modelName,
      temperature: 0.1,
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMessage },
      ],
    };
    if (useOpenAI) {
      aiBody.response_format = { type: "json_object" };
    }

    console.log(`QA Audit: Sending to AI (${useOpenAI ? 'OpenAI' : 'Lovable'} ${mode} mode, model: ${modelName}) for "${regressionBucket}"`);
    console.log('QA Audit: Target model is:', modelName);

    let analyses: unknown[];
    try {
      const response = await fetch(aiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('QA Audit: AI call failed. Attempted model:', modelName, '| Status:', response.status, '| Body:', errorText);
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

      const usage = data.usage;
      if (usage) {
        console.log('QA Audit: AI Usage Metrics:', usage);
      }

      let content = data.choices?.[0]?.message?.content || (useOpenAI ? "{}" : "[]");

      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      if (useOpenAI) {
        const parsed = JSON.parse(content) as Record<string, unknown> | unknown[];
        analyses = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as Record<string, unknown>).analyses)
            ? (parsed as Record<string, unknown>).analyses as unknown[]
            : [];
      } else {
        analyses = JSON.parse(content) as unknown[];
      }
    } catch (err) {
      console.error('QA Audit: AI call failed. Attempted model:', modelName, '| Error:', err);
      console.error("AI classification failed:", err);
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "AI classification failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Post-process: enforce Investigate guardrails and align signalBreakdown with classification
    const processedAnalyses = analyses.map((analysis: any, idx: number) => {
      // Enforce: Investigate NEVER uses "Open bug"
      if (analysis.classification === 'Investigate' && analysis.suggestedAction === 'Open bug') {
        analysis.suggestedAction = 'Verify manually';
      }
      // Align classification with dominant direction in signalBreakdown; if mismatch, reduce confidence and set Investigate
      alignSignalBreakdownWithClassification(analysis);
      const rawFailure = failures[idx] as { errorMessage?: string } | undefined;
      enforceSessionWebDriverInfraOverride(analysis, rawFailure?.errorMessage);
      return analysis;
    });
    
    const results = processedAnalyses.map((analysis: any, idx: number) => {
      const norm = (failures[idx] as { testNameNormalized?: string })?.testNameNormalized;
      const hist = norm ? historyByTest.get(norm) : undefined;
      return {
        failureId: idx,
        analysis: hist ? { ...analysis, history: hist } : analysis,
      };
    });

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
