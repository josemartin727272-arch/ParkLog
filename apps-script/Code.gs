/**
 * ParkLog — Google Apps Script Backend
 * Deployed as Web App (doGet/doPost).
 * Handles all Google Sheets operations server-side.
 *
 * Deploy: Deploy → New Deployment → Web App
 *   Execute as: Me
 *   Who has access: Anyone
 */

/* ══════════════════════════════════════════
   Configuration
   ══════════════════════════════════════════ */

/**
 * @const {string} Google Sheet ID
 * IMPORTANT: Replace with your Google Sheet ID from the URL:
 * https://docs.google.com/spreadsheets/d/[YOUR-SHEET-ID]/edit
 */
const SHEET_ID = ''; // ← SET YOUR SHEET ID HERE

/** @const {string[]} Allowed origins for CORS */
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://kopeladi.github.io', // ← GitHub Pages domain (kopeladi = your username)
  'https://kopeladi.github.io/ParkLog' // with path
];

/** @const {number} Max notes length */
const MAX_NOTES_LENGTH = 300;

/** @const {RegExp} Placa validation pattern */
const PLACA_PATTERN = /^[A-Z0-9-]{2,10}$/;

/* ══════════════════════════════════════════
   HTTP Handlers
   ══════════════════════════════════════════ */

/**
 * Handles GET requests (read operations).
 * Routes by `action` parameter.
 *
 * @param {Object} e - Event object from Apps Script
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    let result;

    switch (action) {
      case 'searchVehicle':
        result = searchVehicle(e.parameter.placa);
        break;
      case 'getVehicles':
        result = getVehicles(e.parameter);
        break;
      case 'getEntries':
        result = getEntries(e.parameter);
        break;
      case 'getDashboardData':
        result = getDashboardData(e.parameter);
        break;
      case 'getVehicleHistory':
        result = getVehicleHistory(e.parameter.vehicleId);
        break;
      case 'ping':
        result = { status: 'ok', timestamp: new Date().toISOString() };
        break;
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Handles POST requests (write operations).
 * Routes by `action` in the JSON body.
 *
 * @param {Object} e - Event object from Apps Script
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    let result;

    switch (action) {
      case 'createEntry':
        result = createEntry(body.data);
        break;
      case 'updateNotes':
        result = updateNotes(body.type, body.id, body.notes);
        break;
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/* ══════════════════════════════════════════
   Core Data Operations
   ══════════════════════════════════════════ */

/**
 * Searches for a vehicle by plate number.
 *
 * @param {string} placa - License plate to search for
 * @returns {{ isNew: boolean, vehicle: Object|null }}
 * @throws {Error} If placa is invalid
 */
function searchVehicle(placa) {
  placa = validatePlaca(placa);

  const sheet = getSheet('Vehicles');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    const row = rowToObject(headers, data[i]);
    if (row.placa === placa) {
      return {
        isNew: false,
        vehicle: {
          vehicleId: row.vehicle_id,
          placa: row.placa,
          tipo: row.tipo,
          firstSeen: formatDate(row.first_seen),
          lastSeen: formatDate(row.last_seen),
          totalVisits: row.total_visits,
          notes: row.notes || '',
          notesUpdated: formatDate(row.notes_updated) || ''
        }
      };
    }
  }

  return { isNew: true, vehicle: null };
}

/**
 * Creates a new entry and creates/updates the vehicle record atomically.
 *
 * @param {{ placa: string, tipo: string, notes: string }} data - Entry data
 * @returns {{ success: boolean, isNew: boolean, entry: Object, vehicle: Object }}
 * @throws {Error} If validation fails or write fails
 */
function createEntry(data) {
  const placa = validatePlaca(data.placa);
  const tipo = validateTipo(data.tipo);
  const notes = validateNotes(data.notes || '');

  /*
   * Use the original client-side timestamp when the entry was queued offline.
   * This ensures that "entry saved at 09:00 while offline, reconnected at 10:00"
   * is recorded with entry_time = 09:00, not 10:00.
   * Falls back to server time for live (non-queued) entries.
   */
  let now;
  if (data.queuedAt) {
    const parsed = new Date(data.queuedAt);
    now = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    now = new Date();
  }
  const dateStr = formatDate(now);
  const timeStr = formatTime(now);

  const vehiclesSheet = getSheet('Vehicles');
  const entriesSheet = getSheet('Entries');

  /* Search for existing vehicle */
  const vehiclesData = vehiclesSheet.getDataRange().getValues();
  const vehiclesHeaders = vehiclesData[0];
  let existingRow = -1;
  let existingVehicle = null;

  for (let i = 1; i < vehiclesData.length; i++) {
    const row = rowToObject(vehiclesHeaders, vehiclesData[i]);
    if (row.placa === placa) {
      existingRow = i + 1; // Sheet rows are 1-indexed
      existingVehicle = row;
      break;
    }
  }

  const isNew = existingRow === -1;
  let vehicleId;
  let totalVisits;

  if (isNew) {
    /* Create new vehicle */
    vehicleId = Utilities.getUuid();
    totalVisits = 1;
    vehiclesSheet.appendRow([
      vehicleId,
      placa,
      tipo,
      now,        // first_seen
      now,        // last_seen
      1,          // total_visits
      notes,      // notes
      data.createdBy || 'anonymous', // created_by
      notes ? dateStr : '' // notes_updated
    ]);
  } else {
    /* Update existing vehicle */
    vehicleId = existingVehicle.vehicle_id;
    totalVisits = (existingVehicle.total_visits || 0) + 1;

    // Update last_seen (col 5), total_visits (col 6)
    vehiclesSheet.getRange(existingRow, 5).setValue(now);
    vehiclesSheet.getRange(existingRow, 6).setValue(totalVisits);

    // Update notes if provided
    if (notes) {
      vehiclesSheet.getRange(existingRow, 7).setValue(notes);
      vehiclesSheet.getRange(existingRow, 9).setValue(dateStr); // notes_updated
    }
  }

  /* Create entry record */
  const entryId = Utilities.getUuid();
  entriesSheet.appendRow([
    entryId,
    vehicleId,
    placa,
    now,        // entry_date
    timeStr,    // entry_time
    notes,      // notes_entry
    data.createdBy || 'anonymous' // created_by
  ]);

  return {
    success: true,
    isNew: isNew,
    entry: {
      entryId: entryId,
      placa: placa,
      entryDate: dateStr,
      entryTime: timeStr
    },
    vehicle: {
      vehicleId: vehicleId,
      placa: placa,
      tipo: tipo,
      firstSeen: isNew ? dateStr : formatDate(existingVehicle.first_seen),
      lastSeen: dateStr,
      totalVisits: totalVisits,
      notes: isNew ? notes : (notes || existingVehicle.notes || ''),
      notesUpdated: notes ? dateStr : (existingVehicle ? (formatDate(existingVehicle.notes_updated) || '') : '')
    }
  };
}

/**
 * Gets all vehicles with optional filters.
 *
 * @param {{ tipo: string, status: string, dateFrom: string, dateTo: string, search: string }} filters
 * @returns {{ vehicles: Array<Object>, total: number }}
 */
function getVehicles(filters) {
  const sheet = getSheet('Vehicles');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return { vehicles: [], total: 0 };
  }

  const headers = data[0];
  let vehicles = [];

  for (let i = 1; i < data.length; i++) {
    const row = rowToObject(headers, data[i]);
    const vehicle = {
      vehicle_id: row.vehicle_id,
      placa: row.placa,
      tipo: row.tipo,
      first_seen: formatDate(row.first_seen),
      last_seen: formatDate(row.last_seen),
      total_visits: row.total_visits,
      notes: row.notes || '',
      notes_updated: formatDate(row.notes_updated) || '',
      created_by: row.created_by || 'anonymous'
    };

    /* Apply filters */
    if (filters.tipo && filters.tipo !== 'all' && vehicle.tipo !== filters.tipo) continue;

    if (filters.status && filters.status !== 'all') {
      const today = formatDate(new Date());
      const isNewToday = vehicle.firstSeen === today;
      if (filters.status === 'new' && !isNewToday) continue;
      if (filters.status === 'known' && isNewToday) continue;
    }

    if (filters.dateFrom && vehicle.firstSeen < filters.dateFrom) continue;
    if (filters.dateTo && vehicle.firstSeen > filters.dateTo) continue;

    if (filters.search) {
      const search = filters.search.toUpperCase();
      if (!vehicle.placa.includes(search) && !(vehicle.notes || '').toUpperCase().includes(search)) continue;
    }

    vehicles.push(vehicle);
  }

  return { vehicles: vehicles, total: vehicles.length };
}

/**
 * Gets entries for a specific vehicle or with filters.
 *
 * @param {{ vehicleId: string, dateFrom: string, dateTo: string }} filters
 * @returns {{ entries: Array<Object>, total: number }}
 */
function getEntries(filters) {
  const sheet = getSheet('Entries');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return { entries: [], total: 0 };
  }

  const headers = data[0];
  let entries = [];

  for (let i = 1; i < data.length; i++) {
    const row = rowToObject(headers, data[i]);
    const entry = {
      entryId: row.entry_id,
      vehicleId: row.vehicle_id,
      placa: row.placa,
      entryDate: formatDate(row.entry_date),
      entryTime: row.entry_time || '',
      notesEntry: row.notes_entry || '',
      createdBy: row.created_by || 'anonymous'
    };

    if (filters.vehicleId && entry.vehicleId !== filters.vehicleId) continue;
    if (filters.dateFrom && entry.entryDate < filters.dateFrom) continue;
    if (filters.dateTo && entry.entryDate > filters.dateTo) continue;

    entries.push(entry);
  }

  return { entries: entries, total: entries.length };
}

/**
 * Gets all entry dates for a specific vehicle (history).
 *
 * @param {string} vehicleId - Vehicle UUID
 * @returns {{ history: Array<{ date: string, time: string }> }}
 */
function getVehicleHistory(vehicleId) {
  if (!vehicleId) throw new Error('vehicleId is required');

  const sheet = getSheet('Entries');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let history = [];

  for (let i = 1; i < data.length; i++) {
    const row = rowToObject(headers, data[i]);
    if (row.vehicle_id === vehicleId) {
      history.push({
        date: formatDate(row.entry_date),
        time: row.entry_time || '',
        notes: row.notes_entry || ''
      });
    }
  }

  /* Sort newest first */
  history.sort((a, b) => b.date.localeCompare(a.date));

  return { history: history };
}

/**
 * Returns aggregated dashboard data in one call.
 *
 * @param {Object} params - Optional params with today and weekStart from client
 * @returns {{ kpis: Object, weeklyData: Array, newVsKnown: Object }}
 */
function getDashboardData(params) {
  const vehiclesSheet = getSheet('Vehicles');
  const entriesSheet = getSheet('Entries');

  const vehiclesData = vehiclesSheet.getDataRange().getValues();
  const entriesData = entriesSheet.getDataRange().getValues();

  const today = (params && params.today) ? params.today : formatDate(new Date());
  const weekStart = (params && params.weekStart) ? params.weekStart : getWeekStart(new Date());

  /* ── KPIs ── */
  let entriesToday = 0;
  let newToday = 0;
  let totalVehicles = vehiclesData.length > 1 ? vehiclesData.length - 1 : 0;
  let weeklyEntries = 0;

  /* Count entries today and this week */
  if (entriesData.length > 1) {
    const entriesHeaders = entriesData[0];
    for (let i = 1; i < entriesData.length; i++) {
      const row = rowToObject(entriesHeaders, entriesData[i]);
      const entryDate = formatDate(row.entry_date);

      if (entryDate === today) entriesToday++;
      if (entryDate >= weekStart) weeklyEntries++;
    }
  }

  /* Count new vehicles today (first_seen = today) */
  if (vehiclesData.length > 1) {
    const vHeaders = vehiclesData[0];
    for (let i = 1; i < vehiclesData.length; i++) {
      const row = rowToObject(vHeaders, vehiclesData[i]);
      if (formatDate(row.first_seen) === today) newToday++;
    }
  }

  /* ── Weekly Bar Chart Data (last 9 weeks) ── */
  const weeklyData = getWeeklyChartData(entriesData);

  /* ── New vs Known Doughnut ── */
  let newCount = 0;
  let knownCount = 0;
  if (vehiclesData.length > 1) {
    const vHeaders = vehiclesData[0];
    for (let i = 1; i < vehiclesData.length; i++) {
      const row = rowToObject(vHeaders, vehiclesData[i]);
      if (formatDate(row.first_seen) === today) {
        newCount++;
      } else {
        knownCount++;
      }
    }
  }

  return {
    kpis: {
      entriesToday: entriesToday,
      newToday: newToday,
      totalVehicles: totalVehicles,
      weeklyEntries: weeklyEntries
    },
    weeklyData: weeklyData,
    newVsKnown: {
      new: newCount,
      known: knownCount
    }
  };
}

/**
 * Updates notes for a vehicle or entry.
 *
 * @param {'vehicle'|'entry'} type - Which sheet to update
 * @param {string} id - Record UUID
 * @param {string} notes - New notes text
 * @returns {{ success: boolean }}
 * @throws {Error} If record not found or validation fails
 */
function updateNotes(type, id, notes) {
  notes = validateNotes(notes || '');

  const sheetName = type === 'vehicle' ? 'Vehicles' : 'Entries';
  const idField = type === 'vehicle' ? 'vehicle_id' : 'entry_id';
  const notesCol = type === 'vehicle' ? 7 : 6; // Column index for notes

  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    const row = rowToObject(headers, data[i]);
    if (row[idField] === id) {
      sheet.getRange(i + 1, notesCol).setValue(notes);
      /* Update notes_updated date for vehicles */
      if (type === 'vehicle') {
        sheet.getRange(i + 1, 9).setValue(notes ? formatDate(new Date()) : '');
      }
      return { success: true, notesUpdated: notes ? formatDate(new Date()) : '' };
    }
  }

  throw new Error('Record not found: ' + id);
}

/* ══════════════════════════════════════════
   Helper Functions
   ══════════════════════════════════════════ */

/**
 * Gets a sheet by name, creates it with headers if it doesn't exist.
 *
 * @param {string} name - Sheet name ('Vehicles' or 'Entries')
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Vehicles') {
      sheet.appendRow(['vehicle_id', 'placa', 'tipo', 'first_seen', 'last_seen', 'total_visits', 'notes', 'created_by', 'notes_updated']);
    } else if (name === 'Entries') {
      sheet.appendRow(['entry_id', 'vehicle_id', 'placa', 'entry_date', 'entry_time', 'notes_entry', 'created_by']);
    }
    /* Format header row */
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Converts a sheet row to an object using headers as keys.
 *
 * @param {string[]} headers - Column headers
 * @param {any[]} row - Row values
 * @returns {Object}
 */
function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = row[i];
  });
  return obj;
}

/**
 * Formats a Date to YYYY-MM-DD string.
 *
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  // Use Utilities.formatDate so the result is always in the script's timezone,
  // not UTC. Without this, date.getDate() returns the UTC day which can be
  // one day behind for users in UTC+ timezones (e.g. Israel).
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Formats a Date to HH:MM string.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
}

/**
 * Gets the Monday date for a given date's week (ISO 8601).
 *
 * @param {Date} date
 * @returns {string} YYYY-MM-DD of Monday
 */
function getWeekStart(date) {
  const d = new Date(date);
  // Use UTC methods to avoid timezone shifts when adjusting days
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return formatDate(d);
}

/**
 * Generates weekly entry counts for the bar chart.
 * Returns last 9 weeks (8 complete + current partial).
 *
 * @param {any[][]} entriesData - Raw entries sheet data
 * @returns {Array<{ weekStart: string, count: number }>}
 */
function getWeeklyChartData(entriesData) {
  const weeks = {};

  /* Generate last 9 week starts */
  const now = new Date();
  for (let w = 8; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - (w * 7));
    const ws = getWeekStart(d);
    weeks[ws] = 0;
  }

  /* Count entries per week */
  if (entriesData.length > 1) {
    const headers = entriesData[0];
    for (let i = 1; i < entriesData.length; i++) {
      const row = rowToObject(headers, entriesData[i]);
      const entryDate = row.entry_date;
      if (!entryDate) continue;
      const ws = getWeekStart(new Date(entryDate));
      if (weeks.hasOwnProperty(ws)) {
        weeks[ws]++;
      }
    }
  }

  return Object.entries(weeks).map(([weekStart, count]) => ({
    weekStart: weekStart,
    count: count
  }));
}

/* ══════════════════════════════════════════
   Validation
   ══════════════════════════════════════════ */

/**
 * Validates and normalizes a license plate.
 *
 * @param {string} placa - Raw plate input
 * @returns {string} Normalized uppercase plate
 * @throws {Error} If invalid format
 */
function validatePlaca(placa) {
  if (!placa || typeof placa !== 'string') {
    throw new Error('Plate number is required');
  }
  placa = placa.trim().toUpperCase();
  if (!PLACA_PATTERN.test(placa)) {
    throw new Error('Invalid plate format: A-Z, 0-9, dash, 2-10 characters');
  }
  return placa;
}

/**
 * Validates vehicle type.
 *
 * @param {string} tipo - Vehicle type
 * @returns {string} Validated type
 */
function validateTipo(tipo) {
  if (!tipo || (tipo !== 'auto' && tipo !== 'moto')) {
    return 'auto'; // default
  }
  return tipo;
}

/**
 * Validates notes length.
 *
 * @param {string} notes - Notes text
 * @returns {string} Validated notes
 * @throws {Error} If too long
 */
function validateNotes(notes) {
  if (typeof notes !== 'string') return '';
  notes = notes.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new Error('Notes exceed maximum length of ' + MAX_NOTES_LENGTH + ' characters');
  }
  return notes;
}

/* ══════════════════════════════════════════
   Response Helper
   ══════════════════════════════════════════ */

/**
 * Creates a JSON response with CORS headers.
 *
 * @param {Object} data - Response data
 * @param {number} [statusCode=200] - HTTP status code (informational only in Apps Script)
 * @returns {TextOutput}
 */
function jsonResponse(data, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

/* ══════════════════════════════════════════
   Setup Helper (run once manually)
   ══════════════════════════════════════════ */

/**
 * Initial setup: creates sheets with headers if they don't exist.
 * Run this function manually once after setting up the spreadsheet.
 */
function setupSheets() {
  getSheet('Vehicles');
  getSheet('Entries');
  Logger.log('Sheets created/verified successfully!');
}
