## What we're building

Keep the current single-list layout (no 3-column rework, no extra clicks). Add a **row of clickable filter chips** above the list that auto-detect repeating error patterns, plus small, focused improvements that save clicks and keystrokes.

## 1. Error-pattern filter chips (the main feature)

A horizontal strip above the search bar that auto-groups failures by their detected error pattern (already computed in `errorPatternDetection.ts`).

```text
┌───────────────────────────────────────────────────────────────────┐
│  Quick filters:                                                   │
│  [ All · 23 ]  [ Element not found · 8 ]  [ Timeout · 6 ]         │
│  [ AssertionError · 4 ]  [ Network error · 3 ]  [ Other · 2 ]     │
└───────────────────────────────────────────────────────────────────┘
```

**Behavior**
- Auto-built from `failure.analysis.errorPattern` of all loaded failures (no AI call needed — already classified).
- Only shows patterns with **2+ occurrences** (singletons stay in "Other").
- Counts update live as filters/search change.
- Click a chip → filters the list to that pattern only. Click again → toggles back to All.
- Chip color matches the pattern's typical classification (Element not found = flaky-yellow, AssertionError = bug-red, Network = env-orange).
- Sorted by count descending (most common first).
- Works in combination with the existing search/classification/review-status filters.

**Where it lives:** Inside the existing filter `Card` (lines 549–622 of `src/pages/Index.tsx`), as a new row above the search input.

## 2. Small UX improvements (no extra clicks)

These are tightly scoped — each one removes friction without restructuring the page.

**a. Sticky filter bar**
The search/filter card scrolls away once you start reviewing the list. Make it `sticky top-0` with a subtle backdrop blur so it stays accessible while scrolling through 50 cards.

**b. Clear-filter shortcut**
When any filter is active, show a small `× Clear filters` link next to the results count. Today the user has to reset each filter individually.

**c. Highlight the active chip/filter visually**
Active chip gets a filled background + ring so it's obvious what's filtered. Reduces "why am I seeing only 4 rows?" confusion.

**d. Keyboard: `/` focuses search**
One-key shortcut (like GitHub/Linear) to jump to the search box without reaching for the mouse.

**e. Empty-filter state**
If filters yield 0 results, show a friendly message with a one-click "Clear filters" button instead of an empty void.

**f. Result count with breakdown**
Replace `Showing 12 of 47 rows` with `Showing 12 of 47 · filtered by: Element not found, Unreviewed` so the user always knows what's applied.

## 3. What we are NOT changing

- The current single-column card list stays exactly as is.
- `ProductionModeCard` / `LearningModeCard` — untouched.
- No new routes, no 3-pane layout, no command palette.
- Bulk-select panel stays as is.

## Technical details

**New helper** (`src/lib/errorPatternGrouping.ts`):
```ts
export interface PatternGroup {
  pattern: ErrorPattern;
  count: number;
  color: 'bug' | 'flaky' | 'environment' | 'expected' | 'muted';
}

export function groupFailuresByPattern(
  failures: FailureWithFeedback[]
): PatternGroup[]
```

Maps each pattern to a color based on its typical classification (uses the same color tokens already in `tailwind.config.ts`).

**New component** (`src/components/ErrorPatternChips.tsx`):
- Receives `groups: PatternGroup[]`, `activePattern: string | null`, `onSelect: (p: string | null) => void`.
- Renders horizontal scrollable row of `Badge`-style buttons.
- Active chip uses `ring-2 ring-primary` and filled bg.

**Wire-up in `src/pages/Index.tsx`:**
- New state: `const [filterPattern, setFilterPattern] = useState<string | null>(null);`
- Compute `patternGroups = useMemo(() => groupFailuresByPattern(failuresWithFeedback), [failuresWithFeedback])`.
- Add `matchesPattern` to the existing `filteredFailures` filter (line 238).
- Add the chips row inside the filter Card.

**Sticky bar:** wrap the filter card in a `sticky top-0 z-10 bg-background/80 backdrop-blur-sm` div.

**Keyboard `/`:** add a `useEffect` listener that focuses the search input when `/` is pressed and the user isn't typing in another field.

## Estimated effort

- Pattern chips + grouping helper: ~45 min
- Sticky bar + clear-filter link + breakdown text: ~20 min
- Keyboard `/` shortcut + empty state: ~15 min

Total: roughly 1.5 hours of work. No DB changes, no edge function changes, no migrations.

## Out of scope (saved for later)

- Test history indicators (passed-yesterday-failed-today). Still a strong idea — we'll plan it separately when you're ready.
- Triage Inbox 3-column layout — discarded per your feedback.
- Keyboard shortcuts for classification (1/2/3/4) — we can add later if you want.
