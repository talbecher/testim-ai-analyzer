

# תיקון באג ב-Boost AI Learning

## הבעיה

שתי שגיאות ב-edge function `aggregate-learning`:

1. **שגיאת Database**: הקוד מנסה להכניס רשומות עם `pattern_type: 'confirmed'` אבל הטבלה מאפשרת רק: `correction`, `passed_locally`, `manual_fix`, `notes_analysis`.
2. **API Key חסר**: הקריאה ל-AI Gateway לא שולחת את ה-Authorization header.

## תיקונים

### קובץ: `supabase/functions/aggregate-learning/index.ts`

**תיקון 1 - הוספת Authorization header** (שורות 105-116):

```typescript
const response = await fetch(gatewayUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,  // <-- חסר
  },
  body: JSON.stringify({ ... })
});
```

**תיקון 2 - טיפול ב-confirmed patterns** (שורות 322-341):

שתי אפשרויות:
- **אפשרות א'**: להוסיף `confirmed` ל-check constraint בטבלה (migration)
- **אפשרות ב'** (מומלצת): לסנן את ה-confirmed patterns לפני INSERT, כי הם פחות חשובים ללמידה

הגישה המומלצת: נוסיף migration שמרחיבה את ה-check constraint לכלול `confirmed`, כי יש ערך בשמירת תבניות מאושרות.

### שינויים

| קובץ | שינוי |
|------|-------|
| `supabase/functions/aggregate-learning/index.ts` | הוספת Authorization header לקריאת AI |
| Database migration | הוספת `confirmed` ל-pattern_type check constraint |

## תוצאה צפויה

לחיצה על "Boost Now" תעבוד ללא שגיאות ותחזיר סטטיסטיקות מלאות.

