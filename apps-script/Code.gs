/**
 * ParkLog — Google Apps Script Backend (v2.0)
 * Deployed as Web App (doGet/doPost).
 * Handles all Google Sheets operations server-side.
 *
 * Deploy: Deploy → New Deployment → Web App
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * After first deploy, run setupSheets() manually once to create all tabs
 * and seed the initial admin account. The admin password will appear in
 * Apps Script Logs (View → Logs).
 */

/* ══════════════════════════════════════════
   Configuration
   ══════════════════════════════════════════ */

/**
 * @const {string} Google Sheet ID
 * Replace with your sheet ID from:
 * https://docs.google.com/spreadsheets/d/[YOUR-SHEET-ID]/edit
 */
const SHEET_ID = ''; // ← SET YOUR SHEET ID HERE

/** @const {string[]} Allowed origins for CORS */
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://kopeladi.github.io',
  'https://kopeladi.github.io/ParkLog'
];

/** @const {number} Max notes length */
const MAX_NOTES_LENGTH = 300;

/** @const {RegExp} Placa validation pattern */
const PLACA_PATTERN = /^[A-Z0-9-]{2,10}$/;

/** @const {RegExp} ID number validation (persona) */
const ID_NUMBER_PATTERN = /^[0-9]{5,12}$/;

/**
 * @const {string} Password hashing salt.
 * Hardcoded — changing this invalidates all existing passwords.
 */
const SALT = 'ParkLog$2026#v2!XqZ';

/* ══════════════════════════════════════════
   HTTP Handlers
   ══════════════════════════════════════════ */

/**
 * Handles GET requests (read operations).
 *
 * @param {Object} e - Apps Script event object
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
      case 'lookupPerson':
        result = lookupPerson(e.parameter.idNumber);
        break;
      case 'getVehicles':
        result = getVehicles(e.parameter);
        break;
      case 'getPersons':
        result = getPersons(e.parameter);
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
      case 'getPersonHistory':
        result = getPersonHistory(e.parameter.personId);
        break;
      case 'getUsers':
        result = getUsers(e.parameter.requesterId);
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
 *
 * @param {Object} e - Apps Script event object
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
      case 'savePersonEntry':
        result = savePersonEntry(body.data);
        break;
      case 'updateNotes':
        result = updateNotes(body.type, body.id, body.notes);
        break;
      case 'login':
        result = loginUser(body.displayName, body.password);
        break;
      case 'createUser':
        result = createUser(body.displayName, body.role, body.requesterId);
        break;
      case 'toggleUser':
        result = toggleUserActive(body.userId, body.requesterId);
        break;
      case 'resetPassword':
        result = resetUserPassword(body.userId, body.requesterId);
        break;
      case 'deleteUser':
        result = deleteUser(body.userId, body.requesterId);
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
   Vehicle Operations
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

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
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
 * Creates a new vehicle entry and creates/updates the vehicle record atomically.
 *
 * @param {{ placa: string, tipo: string, notes: string, createdBy: string, entryDate: string, queuedAt?: string }} data
 * @returns {{ success: boolean, isNew: boolean, entry: Object, vehicle: Object }}
 * @throws {Error} If validation fails
 */
function createEntry(data) {
  var placa = validatePlaca(data.placa);
  var tipo  = validateTipo(data.tipo);
  var notes = validateNotes(data.notes || '');

  var now;
  if (data.queuedAt) {
    var parsed = new Date(data.queuedAt);
    now = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    now = new Date();
  }
  var timeStr = formatTime(now);
  var dateStr = (data.entryDate && /^\d{4}-\d{2}-\d{2}$/.test(data.entryDate))
    ? data.entryDate
    : formatDate(now);

  var vehiclesSheet = getSheet('Vehicles');
  var entriesSheet  = getSheet('Entries');

  var vehiclesData    = vehiclesSheet.getDataRange().getValues();
  var vehiclesHeaders = vehiclesData[0];
  var existingRow     = -1;
  var existingVehicle = null;

  for (var i = 1; i < vehiclesData.length; i++) {
    var row = rowToObject(vehiclesHeaders, vehiclesData[i]);
    if (row.placa === placa) {
      existingRow     = i + 1;
      existingVehicle = row;
      break;
    }
  }

  var isNew       = existingRow === -1;
  var vehicleId;
  var totalVisits;

  if (isNew) {
    vehicleId   = Utilities.getUuid();
    totalVisits = 1;
    vehiclesSheet.appendRow([
      vehicleId, placa, tipo, dateStr, dateStr, 1,
      notes, data.createdBy || 'anonymous', notes ? dateStr : ''
    ]);
    var newVRow = vehiclesSheet.getLastRow();
    vehiclesSheet.getRange(newVRow, 1, 1, 9).setBackground('#c6efce');
  } else {
    vehicleId   = existingVehicle.vehicle_id;
    totalVisits = (existingVehicle.total_visits || 0) + 1;
    vehiclesSheet.getRange(existingRow, 5).setValue(dateStr);
    vehiclesSheet.getRange(existingRow, 6).setValue(totalVisits);
    vehiclesSheet.getRange(existingRow, 1, 1, 9).setBackground(null);
    if (notes) {
      vehiclesSheet.getRange(existingRow, 7).setValue(notes);
      vehiclesSheet.getRange(existingRow, 9).setValue(dateStr);
    }
  }

  var entryId = Utilities.getUuid();
  var entryRow = [entryId, vehicleId, placa, dateStr, timeStr, notes, data.createdBy || 'anonymous', 'vehicle', '', data.location || ''];
  if (entriesSheet.getLastRow() <= 1) {
    entriesSheet.appendRow(entryRow);
  } else {
    entriesSheet.insertRowAfter(1);
    entriesSheet.getRange(2, 1, 1, 10).setValues([entryRow]);
  }

  /* VisitLog mirror */
  var visitLogSheet = getSheet('VisitLog');
  var visitRow = [placa, tipo, dateStr, timeStr, data.createdBy || 'anonymous'];
  if (visitLogSheet.getLastRow() <= 1) {
    visitLogSheet.appendRow(visitRow);
  } else {
    visitLogSheet.insertRowAfter(1);
    visitLogSheet.getRange(2, 1, 1, 5).setValues([visitRow]);
  }

  return {
    success: true,
    isNew: isNew,
    entry: { entryId: entryId, placa: placa, entryDate: dateStr, entryTime: timeStr },
    vehicle: {
      vehicleId: vehicleId, placa: placa, tipo: tipo,
      firstSeen: isNew ? dateStr : formatDate(existingVehicle.first_seen),
      lastSeen: dateStr, totalVisits: totalVisits,
      notes: isNew ? notes : (notes || existingVehicle.notes || ''),
      notesUpdated: notes ? dateStr : (existingVehicle ? (formatDate(existingVehicle.notes_updated) || '') : '')
    }
  };
}

/**
 * Gets all vehicles with optional filters.
 *
 * @param {{ tipo?: string, status?: string, dateFrom?: string, dateTo?: string, search?: string }} filters
 * @returns {{ vehicles: Array<Object>, total: number }}
 */
function getVehicles(filters) {
  var sheet = getSheet('Vehicles');
  var data  = sheet.getDataRange().getValues();

  if (data.length <= 1) return { vehicles: [], total: 0 };

  var headers  = data[0];
  var vehicles = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    var vehicle = {
      vehicle_id:    row.vehicle_id,
      placa:         row.placa,
      tipo:          row.tipo,
      first_seen:    formatDate(row.first_seen),
      last_seen:     formatDate(row.last_seen),
      total_visits:  row.total_visits,
      notes:         row.notes || '',
      notes_updated: formatDate(row.notes_updated) || '',
      created_by:    row.created_by || 'anonymous'
    };

    if (filters.tipo && filters.tipo !== 'all' && vehicle.tipo !== filters.tipo) continue;

    if (filters.status && filters.status !== 'all') {
      var today    = formatDate(new Date());
      var isNewToday = vehicle.first_seen === today;
      if (filters.status === 'new'   && !isNewToday) continue;
      if (filters.status === 'known' && isNewToday)  continue;
    }

    if (filters.dateFrom && vehicle.first_seen < filters.dateFrom) continue;
    if (filters.dateTo   && vehicle.first_seen > filters.dateTo)   continue;

    if (filters.search) {
      var s = filters.search.toUpperCase();
      if (!vehicle.placa.includes(s) && !(vehicle.notes || '').toUpperCase().includes(s)) continue;
    }

    vehicles.push(vehicle);
  }

  return { vehicles: vehicles, total: vehicles.length };
}

/**
 * Gets entries with optional filters.
 *
 * @param {{ vehicleId?: string, dateFrom?: string, dateTo?: string }} filters
 * @returns {{ entries: Array<Object>, total: number }}
 */
function getEntries(filters) {
  var sheet = getSheet('Entries');
  var data  = sheet.getDataRange().getValues();

  if (data.length <= 1) return { entries: [], total: 0 };

  var headers = data[0];
  var entries = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    var entry = {
      entryId:    row.entry_id,
      vehicleId:  row.vehicle_id,
      placa:      row.placa,
      entryDate:  formatDate(row.entry_date),
      entryTime:  row.entry_time || '',
      notesEntry: row.notes_entry || '',
      createdBy:  row.created_by || 'anonymous',
      entryType:  row.entry_type || 'vehicle',
      personId:   row.person_id  || ''
    };

    if (filters.vehicleId && entry.vehicleId !== filters.vehicleId) continue;
    if (filters.dateFrom  && entry.entryDate < filters.dateFrom)    continue;
    if (filters.dateTo    && entry.entryDate > filters.dateTo)      continue;

    entries.push(entry);
  }

  return { entries: entries, total: entries.length };
}

/**
 * Gets entry history for a vehicle.
 *
 * @param {string} vehicleId
 * @returns {{ history: Array<{ date: string, time: string, notes: string }> }}
 */
function getVehicleHistory(vehicleId) {
  if (!vehicleId) throw new Error('vehicleId is required');

  var spreadsheetTZ = SpreadsheetApp.openById(SHEET_ID).getSpreadsheetTimeZone();
  var sheet   = getSheet('Entries');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var history = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.vehicle_id === vehicleId) {
      history.push({
        date:     formatDateTZ(row.entry_date, spreadsheetTZ),
        time:     extractTimeStr(row.entry_time),
        notes:    row.notes_entry || '',
        location: row.location || ''
      });
    }
  }

  history.sort(function(a, b) {
    var d = b.date.localeCompare(a.date);
    return d !== 0 ? d : b.time.localeCompare(a.time);
  });

  return { history: history };
}

/**
 * Gets entry history for a person.
 *
 * @param {string} personId
 * @returns {{ history: Array<{ date: string, time: string, notes: string, location: string }> }}
 */
function getPersonHistory(personId) {
  if (!personId) throw new Error('personId is required');

  var spreadsheetTZ = SpreadsheetApp.openById(SHEET_ID).getSpreadsheetTimeZone();
  var sheet   = getSheet('Entries');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var history = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.person_id === personId) {
      history.push({
        date:     formatDateTZ(row.entry_date, spreadsheetTZ),
        time:     extractTimeStr(row.entry_time),
        notes:    row.notes_entry || '',
        location: row.location || ''
      });
    }
  }

  history.sort(function(a, b) {
    var d = b.date.localeCompare(a.date);
    return d !== 0 ? d : b.time.localeCompare(a.time);
  });

  return { history: history };
}

/* ══════════════════════════════════════════
   Persona Operations
   ══════════════════════════════════════════ */

/**
 * Looks up a person by ID number.
 *
 * @param {string} idNumber
 * @returns {{ found: boolean, person_id?: string, firstName?: string, lastName?: string, lastSeen?: string, totalVisits?: number }}
 */
function lookupPerson(idNumber) {
  if (!idNumber) throw new Error('idNumber is required');
  idNumber = idNumber.trim();

  var sheet = getSheet('Persons');
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { found: false };

  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (String(row.id_number) === idNumber) {
      return {
        found:       true,
        person_id:   row.person_id,
        firstName:   row.first_name,
        lastName:    row.last_name,
        idNumber:    row.id_number,
        lastSeen:    formatDate(row.last_seen),
        totalVisits: row.total_visits
      };
    }
  }

  return { found: false };
}

/**
 * Saves a person entry and creates/updates the person record atomically.
 *
 * @param {{ firstName: string, lastName: string, idNumber: string, notes: string, createdBy: string, entryDate: string, queuedAt?: string }} data
 * @returns {{ success: boolean, isNew: boolean, person: Object }}
 * @throws {Error} If validation fails
 */
function savePersonEntry(data) {
  var firstName = (data.firstName || '').trim();
  var lastName  = (data.lastName  || '').trim();
  var idNumber  = (data.idNumber  || '').trim();
  var notes     = validateNotes(data.notes || '');

  if (!ID_NUMBER_PATTERN.test(idNumber)) {
    throw new Error('Invalid ID number: digits only, 5–12 characters');
  }
  if (!firstName) throw new Error('First name is required');
  if (!lastName)  throw new Error('Last name is required');

  var now;
  if (data.queuedAt) {
    var parsed = new Date(data.queuedAt);
    now = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    now = new Date();
  }
  var timeStr = formatTime(now);
  var dateStr = (data.entryDate && /^\d{4}-\d{2}-\d{2}$/.test(data.entryDate))
    ? data.entryDate
    : formatDate(now);

  var personsSheet = getSheet('Persons');
  var entriesSheet = getSheet('Entries');

  var personsData    = personsSheet.getDataRange().getValues();
  var personsHeaders = personsData[0];
  var existingRow    = -1;
  var existingPerson = null;

  for (var i = 1; i < personsData.length; i++) {
    var row = rowToObject(personsHeaders, personsData[i]);
    if (String(row.id_number) === idNumber) {
      existingRow    = i + 1;
      existingPerson = row;
      break;
    }
  }

  var isNew       = existingRow === -1;
  var personId;
  var totalVisits;

  if (isNew) {
    personId    = Utilities.getUuid();
    totalVisits = 1;
    personsSheet.appendRow([
      personId, idNumber, firstName, lastName,
      dateStr, dateStr, 1, notes, data.createdBy || 'anonymous'
    ]);
    var newPRow = personsSheet.getLastRow();
    personsSheet.getRange(newPRow, 1, 1, 9).setBackground('#c6efce');
  } else {
    personId    = existingPerson.person_id;
    totalVisits = (existingPerson.total_visits || 0) + 1;
    personsSheet.getRange(existingRow, 6).setValue(dateStr); // last_seen
    personsSheet.getRange(existingRow, 7).setValue(totalVisits);
    personsSheet.getRange(existingRow, 1, 1, 9).setBackground(null);
    if (notes) {
      personsSheet.getRange(existingRow, 8).setValue(notes);
    }
  }

  /* Create entry row — placa field stores id_number for denormalization */
  var entryId  = Utilities.getUuid();
  var entryRow = [entryId, '', idNumber, dateStr, timeStr, notes, data.createdBy || 'anonymous', 'persona', personId, data.location || ''];
  if (entriesSheet.getLastRow() <= 1) {
    entriesSheet.appendRow(entryRow);
  } else {
    entriesSheet.insertRowAfter(1);
    entriesSheet.getRange(2, 1, 1, 10).setValues([entryRow]);
  }

  return {
    success: true,
    isNew:   isNew,
    person: {
      personId:    personId,
      firstName:   firstName,
      lastName:    lastName,
      idNumber:    idNumber,
      firstSeen:   isNew ? dateStr : formatDate(existingPerson.first_seen),
      lastSeen:    dateStr,
      totalVisits: totalVisits
    }
  };
}

/**
 * Gets all persons with optional filters.
 *
 * @param {{ search?: string, dateFrom?: string, dateTo?: string }} filters
 * @returns {{ persons: Array<Object>, total: number }}
 */
function getPersons(filters) {
  var sheet = getSheet('Persons');
  var data  = sheet.getDataRange().getValues();

  if (data.length <= 1) return { persons: [], total: 0 };

  var headers = data[0];
  var persons = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    var person = {
      person_id:    row.person_id,
      id_number:    row.id_number,
      first_name:   row.first_name,
      last_name:    row.last_name,
      first_seen:   formatDate(row.first_seen),
      last_seen:    formatDate(row.last_seen),
      total_visits: row.total_visits,
      notes:        row.notes || '',
      created_by:   row.created_by || 'anonymous'
    };

    if (filters.dateFrom && person.first_seen < filters.dateFrom) continue;
    if (filters.dateTo   && person.first_seen > filters.dateTo)   continue;

    if (filters.search) {
      var s    = filters.search.toUpperCase();
      var name = (person.first_name + ' ' + person.last_name).toUpperCase();
      if (!String(person.id_number).includes(s) && !name.includes(s)) continue;
    }

    persons.push(person);
  }

  return { persons: persons, total: persons.length };
}

/* ══════════════════════════════════════════
   Notes Update
   ══════════════════════════════════════════ */

/**
 * Updates notes for a vehicle, entry, or person record.
 *
 * @param {'vehicle'|'entry'|'person'} type
 * @param {string} id - Record UUID
 * @param {string} notes - New notes text
 * @returns {{ success: boolean }}
 * @throws {Error} If record not found
 */
function updateNotes(type, id, notes) {
  notes = validateNotes(notes || '');

  var sheetName, idField, notesCol;

  if (type === 'vehicle') {
    sheetName = 'Vehicles'; idField = 'vehicle_id'; notesCol = 7;
  } else if (type === 'person') {
    sheetName = 'Persons';  idField = 'person_id';  notesCol = 8;
  } else {
    sheetName = 'Entries';  idField = 'entry_id';   notesCol = 6;
  }

  var sheet   = getSheet(sheetName);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row[idField] === id) {
      sheet.getRange(i + 1, notesCol).setValue(notes);
      if (type === 'vehicle') {
        sheet.getRange(i + 1, 9).setValue(notes ? formatDate(new Date()) : '');
      }
      return { success: true, notesUpdated: notes ? formatDate(new Date()) : '' };
    }
  }

  throw new Error('Record not found: ' + id);
}

/* ══════════════════════════════════════════
   Dashboard
   ══════════════════════════════════════════ */

/**
 * Returns aggregated dashboard data (KPIs + chart data) in one call.
 *
 * @param {Object} params - { today: string, weekStart: string } from client
 * @returns {{ kpis: Object, weeklyData: Array, newVsKnown: Object }}
 */
function getDashboardData(params) {
  var vehiclesSheet = getSheet('Vehicles');
  var entriesSheet  = getSheet('Entries');
  var personsSheet  = getSheet('Persons');

  var vehiclesData = vehiclesSheet.getDataRange().getValues();
  var entriesData  = entriesSheet.getDataRange().getValues();
  var personsData  = personsSheet.getDataRange().getValues();

  var today     = (params && params.today)     ? params.today     : formatDate(new Date());
  var weekStart = (params && params.weekStart) ? params.weekStart : getWeekStart(new Date());

  var spreadsheetTZ = SpreadsheetApp.openById(SHEET_ID).getSpreadsheetTimeZone();

  /* KPIs */
  var entriesToday   = 0;
  var weeklyEntries  = 0;
  var totalVehicles  = vehiclesData.length > 1 ? vehiclesData.length - 1 : 0;
  var totalPersons   = personsData.length  > 1 ? personsData.length  - 1 : 0;
  var newToday       = 0;

  if (entriesData.length > 1) {
    var entriesHeaders = entriesData[0];
    for (var i = 1; i < entriesData.length; i++) {
      var row = rowToObject(entriesHeaders, entriesData[i]);
      var entryDate = formatDateTZ(row.entry_date, spreadsheetTZ);
      if (entryDate === today) entriesToday++;
      if (entryDate >= weekStart) weeklyEntries++;
    }
  }

  /* New vehicles today */
  if (vehiclesData.length > 1) {
    var vHeaders = vehiclesData[0];
    for (var i = 1; i < vehiclesData.length; i++) {
      var vRow = rowToObject(vHeaders, vehiclesData[i]);
      if (formatDateTZ(vRow.first_seen, spreadsheetTZ) === today) newToday++;
    }
  }

  var weeklyData = getWeeklyChartData(entriesData, spreadsheetTZ);

  var newCount   = 0;
  var knownCount = 0;
  if (vehiclesData.length > 1) {
    var vHeaders2 = vehiclesData[0];
    for (var i = 1; i < vehiclesData.length; i++) {
      var vRow2 = rowToObject(vHeaders2, vehiclesData[i]);
      if (formatDateTZ(vRow2.first_seen, spreadsheetTZ) === today) {
        newCount++;
      } else {
        knownCount++;
      }
    }
  }

  return {
    kpis: {
      entriesToday:  entriesToday,
      newToday:      newToday,
      totalVehicles: totalVehicles,
      totalPersons:  totalPersons,
      weeklyEntries: weeklyEntries
    },
    weeklyData:  weeklyData,
    newVsKnown: { new: newCount, known: knownCount }
  };
}

/* ══════════════════════════════════════════
   Auth Operations
   ══════════════════════════════════════════ */

/**
 * Authenticates a user by display_name + password.
 *
 * @param {string} displayName
 * @param {string} password
 * @returns {{ success: boolean, user_id?: string, display_name?: string, role?: string, error?: string }}
 */
function loginUser(displayName, password) {
  if (!displayName || !password) {
    return { success: false, error: 'missing_fields' };
  }

  var sheet   = getSheet('Users');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.display_name === displayName.trim()) {
      if (!row.is_active) {
        return { success: false, error: 'inactive' };
      }
      var hash = hashPassword(password);
      if (hash === row.password_hash) {
        return {
          success:      true,
          user_id:      row.user_id,
          display_name: row.display_name,
          role:         row.role
        };
      }
      return { success: false, error: 'wrong_password' };
    }
  }

  return { success: false, error: 'not_found' };
}

/**
 * Creates a new user (admin only). Generates and returns a one-time plaintext password.
 *
 * @param {string} displayName
 * @param {'admin'|'employee'} role
 * @param {string} requesterId - user_id of the requesting admin
 * @returns {{ success: boolean, plaintext_password?: string }}
 * @throws {Error} If not admin or duplicate display_name
 */
function createUser(displayName, role, requesterId) {
  if (!isRequesterAdmin(requesterId)) throw new Error('Admin access required');
  if (!displayName || displayName.trim().length === 0) throw new Error('Display name is required');
  if (role !== 'admin' && role !== 'employee') role = 'employee';

  var sheet   = getSheet('Users');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  /* Check for duplicate display name */
  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.display_name === displayName.trim()) {
      throw new Error('Username already exists');
    }
  }

  var password = generatePassword();
  var hash     = hashPassword(password);
  var userId   = Utilities.getUuid();

  sheet.appendRow([userId, displayName.trim(), hash, role, true, formatDate(new Date())]);

  return { success: true, plaintext_password: password };
}

/**
 * Toggles is_active for a user (admin only). Admin cannot deactivate themselves.
 *
 * @param {string} userId - Target user UUID
 * @param {string} requesterId - Requesting admin UUID
 * @returns {{ success: boolean, is_active: boolean }}
 * @throws {Error} If not admin, self-deactivation, or user not found
 */
function toggleUserActive(userId, requesterId) {
  if (!isRequesterAdmin(requesterId)) throw new Error('Admin access required');
  if (userId === requesterId) throw new Error('Cannot deactivate yourself');

  var sheet   = getSheet('Users');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.user_id === userId) {
      var isActiveCol = headers.indexOf('is_active') + 1;
      var newStatus   = !row.is_active;
      sheet.getRange(i + 1, isActiveCol).setValue(newStatus);
      return { success: true, is_active: newStatus };
    }
  }

  throw new Error('User not found');
}

/**
 * Resets a user's password and returns the new plaintext once (admin only).
 *
 * @param {string} userId
 * @param {string} requesterId
 * @returns {{ success: boolean, plaintext_password: string }}
 * @throws {Error} If not admin or user not found
 */
function resetUserPassword(userId, requesterId) {
  if (!isRequesterAdmin(requesterId)) throw new Error('Admin access required');

  var sheet   = getSheet('Users');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.user_id === userId) {
      var password    = generatePassword();
      var hash        = hashPassword(password);
      var hashCol     = headers.indexOf('password_hash') + 1;
      sheet.getRange(i + 1, hashCol).setValue(hash);
      return { success: true, plaintext_password: password };
    }
  }

  throw new Error('User not found');
}

/**
 * Deletes a user permanently (admin only). Admin cannot delete themselves.
 *
 * @param {string} userId
 * @param {string} requesterId
 * @returns {{ success: boolean }}
 * @throws {Error} If not admin, self-deletion, or user not found
 */
function deleteUser(userId, requesterId) {
  if (!isRequesterAdmin(requesterId)) throw new Error('Admin access required');
  if (userId === requesterId) throw new Error('Cannot delete yourself');

  var sheet   = getSheet('Users');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.user_id === userId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  throw new Error('User not found');
}

/**
 * Returns all users (admin only). Excludes password_hash from response.
 *
 * @param {string} requesterId
 * @returns {{ users: Array }}
 * @throws {Error} If not admin
 */
function getUsers(requesterId) {
  if (!isRequesterAdmin(requesterId)) throw new Error('Admin access required');

  var sheet   = getSheet('Users');
  var data    = sheet.getDataRange().getValues();
  if (data.length <= 1) return { users: [] };

  var headers = data[0];
  var users   = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    users.push({
      user_id:      row.user_id,
      display_name: row.display_name,
      role:         row.role,
      is_active:    row.is_active,
      created_at:   formatDate(row.created_at)
    });
  }

  return { users: users };
}

/* ══════════════════════════════════════════
   Auth Helpers
   ══════════════════════════════════════════ */

/**
 * Hashes a password with SALT using SHA-256.
 *
 * @param {string} password
 * @returns {string} Lowercase hex string
 */
function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    SALT + password
  );
  return bytes.map(function(b) {
    var hex = (b & 0xFF).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Generates an 8-character random password (no ambiguous chars: I, O, 1, 0).
 *
 * @returns {string}
 */
function generatePassword() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var pwd   = '';
  for (var i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

/**
 * Returns true if the given user_id belongs to an active admin.
 *
 * @param {string} requesterId
 * @returns {boolean}
 */
function isRequesterAdmin(requesterId) {
  if (!requesterId) return false;

  var sheet   = getSheet('Users');
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    if (row.user_id === requesterId && row.role === 'admin' && row.is_active) {
      return true;
    }
  }

  return false;
}

/* ══════════════════════════════════════════
   Sheet Helpers
   ══════════════════════════════════════════ */

/**
 * Gets a sheet by name, creating it with headers if it doesn't exist.
 *
 * @param {string} name
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(name) {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);

    if (name === 'Vehicles') {
      sheet.appendRow(['vehicle_id', 'placa', 'tipo', 'first_seen', 'last_seen', 'total_visits', 'notes', 'created_by', 'notes_updated']);
    } else if (name === 'Entries') {
      sheet.appendRow(['entry_id', 'vehicle_id', 'placa', 'entry_date', 'entry_time', 'notes_entry', 'created_by', 'entry_type', 'person_id', 'location']);
    } else if (name === 'VisitLog') {
      sheet.appendRow(['placa', 'tipo', 'visit_date', 'visit_time', 'created_by']);
    } else if (name === 'Persons') {
      sheet.appendRow(['person_id', 'id_number', 'first_name', 'last_name', 'first_seen', 'last_seen', 'total_visits', 'notes', 'created_by']);
    } else if (name === 'Users') {
      sheet.appendRow(['user_id', 'display_name', 'password_hash', 'role', 'is_active', 'created_at']);
    }

    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Converts a sheet row to an object using headers as keys.
 *
 * @param {string[]} headers
 * @param {any[]} row
 * @returns {Object}
 */
function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function(header, i) {
    obj[header] = row[i];
  });
  return obj;
}

/* ══════════════════════════════════════════
   Date / Time Helpers
   ══════════════════════════════════════════ */

/**
 * Formats a Date to YYYY-MM-DD using the script timezone.
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
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Formats a date using the SPREADSHEET timezone (handles UTC+ correctly).
 *
 * @param {Date|string} dateValue
 * @param {string} spreadsheetTZ
 * @returns {string} YYYY-MM-DD
 */
function formatDateTZ(dateValue, spreadsheetTZ) {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') {
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) return dateValue;
    dateValue = new Date(dateValue);
  }
  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) return '';
  return Utilities.formatDate(dateValue, spreadsheetTZ, 'yyyy-MM-dd');
}

/**
 * Formats a Date to HH:MM.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
}

/**
 * Extracts a time string from a Sheets cell value (handles Date epoch values).
 *
 * @param {Date|string|number} val
 * @returns {string} "HH:mm" or empty string
 */
function extractTimeStr(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm');
  }
  if (typeof val === 'string') return val;
  return '';
}

/**
 * Returns the ISO Monday for a given date's week.
 *
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
function getWeekStart(date) {
  var d   = new Date(date);
  var day = d.getUTCDay();
  var diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return formatDate(d);
}

/**
 * Generates weekly entry counts for the bar chart (last 9 weeks).
 *
 * @param {any[][]} entriesData
 * @param {string} spreadsheetTZ
 * @returns {Array<{ weekStart: string, count: number }>}
 */
function getWeeklyChartData(entriesData, spreadsheetTZ) {
  var weeks = {};
  var now   = new Date();

  for (var w = 8; w >= 0; w--) {
    var d  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (w * 7), 12, 0, 0));
    var ws = getWeekStart(d);
    weeks[ws] = 0;
  }

  if (entriesData.length > 1) {
    var headers = entriesData[0];
    for (var i = 1; i < entriesData.length; i++) {
      var row = rowToObject(headers, entriesData[i]);
      var entryDateStr = formatDateTZ(row.entry_date, spreadsheetTZ);
      if (!entryDateStr) continue;
      var ws2 = getWeekStart(new Date(entryDateStr + 'T12:00:00Z'));
      if (weeks.hasOwnProperty(ws2)) {
        weeks[ws2]++;
      }
    }
  }

  return Object.keys(weeks).map(function(weekStart) {
    return { weekStart: weekStart, count: weeks[weekStart] };
  });
}

/* ══════════════════════════════════════════
   Validation
   ══════════════════════════════════════════ */

/**
 * Validates and normalizes a license plate.
 *
 * @param {string} placa
 * @returns {string} Normalized uppercase plate
 * @throws {Error} If invalid format
 */
function validatePlaca(placa) {
  if (!placa || typeof placa !== 'string') throw new Error('Plate number is required');
  placa = placa.trim().toUpperCase();
  if (!PLACA_PATTERN.test(placa)) throw new Error('Invalid plate format: A-Z, 0-9, dash, 2-10 characters');
  return placa;
}

/**
 * Validates vehicle type, defaults to 'auto'.
 *
 * @param {string} tipo
 * @returns {string}
 */
function validateTipo(tipo) {
  if (!tipo || (tipo !== 'auto' && tipo !== 'moto')) return 'auto';
  return tipo;
}

/**
 * Validates notes length.
 *
 * @param {string} notes
 * @returns {string}
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
 * Creates a JSON response.
 *
 * @param {Object} data
 * @param {number} [statusCode=200]
 * @returns {TextOutput}
 */
function jsonResponse(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════════
   Setup Helpers (run once manually)
   ══════════════════════════════════════════ */

/**
 * Creates all sheets and seeds the initial admin account.
 * Run this function once after creating the Google Sheet.
 * Check Apps Script Logs (View → Logs) for the generated admin password.
 */
function setupSheets() {
  getSheet('Vehicles');
  getSheet('Entries');
  getSheet('VisitLog');
  getSheet('Persons');
  getSheet('Users');
  setupUsersSheet();
  console.log('All sheets created/verified successfully!');
}

/**
 * Seeds the Users sheet with an initial admin account.
 * Only runs if the sheet has no data rows (row 2 onward empty).
 * Logs credentials to the Execution log (console.log).
 */
function setupUsersSheet() {
  var sheet   = getSheet('Users');
  var headers = ['user_id', 'display_name', 'password_hash', 'role', 'is_active', 'created_at'];

  /* Ensure header row exists */
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  /* Skip if any data rows already present */
  if (sheet.getLastRow() > 1) {
    console.log('Users sheet already has data — skipping seed.');
    return;
  }

  var password = generatePassword();
  var hash     = hashPassword(password);
  var userId   = Utilities.getUuid();
  sheet.appendRow([userId, 'admin', hash, 'admin', true, formatDate(new Date())]);
  console.log('=============================');
  console.log('ADMIN ACCOUNT CREATED');
  console.log('Username: admin');
  console.log('Password: ' + password);
  console.log('=============================');
}

/**
 * Clears green highlight from Vehicles and Persons sheets.
 * Set as a daily time-based trigger (Triggers → Add Trigger → clearDailyColors → Day timer).
 */
function clearDailyColors() {
  var vehiclesSheet = getSheet('Vehicles');
  var lastRow       = vehiclesSheet.getLastRow();
  if (lastRow > 1) vehiclesSheet.getRange(2, 1, lastRow - 1, 9).setBackground(null);

  var personsSheet  = getSheet('Persons');
  var lastRowP      = personsSheet.getLastRow();
  if (lastRowP > 1) personsSheet.getRange(2, 1, lastRowP - 1, 9).setBackground(null);

  Logger.log('Daily colors cleared: ' + new Date().toISOString());
}
