# 🔧 הוראות Setup — ParkLog

## שלב 1️⃣: יצירת Google Sheet (לקוח)

### א. יוצר Sheet חדש
1. לך ל- **https://sheets.google.com**
2. לחץ **"+" (ריק)**
3. שם: **"ParkLog Data"**
4. **שמור את הקובץ** (Ctrl+S / Cmd+S)

### ב. קבל את Sheet ID
- ב-URL של ה-Sheet תראה:
```
https://docs.google.com/spreadsheets/d/[SHEET-ID]/edit
```
- **העתק את [SHEET-ID]** — תצטרך אותו בשלב הבא

---

## שלב 2️⃣: יצירת Apps Script (לקוח)

### א. פתח Apps Script Editor
1. בתוך ה-Sheet → **Tools** (או **Extensions**)
2. → **Apps Script**
3. ייפתח חלון חדש עם editor

### ב. הכנס את הקוד
1. **מחוק את כל הקוד** שיש בעמוד (Ctrl+A, Delete)
2. **העתק את כל קוד זה** ↓↓↓ (Code.gs מה-ParkLog)
3. **הדבק** בתוך ה-editor
4. **שלב חשוב:** בשורה 16, החלף את `''` עם ה-SHEET-ID שלך:

```javascript
const SHEET_ID = 'YOUR-SHEET-ID-HERE';
```

### ג. שמור את ה-Project
- Ctrl+S (Save)
- תקבל הודעה עם שם ה-project — אתה יכול להשאיר אותו כ-"Code"

---

## שלב 3️⃣: Deployment כ-Web App (לקוח)

### א. Deploy
1. בחלק העליון → **Deploy** → **New Deployment**
2. לחץ על ⚙️ (Settings icon) בשמאל
3. **Type:** בחר **Web app**
4. **Execute as:** בחר **[אתה - השם שלך]**
5. **Who has access:** בחר **Anyone**
6. לחץ **Deploy**

### ב. שמור את ה-URL
- Apps Script יתן לך URL כמו זה:
```
https://script.google.com/macros/d/[SCRIPT-ID]/usercontent
```
- **העתק את כל ה-URL הזה** ← תצטרכו להמשך!

---

## שלב 4️⃣: הכנתקה ללמפתחת

**שלח ללמפתחת שלך:**
1. ה-**Apps Script URL** מ-שלב 3ב
2. את ה-**Sheet ID** מ-שלב 1ב

דוגמה:
```
Apps Script URL:
https://script.google.com/macros/d/AKfycbx...../usercontent

Sheet ID:
1a2b3c4d5e6f7g8h9i10j11k12l13m14
```

---

## ✅ בדיקה
- בחזור בחלק העליון של Apps Script → **Run** (מחובר ל-setupSheets())
- אם אתה רואה בעיה — בחזור לשלב 3 ודא שה-SHEET-ID נכון

---

**כל בעיה? דור לי בתוך ה-slack! 🙌**
