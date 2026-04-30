## Test History Timeline (v1.2.2)

Replace the current text-emoji chip with a compact, monitoring-tool–style timeline that lives inline in the Context row. No logic changes to the engine — only the visual component and a small placement tweak.

### 1. Redesign `src/components/TestHistoryChip.tsx`

Rewrite the render layer; keep props (`history: TestHistory`) and the `chipCopy` / pattern→label logic for the tooltip.

**Visual structure** (single inline-flex element, height ~14px to match `text-xs` neighbors):

```text
[▢ ▢ ▣ ▣ ▣]  ⚠   ← warning only when pattern === 'was-passing-now-failing'
 oldest → newest (current = last, slightly larger + ring)
```

- Render `lastNOutcomes` reversed (oldest → newest, LTR) as a row of squares, `gap-[2px]`.
- Each square: `h-2 w-2 rounded-[2px]`.
  - Pass → `bg-confidence-high` (existing token, green).
  - Fail → `bg-bug` (existing token, red).
- Current run (last item): `h-2.5 w-2.5 rounded-[3px] ring-1 ring-foreground/30 ring-offset-1 ring-offset-background` to lift it above the strip.
- Empty history (`lastNOutcomes.length === 0`): render a single muted square + label "first seen" in `text-[10px] text-muted-foreground`. No ring.
- Cap visible squares at 8 (slice from the end). If truncated, prefix with `…` in `text-muted-foreground text-[10px]`.

**Warning glyph** (only `pattern === 'was-passing-now-failing'`):
- `AlertTriangle` from lucide-react, `h-3 w-3 text-amber-500`, `ml-1`, no background, no border.
- Skip the warning for `consistent-failure` and `intermittent` — the colored squares already convey it.

**Tooltip** (keep existing `Tooltip` wrapper, refine copy):
- Line 1 (font-medium): pattern-specific phrase from a small map:
  - `was-passing-now-failing` → "Regression smell — was passing, now failing"
  - `consistent-failure` → `Consistent fail for last ${currentFailStreak} run(s)`
  - `intermittent` → "Intermittent pattern — alternating outcomes"
  - `first-seen` → "First failure on record for this test"
  - `sporadic-failure` → "Sporadic failures across recent runs"
- Line 2 (`text-muted-foreground`): `Failed ${failedRuns} of ${totalRunsKnown} prior uploads` (or "No prior uploads" when 0).
- Line 3 (`text-muted-foreground text-[11px]`): show the chronological strip as small dots `· · ● · ●` using bullets to mirror the squares (oldest → newest), so the tooltip reinforces the visual.

**Wrapper:**
- `<span dir="ltr" className="inline-flex items-center cursor-default">` — no background, no border, no padding. The chip is just dots; it visually belongs to the Context row, not as a separate pill.

Drop the `font-mono` text label, the `(sub)` parenthetical, and `chipStyles` background classes — they're what made it feel "buttony".

### 2. Placement in `src/components/ProductionModeCard.tsx`

In the Context row (currently around the `confidence%` + chips block):

Reorder to:

```text
Context: [Classification] • [Priority] • 87% confidence • [▢▢▣▣▣] ⚠ • Known flaky • Rerun suggested
```

- Move the `<TestHistoryChip />` render so it sits **immediately after** the `confidence` span and **before** the `flakyKBMatch` / `requiresRerun` badges.
- Remove the surrounding `• ` separator dots only around the chip if it ends up adjacent to another `•` (keep one separator on each side).
- No change to `FailureReviewCard.tsx` — it already renders the chip inline among badges; the new visual is automatically picked up.

### 3. Version bump

- `package.json`: `1.2.1` → `1.2.2`
- `src/version.ts`: same.
- `CHANGELOG.md`: add `1.2.2` entry — "UI: Test History redesigned as inline run-square timeline with current-run emphasis and minimal regression warning."

### Out of scope

- No changes to `analyze-failures` edge function, `TestHistory` type, decision hierarchy, or tooltip data sourcing.
- No changes to other badges in the Context row.
- No memory updates required — existing `Signal Breakdown UI` memory still applies.
