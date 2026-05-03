## Stat cards as quick filters (Total / Investigate / Skip)

הפיכת שלוש הכרטיסיות העליונות ל-toggle שמסנן את הרשימה מיד. AI Accuracy יישאר תצוגה בלבד (לא ניתן לסינון).

### התנהגות

- **Total Analyzed** — לוחצים → מנקה את הסינון לפי המלצה (מציג הכל, כפוף לשאר הסינונים).
- **Investigate** — לוחצים → מציג רק שורות שה-AI המליץ Investigate.
- **Skip** — לוחצים → מציג רק שורות שה-AI המליץ Skip.
- לחיצה חוזרת על כרטיסיית Investigate/Skip פעילה = ביטול הסינון (כמו toggle).
- כרטיסיה פעילה תקבל ring צבעוני (bug/flaky), `cursor-pointer`, ו-`aria-pressed`.
- כרטיסיית Total תיראה פעילה כש-`filterRecommendation === 'all'`.
- מקלדת: `tabIndex=0` + `Enter/Space` מפעילים את אותו toggle.

### שינויים טכניים (`src/pages/Index.tsx`)

1. **State חדש:** `const [filterRecommendation, setFilterRecommendation] = useState<'all' | 'investigate' | 'skip'>('all');`
2. **filter:** ב-`filteredFailures`, אחרי `matchesPattern`, להוסיף:
   ```ts
   const recommended = aiRecommendedInvestigate({
     classification: f.analysis?.classification,
     priority: f.analysis?.priority,
   });
   const matchesRecommendation =
     filterRecommendation === 'all' ||
     (filterRecommendation === 'investigate' && recommended) ||
     (filterRecommendation === 'skip' && !recommended);
   ```
   ולהוסיף `filterRecommendation` ל-deps של ה-`useMemo`.
3. **Active filters indicator** (סביב שורה 700-703): להוסיף chip ל-`filterRecommendation !== 'all'`.
4. **Clear filters / hasActiveFilters** (שורה 192): להוסיף `filterRecommendation !== 'all'` ולאפס אותו ב-clear.
5. **Cards → buttons:** עיטוף שלוש הכרטיסיות ב-`role="button"` + `onClick` שעושה toggle. הוספת `ring-2 ring-bug` / `ring-flaky` / `ring-foreground/40` כשהכרטיסיה פעילה. הוספת hover עדין (`hover:bg-bug/10` וכו').

### מחוץ לתחום
- אין שינוי ל-AI Accuracy card (נשאר תצוגה).
- אין שינוי לפילטרים הקיימים (Classification / Status / Pattern / Search) — הם פועלים במקביל ב-AND.
- אין שינוי ל-DB / edge functions / version bump.