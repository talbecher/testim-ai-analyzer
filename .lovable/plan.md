## Test History v2 — Bigger squares + per-run hover (v1.2.3)

Quick answers folded into the changelog:
- **Green square** = the test was NOT in the failures CSV uploaded for that run (implicit pass).
- **`first seen`** = no record of this test name in `analysis_results` ever — first time we're seeing it. Not a bug.

### 1. Extend `TestHistory` with per-run details

`src/types/testim.ts` — add a parallel array next to `lastNOutcomes`:

```ts
export interface TestHistoryRunDetail {
  outcome: 'pass' | 'fail';
  runName?: string;       // analysis_reports.run_name
  runDate?: string;       // analysis_reports.run_date (YYYY-MM-DD)
  aiClassification?: string;  // only set when outcome === 'fail'
}

export interface TestHistory {
  /* existing fields unchanged */
  lastNRunDetails: TestHistoryRunDetail[];  // newest → oldest, same order as lastNOutcomes
}
```

Keep `lastNOutcomes` for backwards compatibility — the chip will derive from `lastNRunDetails` when present, else fall back to `lastNOutcomes`.

### 2. Edge function — `supabase/functions/analyze-failures/index.ts`

Inside `computeGlobalTestHistoryMap`:

- Pull `run_name` into the recent-reports select (`select('id, run_date, created_at, run_name')`).
- Expand the `analysis_results` select to `report_id, test_name_normalized, ai_classification`.
- Build `failsByReport` as `Map<reportId, Map<testName, ai_classification>>` (so we can look up the classification per fail).
- When constructing `priorOutcomes`, also build a parallel `priorRunDetails: TestHistoryRunDetail[]` carrying `runName`, `runDate`, and `aiClassification` (only for fails).
- Reverse and slice the same way to produce `lastNRunDetails` (length matches `lastNOutcomes`).

No change to scoring/pattern logic.

### 3. Bigger, more readable chip — `src/components/TestHistoryChip.tsx`

- Square sizes:
  - Default: `h-3 w-3 rounded-[3px]` (was `h-2 w-2`).
  - Current run (last item, on the right): `h-3.5 w-3.5 rounded-[4px]` + ring (kept).
- Gap between squares: `gap-[3px]` (was 2px).
- Warning glyph: `h-3.5 w-3.5` (was `h-3 w-3`).
- "first seen" pill stays as-is but with the slightly bigger muted square.

**Per-square hover (NEW)** — only on **failed** squares (red):

- Wrap each `<span>` square in its own `Tooltip` (Radix tooltips can nest inside the outer one because each has its own `Root`; we'll just render the per-square tooltip independently and skip the outer tooltip wrapping the strip). Cleanest: drop the outer wrapper, instead render a separate "summary" tooltip on a tiny info dot at the end of the strip, and per-run tooltips on the squares themselves.

Final structure:

```text
[▢ ▣ ▢ ▢ ▣ ▢ ▣]  ⚠   ⓘ
  ↑ each red square = hover shows: 
     Run: <run_name or "Run YYYY-MM-DD">
     Classified as: <ai_classification>
  ↑ green squares = simple "Passed (run YYYY-MM-DD)" tooltip
  ↑ ⓘ = the existing summary tooltip (pattern + counts + chronological strip)
```

Implementation details:
- Per-square tooltip content is small: line 1 `font-medium` with run label, line 2 `text-muted-foreground` with classification (or "Passed — not in failures CSV" for greens).
- Use a tiny `Info` icon (`h-3 w-3 text-muted-foreground/60`) at the end as the trigger for the existing summary tooltip; remove the outer wrapper so per-square hover works without conflict.
- All squares get `cursor-help` to signal interactivity.

### 4. Version bump

- `package.json`: `1.2.2` → `1.2.3`.
- `src/version.ts`: same + CHANGELOG entry: "Test History squares enlarged; hover any failed square to see how that run was classified; clarified that green = test absent from uploaded failures, `first seen` = no prior failures on record."
- `CHANGELOG.md`: matching entry.

### 5. Memory updates

Update `mem://features/guidance-mode-ui` (or add a small new memory `mem://features/test-history-chip`) to record:
- Green = implicit pass (not in failures CSV).
- `first seen` = no prior `analysis_results` row for this normalized test name.
- Per-run hover shows `ai_classification` for failed runs.

### Out of scope

- No change to history window size (still 30) or pattern thresholds.
- No change to AI prompt — the model already gets `history`; per-run classification is UI-only context.
- No change to `FailureReviewCard` placement — it picks up the new visual automatically.
