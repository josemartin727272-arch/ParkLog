# Changelog — ParkLog

All notable changes to this project are documented here.
Format: [version] — date — description

---

## [2.0.0] — 2026-04-12

### Added — Persona Entry Type
- **New entry type `persona` (🚶)** across VaultEntry and CommandCenter
  - Tipo selector now has three buttons: `auto` (🚗), `moto` (🛵), `persona` (🚶)
  - Selecting `persona` hides the plate field and shows `first_name`, `last_name`, `id_number` fields
  - `id_number` validation: digits only, 5–12 characters, unique identifier
  - New/known detection for persons: looks up by `id_number` in Persons sheet
  - Session list shows 🚶 + full name for person entries
- **New Google Sheet: Persons** — `person_id`, `id_number`, `first_name`, `last_name`, `first_seen`, `last_seen`, `total_visits`, `notes`, `created_by`
- **Entries sheet** gains two new columns: `entry_type` (`vehicle`/`persona`) and `person_id`
- **CommandCenter**: new "Total personas" KPI card (5th card), `entry_type` filter, persona rows in table and exports
- **Apps Script actions**: `lookupPerson`, `savePersonEntry`, `getPersons`
- **`sheets.js`**: `lookupPerson()`, `savePersonEntry()`, `getPersons()` methods

### Added — User Authentication
- **New Google Sheet: Users** — `user_id`, `display_name`, `password_hash` (SHA-256 + salt), `role` (`admin`/`employee`), `is_active`, `created_at`
- **`auth.js`** — new module for sessionStorage-based sessions with 8-hour TTL
  - `getSession()`, `setSession()`, `clearSession()`, `requireAuth()`, `isAdmin()`
- **Both interfaces** now require login via username + password (replaces shared passphrase)
  - Login calls `DataStore.login()` → Apps Script validates against Users sheet
  - Session stored in sessionStorage, expires after 8 hours
- **CommandCenter Settings tab** (admin only): add user, toggle active/inactive, reset password
  - New password displayed once in a modal (monospace, `user-select: all`), never stored in plaintext
  - Admin cannot deactivate their own account
- **`setupSheets()`** seeds initial admin user and logs one-time plaintext password to Apps Script Logger
- **Apps Script actions**: `login`, `createUser`, `toggleUser`, `resetPassword`, `getUsers`
- **`sheets.js`**: `login()`, `createUser()`, `toggleUser()`, `resetPassword()`, `getUsers()` methods

### Added — Session Invalidation
- `PARKLOG_VERSION: '2.0'` in `config.js` — on page load, if stored version differs, all localStorage and sessionStorage is cleared (forces re-login after deploy)

### Removed
- Shared-password authentication (`VAULT_PASSWORD`, `CC_PASSWORD`) removed from `config.js`

### Changed
- `config.js`: added `ID_NUMBER_MIN_LENGTH`, `ID_NUMBER_MAX_LENGTH`, `ID_NUMBER_PATTERN`, `ENTRY_TYPES`, `SESSION_TTL_MS`
- `commandcenter.css`: added `.kpi-grid-5` (5-column responsive grid), settings panel styles, `.new-password-display`
- `getDashboardData()` (Apps Script + `sheets.js`): returns `totalPersons` KPI
- `updateNotes()` (Apps Script): handles `'person'` type targeting Persons sheet col 8

---

## [1.2.0] — 2026-03-08

### Fixed — Critical
- **Offline queue timestamp preservation** (`sheets.js` + `Code.gs`): Entries saved while offline
  now retain their original timestamp when synced. Previously, `processQueue()` sent entries
  without `queuedAt`, causing Apps Script to use the reconnection time instead of the save time.
  - `sheets.js`: `processQueue()` now passes `queuedAt: item.timestamp` in the payload
  - `Code.gs`: `createEntry()` now reads `data.queuedAt` with `isNaN` fallback to `new Date()`

- **Plate max-length validation** (`vault-entry.js`): Frontend now enforces `PLACA_MAX_LENGTH`
  (10 chars). Previously only min-length was checked, allowing >10 char plates past frontend
  validation (server-side still rejected them, but error UX was inconsistent).

### Fixed — Accessibility
- **Modal focus trap** (`commandcenter.js`): All three modals (notes, history, KPI list) now
  trap Tab/Shift+Tab focus within the modal. Previously, Tab could escape the modal to the
  background page, breaking keyboard-only navigation.
  - Added `trapTabInModal(e)` helper function
  - `openNotesModal()`, `openHistoryModal()`, `openKpiListModal()`: attach trap on open
  - `closeNotesModal()`, `closeHistoryModal()`, `closeKpiListModal()`: detach trap on close

- **Focus return after modal close** (`commandcenter.js`): After closing any modal, focus now
  returns to the element that opened it (pencil icon, clock icon, or KPI card). Added
  `lastFocusedElement` state variable.

### Fixed — Security (XSS Prevention)
- **`innerHTML` with translated strings** (`commandcenter.js`): Replaced 3 instances of
  `historyList.innerHTML = '<div ...>' + t('key') + '</div>'` with a safe `setHistoryMessage()`
  helper that uses `createElement` + `textContent`.

### Documentation
- `CHANGELOG.md`: Created (this file)
- `CLIENT_APPS_SCRIPT_SETUP.md`:
  - Removed real SHEET_ID (`1TuwykbcSHDLYfOIB7ZQlbe4XS5Pl-4wtpF0upaNJs18`) → replaced with
    `'YOUR-SHEET-ID-HERE'` placeholder to prevent accidental data exposure
  - Synced `createEntry()` function with current `Code.gs` (added `queuedAt` block)
  - Fixed Apps Script URL format: `/macros/d/.../usercontent` → `/macros/s/.../exec`
  - Updated Sheet ID instructions — now explicitly guides client to insert their own ID
- `SETUP_INSTRUCTIONS_HE.md`:
  - Fixed typo: "הכנתקה" → "העברה" (section 4 heading)
  - Expanded `setupSheets()` instructions with step-by-step guide and Authorization explanation
  - Fixed Apps Script URL format: `/macros/d/.../usercontent` → `/macros/s/.../exec`
- `MULTI_ENVIRONMENT.md`:
  - Option C now marked as "⚠️ Not Recommended" with explanation of `sed -i` risks
  - Fixed Apps Script URL format throughout
- `DEPLOYMENT_GUIDE.md`: Fixed Apps Script URL format
- `README.md`:
  - Added `CLIENT_APPS_SCRIPT_SETUP.md` to documentation list
  - Added `CHANGELOG.md` to documentation list
  - Added `vercel.json` and other missing files to file structure
- `CLAUDE.md`: Updated File Structure section with all new/missing files
- `config.js`: Fixed comment URL format (example was showing old `usercontent` format)

---

## [1.1.0] — 2026-02-15

### Added
- **CommandCenter**: Vehicle history modal — click clock icon to see all previous entries for a vehicle
- **CommandCenter**: KPI list modal — click any KPI card to see full breakdown list
- **VaultEntry**: Session new vehicles list — running list of all new vehicles entered in current session
- **VaultEntry**: "Copy all plates" button in session list (clipboard export)
- Offline indicator in header when `navigator.onLine === false`

### Fixed
- Notes edit modal now saves without page reload
- Chart labels no longer overflow on small screens

---

## [1.0.0] — 2026-01-20

### Initial Release
- **VaultEntry**: Mobile-first plate entry form with new/known vehicle detection
- **CommandCenter**: Admin dashboard with KPIs, bar chart, doughnut chart, vehicle table
- Bilingual support: Spanish (primary) + Hebrew (RTL)
- Google Apps Script backend with Google Sheets storage
- GitHub Actions auto-deployment to GitHub Pages
- Offline queue with auto-retry on reconnect
- CSV export functionality
- Plate validation (frontend + server-side): A-Z, 0-9, dash, 2–10 chars
