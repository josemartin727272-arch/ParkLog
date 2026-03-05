# 🚀 ParkLog Deployment Guide

## Architecture Overview
```
┌─────────────────┐
│  GitHub Pages   │  ← Frontend (HTML/CSS/JS)
│ (kopeladi.io)   │  Auto-deployed via GitHub Actions
└────────┬────────┘
         │ fetch()
         ▼
┌─────────────────────────────────┐
│  Google Apps Script Web App      │  ← Backend
│  (script.google.com/macros/...)  │  Client deploys & controls
└────────┬────────────────────────┘
         │ Sheets API
         ▼
┌──────────────────┐
│  Google Sheets   │  ← Data storage (Client's account)
│ (Client's data)  │  Client owns it completely
└──────────────────┘
```

---

## 📋 Complete Setup Checklist

### ✅ Part 1: Client Setup (Share with Client)
Send `SETUP_INSTRUCTIONS_HE.md` to your client. They need to:
1. Create Google Sheet ("ParkLog Data")
2. Create Apps Script with `Code.gs` code
3. Deploy as Web App (get URL)
4. Return to you: Sheet ID + Apps Script URL

### ✅ Part 2: Frontend Configuration (You)
Once you have the Apps Script URL from client:

1. **Update `config.js`:**
```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/d/[SCRIPT-ID]/usercontent',
  // ... rest of config
};
```

2. **Commit & Push:**
```bash
git add config.js
git commit -m "config: add Apps Script URL for production"
git push origin main
```

3. **GitHub Actions automatically deploys!** ✅

### ✅ Part 3: Enable GitHub Pages (One-time)
1. Go to https://github.com/kopeladi/ParkLog/settings
2. Scroll to **Pages** section
3. **Source:** Select `Deploy from a branch`
4. **Branch:** Select `main` / `root`
5. **Save**

Alternatively, GitHub Actions will enable it automatically if you have the workflow file.

---

## 🔗 Live URLs After Deployment

- **Frontend:** https://kopeladi.github.io/ParkLog
- **Apps Script:** (from client setup)

---

## 🔄 Update Flow

Every time you push to `main`:
1. GitHub Actions detects push
2. Runs `.github/workflows/deploy.yml`
3. Deploys files to GitHub Pages
4. Site updates automatically ✅

No manual deploys needed!

---

## 🔐 Security Checklist

- [ ] Apps Script validates all input (placa format, notes length)
- [ ] No API keys in frontend code
- [ ] `.env` file excluded from git
- [ ] CORS headers set in Apps Script
- [ ] ALLOWED_ORIGINS updated with GitHub Pages domain
- [ ] All user text rendered with `textContent` (no XSS)

---

## 🛠️ Troubleshooting

### "Can't reach Apps Script"
- Check Apps Script URL in `config.js`
- Verify ALLOWED_ORIGINS in `Code.gs` includes GitHub Pages domain
- Check browser console for errors

### "GitHub Pages not showing"
- Wait 1-2 minutes after push (Actions can take time)
- Check **Settings** → **Pages** → ensure deployment source is set
- Check **Actions** tab for any workflow failures

### "Data not saving"
- Apps Script needs correct Sheet ID
- Verify Sheet exists and Apps Script can access it
- Check Apps Script logs: Tools → Logs

---

## 📞 Support
- Client issues: Guide them through SETUP_INSTRUCTIONS_HE.md
- Deployment issues: Check GitHub Actions tab
- Feature requests: Add issue to GitHub
