# 🎭 Multiple Environments Setup

ParkLog supports **Demo** (your showcase) and **Production** (client data) with easy switching.

---

## 📊 Architecture

```
┌─────────────────┐
│  Your Computer  │
├─────────────────┤
│  config.js      │ ← Choose which URL to use
│  (1 file)       │
└────────┬────────┘
         │
    ┌────┴─────┬──────────────┐
    │           │              │
    ▼           ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Demo    │ │ Client 1 │ │ Client N │
│ Apps Scr │ │Apps Scr  │ │Apps Scr  │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     ▼            ▼            ▼
  Demo Sheet  Client 1    Client N
  (Your data) Sheet       Sheet
```

---

## 🚀 Quick Start

### 1️⃣ Create Your Demo Sheet (One-time)

Same as client setup (see SETUP_INSTRUCTIONS_HE.md):
1. Create Google Sheet: "ParkLog Demo"
2. Create Apps Script with Code.gs
3. Deploy as Web App
4. Save URL: `https://script.google.com/macros/d/[DEMO-ID]/usercontent`

### 2️⃣ Store URLs

Create `.env` file in root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env`:
```
# Demo — Your showcase
APPS_SCRIPT_URL=https://script.google.com/macros/d/[DEMO-ID]/usercontent

APP_ENV=demo
```

### 3️⃣ Update config.js

```javascript
// At deployment time, replace empty APPS_SCRIPT_URL with .env value
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/d/[DEMO-ID]/usercontent',
  // ...
};
```

Then commit & push → GitHub Pages auto-deploys ✅

---

## 🔄 Switching Between Environments

### When you want to DEMO:
```javascript
// config.js
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/d/YOUR-DEMO-SCRIPT-ID/usercontent',
  // ...
};
```

### When client provides THEIR URL:
```javascript
// config.js
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/d/CLIENT-SCRIPT-ID/usercontent',
  // ...
};
```

Then:
```bash
git add config.js
git commit -m "config: switch to [CLIENT-NAME] production"
git push origin main
# GitHub Pages auto-updates
```

---

## 📋 Environment Examples

### .env (for local development)
```
APPS_SCRIPT_URL=https://script.google.com/macros/d/AKfycby-Demo123/usercontent
APP_ENV=development
```

### .env.demo (for sharing)
```
APPS_SCRIPT_URL=https://script.google.com/macros/d/AKfycby-Demo123/usercontent
APP_ENV=demo
```

### .env.production.client1 (for client 1)
```
APPS_SCRIPT_URL=https://script.google.com/macros/d/AKfycby-Client1ID/usercontent
APP_ENV=production
CLIENT_NAME=John's Parking
```

---

## ✅ Deployment Flow Per Client

```
1. Client creates Google Sheet + Apps Script
   ↓
2. Client provides Apps Script URL
   ↓
3. You update config.js with URL
   ↓
4. git commit -m "config: add [client-name]"
   ↓
5. git push origin main
   ↓
6. GitHub Actions auto-deploys
   ↓
7. ✅ Client's instance live at GitHub Pages URL
```

---

## 🔐 Security Notes

- ✅ .env file is in .gitignore — never committed
- ✅ Apps Script URLs are NOT secret (validation is server-side)
- ✅ Each client's data stays in their own Google Sheet
- ✅ You have NO access to client data (unless they share the Sheet)

---

## 📞 Managing Multiple Clients

**Scenario:** You have 3 clients

### Option A: Separate Repos (Recommended)
Each client gets their own git repo clone:
```
ParkLog/
├── client-john/
│   ├── config.js (with John's URL)
│   └── ...
├── client-maria/
│   ├── config.js (with Maria's URL)
│   └── ...
└── client-pedro/
    ├── config.js (with Pedro's URL)
    └── ...
```

### Option B: Shared Repo with Branches
```bash
main           ← Demo (your showcase)
├── client-john-prod
├── client-maria-prod
└── client-pedro-prod
```

Each has its own Apps Script URL in config.js.

Deploy to client's own GitHub Pages or custom domain.

### Option C: One Repo, Switch URLs Locally
Keep ONE repo, switch config.js before each deployment:
```bash
# For demo
sed -i 's/APPS_SCRIPT_URL=.*/APPS_SCRIPT_URL=https:\/\/script.google.com\/macros\/d\/DEMO-ID\/usercontent/' config.js

# For client-john
sed -i 's/APPS_SCRIPT_URL=.*/APPS_SCRIPT_URL=https:\/\/script.google.com\/macros\/d\/JOHN-ID\/usercontent/' config.js
```

**Simplest approach:** Use Option A (separate folders = separate GitHub Pages instances).

---

## 🎯 Your First Demo

1. **Create:** Google Sheet + Apps Script (your account)
2. **Deploy:** Apps Script Web App
3. **Get URL:** `https://script.google.com/macros/d/[DEMO-ID]/usercontent`
4. **Update:** `config.js` with Demo URL
5. **Push:** `git commit -m "demo: initial demo setup"` → GitHub Pages
6. **Share:** Send demo link to prospects

---

## 💡 Pro Tips

- **Test locally first:** Run `python3 -m http.server 8080` with Demo URL
- **Keep demo data fresh:** Update demo Sheet regularly with examples
- **Auto-switch script:** Use git hooks to auto-replace URLs before deploy
- **Document URLs:** Keep a spreadsheet of all client URLs (encrypted!)

---

## 🔗 Related Files
- `config.js` — Where URLs are set
- `.env.example` — Template for environment variables
- `SETUP_INSTRUCTIONS_HE.md` — For onboarding clients
- `DEPLOYMENT_GUIDE.md` — Full deployment reference

---

**Ready to deploy?** Start with your demo, then replicate for each client! 🚀
