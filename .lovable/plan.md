

# Bulk Selection & Actions + Build Error Fix

## תיקונים לפי ההערות שלך

1. **אטומיות** – `handleBulkFeedback` יעדכן את ה-state פעם אחת עם `map` על כל ה-array, לא לופ של `handleFeedback`
2. **ללא `showBulkActions` state** – נגזור מ-`selectedIds.size > 0` + `bulkMode` toggle
3. **"Confirm AI ✓"** – יחיל ישירות ללא dialog (ה-AI כבר הציע סיבה)
4. **Escape** + לחיצה חוזרת על "Select Multiple" – שניהם יוצאים ממצב בחירה
5. **אנימציה** – כשכרטיסים עוברים ל-reviewed עם פילטר unreviewed, הסרה חלקה

## שינויים

### 1. Build Error Fix – `src/pages/Index.tsx` (שורה 560)
```typescript
const withFb = failuresWithFeedback.find(x => x.id === f.id) || { ...f, isReviewed: false };
```

### 2. Bulk Selection State – `src/pages/Index.tsx`
- `bulkMode: boolean` – toggle למצב בחירה
- `selectedIds: Set<string>` – פריטים מסומנים
- Escape listener לביטול מצב בחירה
- Checkbox ליד כל כרטיס במצב בחירה
- "Select All" / "Deselect All" בסרגל פילטרים

### 3. `handleBulkFeedback` – `src/hooks/useFeedback.ts`
עדכון אטומי אחד:
```typescript
const handleBulkFeedback = useCallback((ids: string[], feedback: UserFeedback) => {
  setFailuresWithFeedback(prev => prev.map(f => 
    ids.includes(f.id) ? { ...f, feedback, isReviewed: true } : f
  ));
}, []);
```

### 4. `BulkActionPanel.tsx` – קומפוננטה חדשה
- Sticky bar בתחתית: "N selected" + כפתורים
- **Confirm AI ✓** – ישירות, ללא dialog
- **Passed Locally / Bug / Manual Fix** – dialog קטן לבחירת סיבה/קטגוריה
- כפתור "Cancel Selection" לביטול

## קבצים

| קובץ | שינוי |
|------|-------|
| `src/pages/Index.tsx` | Fix build error + bulk mode state + checkboxes + Escape handler |
| `src/hooks/useFeedback.ts` | הוספת `handleBulkFeedback` |
| `src/components/BulkActionPanel.tsx` | קומפוננטה חדשה |

