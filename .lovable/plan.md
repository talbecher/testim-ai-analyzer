## Bug

In bulk mode, when the user selected 15 tests the AI recommended to **Investigate** and clicked **"Yes, it was a bug"**, the system stored `wasCorrect: false` for all of them — so AI Accuracy showed ~35% even though the AI was right.

The root cause is in `src/components/BulkActionPanel.tsx` (`handleConfirm`):

- "Yes, it was a bug" → hardcoded `wasCorrect: false`
- "Required manual fix" → hardcoded `wasCorrect: false`
- "No, passed locally" → hardcoded `wasCorrect: true`

The single-card flow in `ProductionModeCard.tsx` / `FailureReviewCard.tsx` does it correctly — it derives `wasCorrect` per item from `aiRecommendedInvestigate(failure.analysis)`:

- Bug confirmed → `wasCorrect = shouldInvestigate` (AI right if it said Investigate)
- Passed locally → `wasCorrect = !shouldInvestigate` (AI right if it said Skip)
- Required manual fix → `wasCorrect = shouldInvestigate` (AI right if it said Investigate)

The bulk panel ignores this and applies one identical feedback object to every selected row.

## Fix

Update `BulkActionPanel.handleConfirm` to compute `wasCorrect` **per failure** instead of using a single flag, then pass per-item feedback through.

### Changes

1. **`src/hooks/useFeedback.ts`** — extend `handleBulkFeedback` to accept either:
   - a single `UserFeedback` (current behavior), or
   - a function `(failure) => UserFeedback`
   
   so each row can compute its own `wasCorrect` from its own AI analysis.

2. **`src/components/BulkActionPanel.tsx`** — in `handleConfirm`, build feedback per failure using `aiRecommendedInvestigate({ classification, priority })` from `@/lib/aiInvestigateRecommendation`:
   - **Bug flow**: `wasCorrect = aiRecommendedInvestigate(f.analysis)` for each selected `f`
   - **Passed-locally flow**: `wasCorrect = !aiRecommendedInvestigate(f.analysis)`
   - **Manual-fix flow**: `wasCorrect = aiRecommendedInvestigate(f.analysis)`
   
   Also preserve `userClassification` / `userPriority` / `userAction` from each item's own AI analysis (matching what the single-card flow stores), instead of overwriting all rows with `userClassification: 'Potential bug'`.

3. **`src/pages/Index.tsx`** — `handleBulkAction` just forwards to the updated `handleBulkFeedback` (signature update).

## Outcome

After the fix: selecting 15 Investigate-recommended tests and clicking "Yes, it was a bug" will mark all 15 as `wasCorrect: true`, so AI Accuracy reflects reality (in your example it would jump from 35% to the correct value).
