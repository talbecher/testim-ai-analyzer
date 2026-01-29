
# הוספת מעקב גרסאות לעמוד Settings

## סקירה

נוסיף מערכת מעקב גרסאות שתכלול:
1. **מספר גרסה ברור** בעמוד Settings
2. **קובץ CHANGELOG.md** עם היסטוריית שינויים
3. **תאריך עדכון אחרון** להבנה מתי הגרסה פורסמה

---

## מה ייווצר

### 1. קובץ `src/version.ts` - מקור אמת לגרסה

קובץ קטן שמכיל:
- `VERSION` - מספר גרסה (Semantic Versioning: MAJOR.MINOR.PATCH)
- `RELEASE_DATE` - תאריך הגרסה
- `CHANGELOG_URL` - קישור ל-changelog

```text
דוגמה:
VERSION = "1.0.0"
RELEASE_DATE = "2025-01-29"
```

### 2. קובץ `CHANGELOG.md` - היסטוריית שינויים

מסמך מובנה עם כל הגרסאות והשינויים שלהן:

```text
# Changelog

## [1.0.0] - 2025-01-29

### Added
- Streak Info calculation in Edge Function
- Confirmed patterns (positive feedback) in AI context
- Signal breakdown alignment with classification
- Few-shot examples from historical corrections
- Investigate vs Skip clarification in prompt

### Fixed
- Classification consistency with signal breakdown

## [0.9.0] - 2025-01-XX (תאריך קודם)

### Added
- Initial AI analysis system
- Learning/Production modes
- Co-failure detection
...
```

### 3. עדכון `src/pages/Settings.tsx` - הצגת גרסה

כרטיס חדש בתחתית הדף שיציג:
- מספר גרסה נוכחית
- תאריך עדכון אחרון
- כפתור לצפייה ב-Changelog (פותח דיאלוג)
- אייקון של Info

```text
עיצוב הכרטיס:
┌─────────────────────────────────────────────┐
│  ℹ️  About This App                          │
├─────────────────────────────────────────────┤
│                                             │
│  Version: 1.0.0                             │
│  Last Updated: January 29, 2025             │
│                                             │
│  [View Changelog]                           │
│                                             │
└─────────────────────────────────────────────┘
```

### 4. קומפוננטת `src/components/ChangelogDialog.tsx`

דיאלוג שמציג את ה-Changelog בצורה נוחה:
- רשימה של גרסאות עם תאריכים
- קטגוריות: Added, Fixed, Changed, Removed
- עיצוב נקי וקריא

---

## זרימת עבודה לעדכון גרסה

כשתרצה לעדכן גרסה:

1. **עדכן `src/version.ts`**:
   ```typescript
   export const VERSION = "1.1.0";
   export const RELEASE_DATE = "2025-02-15";
   ```

2. **הוסף ערך ל-`CHANGELOG.md`**:
   ```markdown
   ## [1.1.0] - 2025-02-15
   
   ### Added
   - תכונה חדשה X
   - שיפור Y
   
   ### Fixed
   - תיקון באג Z
   ```

3. **פרסם** - הגרסה תופיע אוטומטית ב-Settings

---

## איך זה עוזר לך

1. **מעקב פרודקשן**: תמיד תראה איזו גרסה רצה
2. **שיחות עם AI**: תוכל לשאול "מה השינויים בגרסה 1.2.0?" ואבדוק ב-CHANGELOG
3. **היסטוריה**: תיעוד מסודר של כל השינויים
4. **Debug**: אם יש בעיה, קל לזהות מתי היא נכנסה

---

## קבצים שייווצרו/יעודכנו

| קובץ | פעולה |
|------|-------|
| `src/version.ts` | חדש - קובץ גרסה |
| `CHANGELOG.md` | חדש - היסטוריית שינויים |
| `src/pages/Settings.tsx` | עדכון - הוספת כרטיס גרסה |
| `src/components/ChangelogDialog.tsx` | חדש - דיאלוג changelog |

---

## פרטים טכניים

### Semantic Versioning
- **MAJOR** (1.x.x): שינויים שוברים תאימות
- **MINOR** (x.1.x): תכונות חדשות
- **PATCH** (x.x.1): תיקוני באגים

### מבנה version.ts
```typescript
export const VERSION = "1.0.0";
export const RELEASE_DATE = "2025-01-29";

export const getVersionInfo = () => ({
  version: VERSION,
  releaseDate: RELEASE_DATE,
  formattedDate: new Date(RELEASE_DATE).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  })
});
```

### עיצוב הכרטיס ב-Settings
- אייקון Info מ-lucide-react
- צבע רקע עדין (primary/5)
- טקסט muted לתאריך
- כפתור outline לצפייה ב-changelog
