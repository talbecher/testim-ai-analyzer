## Test History — תיקון שתי בעיות (v1.2.4)

### הבעיות שזיהיתי

**בעיה 1 — היסטוריה לא רלוונטית (חמורה):**
ב-`computeGlobalTestHistoryMap` (ב-`supabase/functions/analyze-failures/index.ts`, שורה 495) שולפים את 30 ההרצות האחרונות **מכל ה-`analysis_reports` בלי שום סינון**. זה אומר שאם הרצת ניתוח על "Regression 2", הריבועים יציגו לך גם הרצות של "Regression 6", "Regression 3", וכל באקט אחר — וזה בדיוק מה שראית. ההיסטוריה צריכה להיות מצומצמת ל-**אותו `regression_bucket`** של ההרצה הנוכחית, כדי שההשוואה תהיה תפוחים-מול-תפוחים.

**בעיה 2 — ה-hover על ריבוע לא מציג פרטים:**
שני tooltips של Radix שמותקנים על אותו אלמנט/אותם trigger-ים מתנגשים — ה-tooltip של "summary" החיצוני עדיין נטען עם `Provider` ברמת האפליקציה (`delayDuration` ברירת מחדל = 700ms), כך שה-hover על ריבוע בודד נבלע. בנוסף בלי `delayDuration={0}` ובלי `disableHoverableContent` ה-tooltip של הריבוע לא נפתח מהר וה-trigger קטן מדי כדי לתפוס את העכבר באופן עקבי.

---

### השינויים

**1. Edge function — סינון ההיסטוריה לפי regression bucket**
קובץ: `supabase/functions/analyze-failures/index.ts`

- חתימה: `computeGlobalTestHistoryMap(supabase, testNames, globalRowCountByTest, regressionBucket?)`.
- בשליפת `analysis_reports` להוסיף `.eq('regression_bucket', regressionBucket)` כש-bucket קיים. אם אין bucket להרצה הנוכחית (legacy), נשמור את ההתנהגות הישנה (כל ההרצות) כ-fallback.
- להוסיף לבחירה גם את `regression_bucket` (לוגינג/דיבוג).
- במקום הקריאה (שורה ~1058) להעביר את ה-`regressionBucket` של ה-payload הנוכחי.
- להוסיף לוג: `History scope: bucket=<x>, reports=<n>`.

**2. UI — `src/components/TestHistoryChip.tsx` — hover מלא ועקבי**

- לעטוף את כל ה-strip ב-`<TooltipProvider delayDuration={150} skipDelayDuration={0}>` מקומי כדי לא לרשת את ההשהיה הגלובלית של 700ms ולמנוע התנגשות עם ה-Provider של האפליקציה.
- להסיר את אייקון ה-`Info` הנפרד עם ה-tooltip הסיכומי — במקום זה, ה-summary יעלה רק על ה-warning glyph (כשקיים) או על ה-pill של "first seen". ככה אין שני tooltips רוויים על אותו אזור.
- להגדיל את אזור ה-hit-area של כל ריבוע: לעטוף ב-`<span class="p-0.5 -m-0.5 inline-flex">` (padding שקוף סביב הריבוע) — הריבוע עצמו נשאר בגודל הנוכחי אבל ה-trigger גדול ב-4px לכל כיוון.
- תוכן ה-tooltip של כל ריבוע ירחיב להציג:
  - **Run name** (bold) — או "Run #N" אם חסר.
  - **Run date** — formatted (`Mar 5, 2025`).
  - **Bucket** — שם ה-regression bucket של אותה הרצה.
  - **Outcome** — Passed (לא הופיע ב-CSV) / Failed.
  - אם Failed: **AI classification** + **AI priority** של אותה הרצה.
- לפיכך ה-`TestHistoryRunDetail` מתרחב: `bucket?: string; aiPriority?: string;` (ה-edge ימלא אותם מאותה שאילתה).

**3. הרחבת הדאטה ב-edge:**
- בשליפת `analysis_results` להוסיף `ai_priority` לבחירה.
- ה-`failsByReport` יהפוך מ-`Map<reportId, Map<test, classification>>` ל-`Map<reportId, Map<test, {classification, priority}>>`.
- `reportsChrono` כבר מכיל `run_name` ו-`run_date`; להוסיף לו גם `regression_bucket` ולמלא `bucket` ב-`priorRunDetails` עבור כל הרצה (גם ירוקה וגם אדומה).

**4. Types — `src/types/testim.ts`**
הרחבת `TestHistoryRunDetail`:
```ts
export interface TestHistoryRunDetail {
  outcome: 'pass' | 'fail';
  runName?: string;
  runDate?: string;
  bucket?: string;        // NEW
  aiClassification?: string;
  aiPriority?: string;    // NEW
}
```

**5. Versioning + Changelog**
- `package.json`, `src/version.ts`: `1.2.3` → `1.2.4`.
- `CHANGELOG.md`: 
  - Fixed: Test History timeline now scoped to the current regression bucket (no more cross-bucket noise).
  - Improved: Hover any history square to see run name, date, bucket, and — for failed runs — the AI classification and priority from that run. Larger hit area and faster tooltip response.

**6. Memory**
עדכון `mem://features/test-history-chip`:
- היסטוריה מצומצמת ל-bucket של ההרצה הנוכחית.
- כל ריבוע מציג ב-hover: run name, date, bucket, outcome, ובכישלון גם classification + priority.
- שימוש ב-`TooltipProvider` מקומי עם `delayDuration={150}`.

---

### מחוץ לתחום
- בלי שינוי לחלון 30 ההרצות, לחישוב ה-pattern, או ל-prompt של ה-AI.
- בלי שינוי סכמת DB — `regression_bucket` כבר קיים ב-`analysis_reports`.
