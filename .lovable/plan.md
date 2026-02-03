

# תיקון עקביות הניתוח

## שינויים

### 1. איפוס File Input ב-Clear All

**קובץ:** `src/pages/Index.tsx` (שורות 140-144)

```typescript
const handleClearAll = () => {
  clearFailures();
  resetFeedback();
  clearAllSessions();
  // חדש: איפוס file input לאפשר העלאה חוזרת של אותו קובץ
  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};
```

### 2. הורדת Temperature ל-0.1

**קובץ:** `supabase/functions/analyze-failures/index.ts` (שורה 815)

```typescript
// מ:
temperature: 0.3,

// ל:
temperature: 0.1, // Lower for more consistent results
```

## סיכום

| קובץ | שינוי |
|------|-------|
| `src/pages/Index.tsx` | איפוס file input ב-handleClearAll |
| `supabase/functions/analyze-failures/index.ts` | temperature: 0.3 → 0.1 |

## תוצאה צפויה

- **Clear All + Upload** יעבוד תמיד
- **תוצאות עקביות יותר** בין ריצות על אותו קובץ

