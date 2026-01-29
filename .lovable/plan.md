

# תיקון Regression Buckets - שתי בעיות לתיקון

## הבעיות שזיהיתי

### בעיה 1: המיגרציה לא הורצה
קובץ המיגרציה `supabase/migrations/20260127130000_regression_buckets.sql` **קיים** בקוד, אבל הטבלה `regression_buckets` **לא קיימת** ב-Database.

כשאתה שואל "למה הרשימה ריקה?" - הסיבה היא שה-Hook מנסה לשלוף מטבלה שלא קיימת.

### בעיה 2: חסר import ב-Settings.tsx
בשורה 332 יש שימוש ב-`cn()` אבל הפונקציה לא מיובאת.

---

## תיקונים נדרשים

### תיקון 1: הרצת המיגרציה

אריץ את המיגרציה ליצירת הטבלה `regression_buckets` עם:
- 8 רשומות ראשוניות (Regression 1-8)
- הגדרות RLS לגישה ציבורית

```text
SQL שירוץ:
- CREATE TABLE regression_buckets
- 4 RLS policies (SELECT/INSERT/UPDATE/DELETE)
- INSERT 8 seed records
```

### תיקון 2: הוספת import ב-Settings.tsx

הוספת `cn` מ-`@/lib/utils` בראש הקובץ:

```typescript
// שורה 1 - יעודכן ל:
import { cn } from '@/lib/utils';
```

---

## קבצים שיעודכנו

| קובץ | פעולה |
|------|-------|
| Database | יצירת טבלת `regression_buckets` + seed data |
| `src/pages/Settings.tsx` | הוספת import של `cn` |

---

## תוצאה צפויה

אחרי התיקונים:
1. ה-Dropdown יציג 8 regression buckets (Regression 1-8)
2. עמוד Settings יעבוד בלי שגיאות build
3. תוכל להוסיף regression buckets חדשים דרך Settings

