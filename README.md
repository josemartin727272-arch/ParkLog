# ParkLog 🚗🅿️

**Parking lot vehicle entry management system** — דרכלוג
Bilingual (Spanish/Hebrew) system for tracking vehicle entries in parking facilities.

- **VaultEntry**: Mobile-first data entry form for employees
- **CommandCenter**: Admin dashboard with KPIs, charts, filters, exports

---

## 🚀 Quick Start

### For End Users
- **VaultEntry**: https://kopeladi.github.io/ParkLog/vault-entry.html
- **CommandCenter**: https://kopeladi.github.io/ParkLog/commandcenter.html

### For Developers/Clients

**Read these first:**
1. [`SETUP_INSTRUCTIONS_HE.md`](SETUP_INSTRUCTIONS_HE.md) — Client setup (Google Sheet + Apps Script)
2. [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — Full deployment architecture & steps

---

## 📋 How It Works

### Architecture
```
Frontend (GitHub Pages)
    ↓ fetch()
Backend (Google Apps Script) ← Client controls & deploys
    ↓ Sheets API
Data (Google Sheets) ← Client owns data
```

### Setup Steps
1. **Client creates:** Google Sheet + Apps Script
2. **Client provides:** Apps Script URL
3. **Developer updates:** `config.js` with URL
4. **Developer commits:** Push to main
5. **Auto-deploy:** GitHub Actions → GitHub Pages ✅

---

## 🔧 Configuration

### Before First Deployment
Once you have the Apps Script URL from your client, update `config.js`:

```javascript
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/d/[YOUR-SCRIPT-ID]/usercontent',
  // ... other config
};
```

Then:
```bash
git add config.js
git commit -m "config: add Apps Script URL"
git push origin main
```

**GitHub Actions will deploy automatically!**

---

## 🛠️ Tech Stack

- **Frontend**: HTML5 + CSS3 (no frameworks) + Vanilla JS
- **Backend**: Google Apps Script (deployed as Web App)
- **Database**: Google Sheets
- **Deployment**: GitHub Pages (auto via GitHub Actions)
- **Charts**: Chart.js (CDN)
- **Icons**: Lucide Icons (CDN)

---

## 📁 Project Structure

```
ParkLog/
├── README.md                      ← You are here
├── SETUP_INSTRUCTIONS_HE.md       ← For client setup
├── DEPLOYMENT_GUIDE.md            ← For deployment reference
├── CLAUDE.md                      ← Project specifications
├── index.html                     ← Landing page
├── vault-entry.html               ← Data entry form
├── commandcenter.html             ← Admin dashboard
├── style.css, vault-entry.css, commandcenter.css
├── vault-entry.js, commandcenter.js, sheets.js, i18n.js
├── config.js                      ← ⭐ Update with Apps Script URL
├── apps-script/
│   └── Code.gs                    ← Google Apps Script (client deploys)
└── .github/
    └── workflows/
        └── deploy.yml             ← GitHub Actions auto-deployment
```

---

## 🌍 Languages

- **Spanish (ES)** — Primary language
- **Hebrew (HE)** — Secondary (RTL support)
- All UI text stored in `i18n.js`

Users can toggle language in header of both interfaces. Language preference saved in localStorage.

---

## 📊 Features

### VaultEntry
- Plate number input with format validation (2-10 chars, A-Z 0-9 dash)
- Vehicle type selector (auto 🚗 / moto 🛵)
- New/Known vehicle detection (with visual badges)
- Session history of entries
- Offline support with auto-retry on reconnect
- Notes field (max 300 chars)

### CommandCenter
- **KPIs**: Today's entries, new vehicles, total vehicles, weekly total
- **Weekly Chart**: Last 8 weeks + current (bar chart)
- **New vs Known**: Doughnut chart by status
- **Vehicle Table**: Sortable, filterable, editable notes
- **Exports**: Multiple export formats (CSV)
- **Filters**: By vehicle type, status (new/known), date range, search

---

## 🔐 Security

- ✅ No API keys in frontend code
- ✅ All validation server-side (Apps Script)
- ✅ XSS prevention (textContent, never innerHTML)
- ✅ CORS validation
- ✅ Input sanitization (placa format, notes length)
- ✅ Client owns their data in their Google Sheet

---

## 🚀 Deployment

### Automatic (GitHub Pages)
Every push to `main` automatically deploys via GitHub Actions.

### Manual Deploy (if needed)
```bash
git push origin main
```

Deploy takes ~1-2 minutes. Check **Actions** tab for status.

---

## 🐛 Troubleshooting

### "Can't reach backend"
- Verify `config.js` has correct Apps Script URL
- Check browser console (F12 → Console tab)
- Verify Apps Script is deployed as Web App

### "GitHub Pages not updating"
- Wait 1-2 minutes (Actions takes time)
- Check **Settings** → **Pages** → ensure source is set
- Check **Actions** tab for workflow failures

### "Data not saving"
- Verify Google Sheet exists
- Verify Apps Script Sheet ID is correct
- Check Apps Script Logs (Tools → Logs)

---

## 📄 License

Copyright © ParkLog. See LICENSE file.

---

## 📞 Support

For client setup help: See `SETUP_INSTRUCTIONS_HE.md`
For deployment help: See `DEPLOYMENT_GUIDE.md`
For specifications: See `CLAUDE.md`

---

**Ready to deploy?** Start with [`SETUP_INSTRUCTIONS_HE.md`](SETUP_INSTRUCTIONS_HE.md) 🚀
