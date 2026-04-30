## הבעיה

כשבוחרים את הצ׳יפ "Element is not visible" שאמור להציג 3 כשלונות, מופיעים רק 2. השלישי "נעלם" — בפועל הוא נופל לקבוצה אחרת או ל-Other.

### למה זה קורה

הקיבוץ הנוכחי ב-`src/lib/errorPatternGrouping.ts` בונה signature לכל הודעה ע״י רגקסים שמנקים מרכאות, נתיבים, מספרים, GUIDs, וחותכים ל-60 תווים. שתי הודעות שמתארות את אותה תקלה יכולות לקבל מפתחות שונים אם:

- אחת מכילה selector בתוך מרכאות והשנייה לא (`Element 'login-btn' is not visible` מול `Element is not visible at step 4`).
- אחת נחתכת ב-60 תווים בנקודה שונה (`…` בסוף).
- יש שונות בסדר המילים או בפיסוק (`is not visible.` מול `not visible -`).
- הודעה אחת מכילה stack מקדים בלי `\n` והנרמול לא מצליח להגיע למילים המהותיות.

התוצאה: 2 הודעות מתאחדות תחת label "Element is not visible", השלישית מקבלת signature מעט שונה ונופלת ל-Other (או נעלמת אם count=1).

בנוסף יש פער בין מקור-הספירה (`failuresWithFeedback`) למקור-הסינון (`sortedFailures`), ובין שורות עם `analysis` לבלעדיו.

## הפתרון

מעבר מ"signature מנורמל מההודעה הגולמית" ל**bucketing קנוני מבוסס מילות מפתח** — כל באקט הוא רעיון מוגדר מראש (Element not visible, Element not found, Timeout, Assertion mismatch, Network, Null/Undefined, Element score too low, וכו׳). הודעה משויכת לבאקט אם הרגקס שלו נמצא בה. אם אף באקט לא תופס — הולכים ל-Other.

יתרונות:
- ספירה דטרמיניסטית — אותו רעיון = אותו label = אותו count.
- אין יותר "Other" שמוצף בגרסאות מעט שונות של אותה שגיאה.
- ה-tone (צבע) נגזר ישירות מהבאקט.

### שינויים קונקרטיים

**`src/lib/errorPatternGrouping.ts`**
- להוסיף מערך `CANONICAL_BUCKETS`: לכל אחד `key`, `label`, `tone`, `match: RegExp`, ו-`pattern?: ErrorPattern`.
  - דוגמאות:
    - `element-not-visible` · "Element is not visible" · flaky · `/element\s+(is\s+)?(not\s+visible|hidden|invisible)|not\s+displayed/i`
    - `element-not-found` · "Element not found" · flaky · `/element\s+not\s+found|no\s+such\s+element|cannot\s+find\s+element|stale\s+element/i`
    - `element-score-too-low` · "Element score is too low" · flaky · `/element\s+score\s+(is\s+)?too\s+low/i`
    - `timeout` · "Timeout" · environment · `/timeout|timed\s+out|deadline\s+exceeded|wait(ing)?\s+exceeded/i`
    - `assertion` · "Assertion mismatch" · bug · `/assert(ion)?|expected[:\s].+(actual|but\s+got|received)|data\s+is\s+not\s+equal/i`
    - `network` · "Network error" · environment · `/network|ECONNREFUSED|fetch\s+failed|cors|connection\s+(refused|reset|failed)/i`
    - `null-undefined` · "Null / Undefined" · bug · `/null|undefined|cannot\s+read\s+propert/i`
    - `click-intercepted` · "Click intercepted" · flaky · `/click\s+intercepted|other\s+element\s+would\s+receive/i`
    - `navigation` · "Navigation failed" · environment · `/navigation\s+(failed|timeout)|page\s+crash|net::ERR/i`
- חוקי שיוך:
  - הראשון שמתאים מנצח (סדר המערך = עדיפות; הספציפי לפני הכללי — `element-not-visible` לפני `element-not-found`).
  - אם שום באקט לא תופס → key=`__other__`.
- `groupFailuresByPattern(failures)`:
  - סופר לכל `key` את כמות הכשלונות של `failures` (לא של `failuresWithFeedback`).
  - מציג צ׳יפ לכל באקט עם `count >= 2`. באקטים עם count 1 מתקבצים ל-Other (תוספת ל-otherCount), כולל מי שלא נתפס בכלל.
  - ממיין יורד לפי count.
- חשיפת פונקציה חדשה: `getBucketKeyForMessage(msg: string): string` שמחזירה את ה-key הקנוני (או `__other__`). הסינון ב-Index ישתמש בה במקום לבנות signature ידנית.

**`src/pages/Index.tsx`**
- להחליף שימוש ב-`normalizeErrorSignature` בתוך `filteredFailures` ל-`getBucketKeyForMessage`.
- ליישר את מקור הספירה לזה של הסינון:
  - לקרוא ל-`groupFailuresByPattern(sortedFailures.filter(f => f.analysis))` — אותה רשימה שעליה הפילטר עובד בפועל. כך הספירה בצ׳יפ תהיה זהה למספר השורות שיופיעו אחרי לחיצה.
- לוודא ששורות בלי `analysis` (עוד בעיבוד) לא נספרות בצ׳יפים, ולא משפיעות על Other.

**ללא שינוי**
- `ErrorPatternChips.tsx` — המבנה כבר תומך ב-`PatternGroup` עם `key`/`label`/`tone`.
- שאר ה-UI (sticky bar, search, breakdown).

## בדיקת אמת אחרי השינוי

לאחר ההטמעה, נריץ את התרחיש: 3 כשלונות עם הודעות שונות במעט שכולן מכילות "is not visible" → צ׳יף יציג `Element is not visible · 3`, ולחיצה תציג בדיוק 3 שורות.

## קבצים שיתעדכנו

- `src/lib/errorPatternGrouping.ts` — refactor מלא ל-bucketing קנוני + ייצוא `getBucketKeyForMessage`.
- `src/pages/Index.tsx` — שימוש ב-`getBucketKeyForMessage` ויישור מקור הספירה.
- `src/version.ts` + `CHANGELOG.md` — bump ל-1.1.1 עם פתק קצר על תיקון ספירת הצ׳יפים.
