

# התאמת Bulk Action Panel - תוכנית סופית

## ניתוח: איך BugConfirmationFlow טוען קטגוריות

ה-single flow כבר עושה **lazy fetch עם caching מקומי** - טוען קטגוריות רק כשעוברים לשלב הרלוונטי, ושומר ב-state כדי לא לטעון שוב. יש גם auto-refresh על visibility change.

**מסקנה: אופציה א׳ (fetch בשלב 2) עם caching** - בדיוק כמו ב-single flow, לעקביות מלאה.

## שינויים ב-`src/components/BulkActionPanel.tsx`

1. **הסרת רשימות hardcoded** (`passedLocallyReasons`, `manualFixTypes`)
2. **Multi-step dialog** במקום כפתורים נפרדים:
   - שלב 1: "Was there actually a bug?" עם 3 אופציות (Yes bug / No passed locally / Required manual fix)
   - שלב 2: Select קטגוריה מה-DB + notes/link לפי הבחירה
3. **Lazy fetch + cache** - אותו pattern כמו BugConfirmationFlow: `fetchCategoriesByType` כשעוברים לשלב 2, שמירה ב-state מקומי, visibility change refresh
4. **סרגל תחתון**: "N selected" + "Confirm AI ✓" (ישיר) + "Classify..." (פותח dialog) + "Cancel"

## קובץ אחד בלבד

| קובץ | שינוי |
|------|-------|
| `src/components/BulkActionPanel.tsx` | שכתוב ל-multi-step flow עם קטגוריות מ-DB |

