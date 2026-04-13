

# פישוט הסרגל התחתון – הצגת 3 האופציות ישירות

## מה משתנה
הסרת כפתור "Confirm AI ✓" וכפתור "Classify..." מהסרגל התחתון. במקומם – הצגת 3 הכפתורים ישירות בסרגל, בדיוק כמו ב-single flow:

**לפני:**
`Cancel | Confirm AI ✓ | Classify...`

**אחרי:**
`Cancel | 🐛 Yes, it was a bug | ▶ No, passed locally | 🔧 Required manual fix`

לחיצה על כל כפתור פותחת ישירות את שלב הקטגוריה (בלי שלב הביניים של "question").

## שינויים ב-`src/components/BulkActionPanel.tsx`

1. הסרת כפתור "Confirm AI ✓" ו-"Classify..." מהסרגל התחתון
2. הצגת 3 כפתורים ישירות בסרגל: Bug / Passed Locally / Manual Fix
3. לחיצה על כפתור → פותח dialog ישירות בשלב category (דילוג על שלב question)
4. הסרת `onConfirmAI` מה-props (לא נדרש יותר)

## שינויים ב-`src/pages/Index.tsx`
- הסרת `handleConfirmAIBulk` והעברתו ל-`BulkActionPanel`
- הסרת prop `onConfirmAI`

