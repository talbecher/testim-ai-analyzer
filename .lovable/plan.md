## הבעיה
ב-`Common Mistakes` בדשבורד מופיעות שורות כמו `Likely Flaky → Likely Flaky` שלא מעבירות מידע — זו לא טעות, זה אישור של ה-AI. בנוסף הפורמט `X → Y` לא מסביר את עצמו למשתמש לא-טכני.

## המקור
1. **חישוב לדוח**: `src/hooks/useFeedback.ts` (שורות 170-188) מחשב `commonMistakes` רק ממקרים `!wasCorrect`, אבל **לא בודק** ש-`from !== to`. אם ב-bulk confirm או בתיקון תת-קטגוריה נשמר אותו classification – נכנסת רשומה זהה.
2. **שמירה ל-DB**: `useFeedback.ts` שורה 222 שומר את ה-array כפי שהוא ל-`analysis_reports.common_mistakes`.
3. **תצוגה בדשבורד**: `src/pages/Dashboard.tsx` (שורות 64-82) מצבר את כל ה-`common_mistakes` מכל הדוחות בלי סינון `from !== to`.
4. **תצוגה בגרף**: `src/components/dashboard/MistakePatternChart.tsx` מציג כ-`"X → Y"` בלי הסבר מה זה אומר.

## התיקון – 3 שינויים

### 1. `src/hooks/useFeedback.ts` – למנוע יצירת רשומות לא תקינות
בלולאה שיוצרת `mistakeMap`, להוסיף בדיקה: רק אם `f.analysis.classification !== f.feedback.userClassification` להוסיף לרשימה. כך דוחות חדשים יישמרו נקיים.

### 2. `src/pages/Dashboard.tsx` – להגן על דאטה היסטורי
ב-`forEach` של `aggregatedMistakes` (שורה 64), להוסיף בתחילת ה-callback:
```ts
if (mistake.from === mistake.to) return;
```
זה ינקה גם דוחות ישנים שכבר נשמרו עם הבעיה.

### 3. `src/components/dashboard/MistakePatternChart.tsx` – להבהיר את התצוגה
- לעדכן את ה-`CardDescription` ל-: "AI classified as the first label but the correct classification was the second"
- בתווית ה-Y axis להציג עם תוויות ברורות יותר, למשל: `Flaky → Bug` עם tooltip מורחב: `AI said "Flaky", you corrected to "Bug" – happened N times`
- לעדכן את ה-formatter של ה-tooltip ב-`ChartTooltip` כדי להציג את המשפט המלא במקום רק "N times Occurred"

## מה לא נוגעים
- אין שינוי סכימה ב-DB
- אין שינוי ב-edge functions
- `learning_patterns` כבר מסנן את עצמו (`useLearningPatterns.ts`) – לא צריך לגעת

## בדיקה
אחרי השינוי, להיכנס ל-`/dashboard` ולוודא:
- אין יותר שורות `X → X`
- ההסבר על הגרף ברור
- ה-tooltip מסביר את משמעות החץ
