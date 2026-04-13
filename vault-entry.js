/**
 * ParkLog — VaultEntry Logic
 * Form handling, plate/person lookup, submission, session tracking.
 * v2.0: auth.js-based login, persona entry type, version-gated storage clear.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Change 3: Version-gated storage invalidation ── */
  const storedVersion = localStorage.getItem('parklog-version');
  if (storedVersion !== CONFIG.PARKLOG_VERSION) {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('parklog-version', CONFIG.PARKLOG_VERSION);
  }

  /* ── DOM References ── */
  const loginOverlay  = document.getElementById('login-overlay');
  const loginBtn      = document.getElementById('login-btn');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginError    = document.getElementById('login-error');

  const headerUserBtn = document.getElementById('header-user-btn');

  /* Vehicle fields */
  const vehicleFields = document.getElementById('vehicle-fields');
  const placaInput    = document.getElementById('placa-input');
  const placaError    = document.getElementById('placa-error');
  const placaSpinner  = document.getElementById('placa-spinner');
  const placaClear    = document.getElementById('placa-clear');

  /* Person fields */
  const personFields    = document.getElementById('person-fields');
  const firstNameInput  = document.getElementById('first-name-input');
  const lastNameInput   = document.getElementById('last-name-input');
  const idNumberInput   = document.getElementById('id-number-input');
  const idSpinner       = document.getElementById('id-spinner');
  const idError         = document.getElementById('id-error');

  /* Shared */
  const vehicleStatus  = document.getElementById('vehicle-status');
  const notesInput     = document.getElementById('notes-input');
  const locationError   = document.getElementById('location-error');
  const locationWarning = document.getElementById('location-warning');
  const locationBtns    = document.querySelectorAll('[data-location]');
  const charCount     = document.getElementById('char-count');
  const submitBtn     = document.getElementById('submit-btn');
  const confirmation  = document.getElementById('confirmation');
  const sessionItems  = document.getElementById('session-items');
  const sessionCount  = document.getElementById('session-count');
  const copySessionBtn = document.getElementById('copy-session-btn');
  const offlineBar    = document.getElementById('offline-bar');

  /* ── State ── */
  let currentUser     = '';
  let selectedTipo    = CONFIG.DEFAULT_VEHICLE_TYPE; // 'auto' | 'moto' | 'persona'
  let selectedLocation = '';                         // 'central' | 'small' | 'environ'
  let currentVehicle      = null; // { isNew, vehicle } from vehicle lookup
  let currentPerson       = null; // { found, person_id, firstName, ... } from person lookup
  let currentTodayLocations = []; // locations of today's entries for the current known entity
  let lookupTimer         = null;
  let lookupGeneration = 0;
  let submitCooldown  = false;

  /* ── Session Storage ── */
  const SESSION_STORE_KEY = 'parklog-session-v3'; // v3 for v2.0 release

  /* ── History Modal ── */
  const veHistoryModal = document.getElementById('ve-history-modal');
  const veHistoryClose = document.getElementById('ve-history-close');
  const veHistoryDone  = document.getElementById('ve-history-done');
  const veHistoryCopy  = document.getElementById('ve-history-copy');
  const veHistoryPlate = document.getElementById('ve-history-plate');
  const veHistoryBody  = document.getElementById('ve-history-body');

  veHistoryClose.addEventListener('click', closeHistoryModal);
  veHistoryDone.addEventListener('click', closeHistoryModal);
  veHistoryModal.addEventListener('click', e => { if (e.target === veHistoryModal) closeHistoryModal(); });
  veHistoryCopy.addEventListener('click', copyHistoryTable);

  /* ══════════════════════════════════════════
     Auth — Login / Session
     ══════════════════════════════════════════ */

  function showHeaderUser() {
    if (currentUser && headerUserBtn) {
      headerUserBtn.textContent = `👤 ${currentUser} ✕`;
      headerUserBtn.classList.remove('hidden');
    }
  }

  function handleSignOut() {
    Auth.clearSession();
    location.reload();
  }

  if (headerUserBtn) headerUserBtn.addEventListener('click', handleSignOut);

  /* Check for existing valid session */
  const existingSession = Auth.requireAuth();
  if (existingSession) {
    currentUser = existingSession.display_name;
    loginOverlay.classList.add('hidden');
    showHeaderUser();
  }

  loginBtn.addEventListener('click', handleLogin);
  loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  /**
   * Authenticates via Apps Script then stores session in Auth.
   * @returns {Promise<void>}
   */
  async function handleLogin() {
    const displayName = loginUsername.value.trim();
    const password    = loginPassword.value;

    if (!displayName) {
      loginError.textContent = t('login.error.user');
      loginError.classList.remove('hidden');
      return;
    }

    loginBtn.disabled = true;
    const btnSpan = loginBtn.querySelector('span');
    if (btnSpan) btnSpan.textContent = t('login.loading');
    loginError.classList.add('hidden');

    try {
      const result = await DataStore.login(displayName, password);

      if (!result.success) {
        const msg = result.error === 'wrong_password'
          ? t('login.error.password')
          : t('login.error.user');
        loginError.textContent = msg;
        loginError.classList.remove('hidden');
        loginPassword.value = '';
        return;
      }

      const session = Auth.setSession(result);
      currentUser = session.display_name;
      loginOverlay.classList.add('hidden');
      showHeaderUser();
      applyTranslations();
      lucide.createIcons();
      loadSessionList();

    } catch {
      loginError.textContent = t('msg.error.server');
      loginError.classList.remove('hidden');
    } finally {
      loginBtn.disabled = false;
      if (btnSpan) btnSpan.textContent = t('login.submit');
    }
  }

  /* ══════════════════════════════════════════
     Initialization
     ══════════════════════════════════════════ */

  applyTranslations();
  lucide.createIcons();
  loadSessionList();
  setupOnlineOfflineListeners();

  /* Process any queued entries */
  if (navigator.onLine && DataStore.getQueueSize() > 0) {
    DataStore.processQueue().then(result => {
      if (result.sent > 0) {
        showToast(t('msg.online') + ` (${result.sent})`, 'success');
      }
    });
  }

  /* ══════════════════════════════════════════
     Tipo Toggle
     ══════════════════════════════════════════ */

  document.querySelectorAll('[data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tipo]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      selectedTipo = btn.dataset.tipo;
      handleTipoChange();
    });
  });

  locationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      locationBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      selectedLocation = btn.dataset.location;
      locationError.classList.add('hidden');
      checkAndShowDuplicateWarning();
      updateSubmitState();
    });
  });

  /**
   * Shows/hides vehicle vs person fields based on selectedTipo.
   * Resets all lookup state when switching modes.
   */
  function handleTipoChange() {
    const isPersona = selectedTipo === 'persona';

    vehicleFields.classList.toggle('hidden', isPersona);
    personFields.classList.toggle('hidden', !isPersona);

    /* Reset state for the hidden mode */
    hideStatus();
    currentVehicle = null;
    currentPerson  = null;
    currentTodayLocations = [];
    locationWarning.classList.add('hidden');
    clearTimeout(lookupTimer);

    if (isPersona) {
      hideError();
      hideIdError();
      firstNameInput.focus();
    } else {
      hideIdError();
      placaInput.value = '';
      hideError();
      placaInput.focus();
    }

    updateSubmitState();
  }

  /* ══════════════════════════════════════════
     Placa Input Events (vehicle mode)
     ══════════════════════════════════════════ */

  placaInput.addEventListener('input', e => {
    /* Auto-uppercase + filter invalid chars */
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    e.target.setSelectionRange(pos, pos);

    placaClear.classList.toggle('hidden', e.target.value.length === 0);
    hideError();
    hideStatus();
    currentVehicle = null;
    updateSubmitState();

    clearTimeout(lookupTimer);
    const placa = e.target.value.trim();
    if (placa.length >= CONFIG.PLACA_MIN_LENGTH) {
      lookupTimer = setTimeout(() => lookupVehicle(placa), CONFIG.LOOKUP_DEBOUNCE_MS);
    }
  });

  placaInput.addEventListener('blur', () => {
    const placa = placaInput.value.trim();
    if (placa.length > 0 && placa.length < CONFIG.PLACA_MIN_LENGTH) {
      showError(t('msg.error.format'));
    }
  });

  placaInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !submitBtn.disabled) handleSubmit();
  });

  placaClear.addEventListener('click', () => {
    placaInput.value = '';
    placaClear.classList.add('hidden');
    hideError();
    hideStatus();
    currentVehicle = null;
    clearTimeout(lookupTimer);
    updateSubmitState();
    placaInput.focus();
  });

  /* ══════════════════════════════════════════
     ID Number Input Events (persona mode)
     ══════════════════════════════════════════ */

  idNumberInput.addEventListener('input', e => {
    /* Digits only */
    e.target.value = e.target.value.replace(/[^0-9]/g, '');

    hideIdError();
    hideStatus();
    currentPerson = null;
    updateSubmitState();

    clearTimeout(lookupTimer);
    const id = e.target.value.trim();
    if (id.length >= CONFIG.ID_NUMBER_MIN_LENGTH) {
      lookupTimer = setTimeout(() => lookupPerson(id), CONFIG.LOOKUP_DEBOUNCE_MS);
    }
  });

  idNumberInput.addEventListener('blur', () => {
    const id = idNumberInput.value.trim();
    if (id.length > 0 && (id.length < CONFIG.ID_NUMBER_MIN_LENGTH || !CONFIG.ID_NUMBER_PATTERN.test(id))) {
      showIdError(t('msg.error.idFormat'));
    }
  });

  idNumberInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !submitBtn.disabled) handleSubmit();
  });

  /* ── Notes character counter ── */
  notesInput.addEventListener('input', () => {
    charCount.textContent = notesInput.value.length;
  });

  /* ── Submit ── */
  submitBtn.addEventListener('click', handleSubmit);

  /* ── Language Toggle ── */
  updateLangToggle();
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.lang !== getCurrentLang()) {
        toggleLang();
        updateLangToggle();
        lucide.createIcons();
      }
    });
  });

  /* ── Copy Session Entries ── */
  copySessionBtn.addEventListener('click', copySessionPlates);

  /* ══════════════════════════════════════════
     Vehicle Lookup
     ══════════════════════════════════════════ */

  /**
   * Looks up a plate in the backend and shows new/known badge.
   *
   * @param {string} placa - Normalized plate
   * @returns {Promise<void>}
   */
  async function lookupVehicle(placa) {
    const gen = ++lookupGeneration;

    if (!CONFIG.APPS_SCRIPT_URL) {
      currentVehicle = { isNew: true, vehicle: null };
      showStatusBadge(true, null, 'vehicle');
      updateSubmitState();
      return;
    }

    showSpinner('vehicle', true);

    try {
      const result = await DataStore.searchVehicle(placa);
      if (gen !== lookupGeneration) return;
      currentVehicle = result;
      currentTodayLocations = [];
      locationWarning.classList.add('hidden');
      showStatusBadge(result.isNew, result.vehicle, 'vehicle');
      if (!result.isNew && result.vehicle?.vehicleId) {
        fetchTodayLocations('vehicle', result.vehicle.vehicleId);
      }
    } catch {
      if (gen !== lookupGeneration) return;
      currentVehicle = { isNew: null, vehicle: null };
    } finally {
      if (gen === lookupGeneration) {
        showSpinner('vehicle', false);
        updateSubmitState();
      }
    }
  }

  /* ══════════════════════════════════════════
     Person Lookup
     ══════════════════════════════════════════ */

  /**
   * Looks up a person by ID number in the backend.
   *
   * @param {string} idNumber
   * @returns {Promise<void>}
   */
  async function lookupPerson(idNumber) {
    const gen = ++lookupGeneration;

    if (!CONFIG.APPS_SCRIPT_URL) {
      currentPerson = { found: false };
      showStatusBadge(true, null, 'persona');
      updateSubmitState();
      return;
    }

    showSpinner('persona', true);

    try {
      const result = await DataStore.lookupPerson(idNumber);
      if (gen !== lookupGeneration) return;
      currentPerson = result;
      currentTodayLocations = [];
      locationWarning.classList.add('hidden');
      showStatusBadge(!result.found, result.found ? result : null, 'persona');
      if (result.found && result.person_id) {
        fetchTodayLocations('persona', result.person_id);
      }
    } catch {
      if (gen !== lookupGeneration) return;
      currentPerson = { found: null };
    } finally {
      if (gen === lookupGeneration) {
        showSpinner('persona', false);
        updateSubmitState();
      }
    }
  }

  /* ══════════════════════════════════════════
     Form Submission
     ══════════════════════════════════════════ */

  /**
   * Handles form submission for both vehicle and persona entry types.
   * @returns {Promise<void>}
   */
  async function handleSubmit() {
    if (submitCooldown || submitBtn.disabled) return;

    const session = Auth.getSession();
    const createdBy = session ? session.display_name : (currentUser || 'anonymous');

    if (selectedTipo === 'persona') {
      await handlePersonSubmit(createdBy);
    } else {
      await handleVehicleSubmit(createdBy);
    }
  }

  /**
   * Submits a vehicle entry.
   * @param {string} createdBy
   * @returns {Promise<void>}
   */
  async function handleVehicleSubmit(createdBy) {
    const placa = placaInput.value.trim();

    if (!placa) { showError(t('msg.error.empty')); placaInput.focus(); return; }
    if (!CONFIG.PLACA_PATTERN.test(placa) || placa.length > CONFIG.PLACA_MAX_LENGTH) {
      showError(t('msg.error.format')); placaInput.focus(); return;
    }
    if (!selectedLocation) {
      locationError.textContent = t('entry.location.error');
      locationError.classList.remove('hidden');
      return;
    }

    startSubmit();

    try {
      let result;
      if (!CONFIG.APPS_SCRIPT_URL) {
        result = {
          success: true,
          isNew: currentVehicle?.isNew ?? true,
          vehicle: { placa, totalVisits: 1 },
          entry: { entryTime: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }
        };
      } else {
        result = await DataStore.saveEntry({
          placa, tipo: selectedTipo,
          notes: notesInput.value.trim(),
          location: selectedLocation,
          createdBy, entryDate: _todayStr()
        });
      }

      if (result.queued) {
        showToast(t('msg.queued'), 'warning');
        addToSession(placa, true, 'vehicle');
      } else if (result.isNew) {
        showConfirmation(t('msg.saved.new'), 'success-new', placa);
        addToSession(placa, true, 'vehicle');
      } else {
        showConfirmation(t('msg.saved.known', { count: result.vehicle?.totalVisits || '?' }), 'success-known', placa);
        addToSession(placa, false, 'vehicle');
      }

      resetForm();
    } catch {
      showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
      endSubmitError();
      return;
    }

    scheduleSubmitCooldown();
  }

  /**
   * Submits a persona entry.
   * @param {string} createdBy
   * @returns {Promise<void>}
   */
  async function handlePersonSubmit(createdBy) {
    const firstName = firstNameInput.value.trim();
    const lastName  = lastNameInput.value.trim();
    const idNumber  = idNumberInput.value.trim();

    if (!idNumber) { showIdError(t('msg.error.idEmpty')); idNumberInput.focus(); return; }
    if (!CONFIG.ID_NUMBER_PATTERN.test(idNumber) ||
        idNumber.length < CONFIG.ID_NUMBER_MIN_LENGTH ||
        idNumber.length > CONFIG.ID_NUMBER_MAX_LENGTH) {
      showIdError(t('msg.error.idFormat')); idNumberInput.focus(); return;
    }
    if (!firstName) { firstNameInput.focus(); return; }
    if (!lastName)  { lastNameInput.focus();  return; }
    if (!selectedLocation) {
      locationError.textContent = t('entry.location.error');
      locationError.classList.remove('hidden');
      return;
    }

    startSubmit();

    try {
      let result;
      if (!CONFIG.APPS_SCRIPT_URL) {
        result = {
          success: true, isNew: true,
          person: { firstName, lastName, idNumber, totalVisits: 1 }
        };
      } else {
        result = await DataStore.savePersonEntry({
          firstName, lastName, idNumber,
          notes: notesInput.value.trim(),
          location: selectedLocation,
          createdBy, entryDate: _todayStr()
        });
      }

      const displayName = `${firstName} ${lastName}`;
      if (result.queued) {
        showToast(t('msg.queued'), 'warning');
        addToSession(displayName, true, 'persona');
      } else if (result.isNew) {
        showConfirmation(t('msg.saved.new.person'), 'success-new', displayName);
        addToSession(displayName, true, 'persona');
      } else {
        showConfirmation(t('msg.saved.known.person', { count: result.person?.totalVisits || '?' }), 'success-known', displayName);
        addToSession(displayName, false, 'persona');
      }

      resetForm();
    } catch {
      showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
      endSubmitError();
      return;
    }

    scheduleSubmitCooldown();
  }

  function startSubmit() {
    submitCooldown = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.querySelector('span').textContent = t('entry.submitting');
  }

  function endSubmitError() {
    submitCooldown = false;
    submitBtn.classList.remove('loading');
    submitBtn.querySelector('span').textContent = t('entry.submit');
    updateSubmitState();
    lucide.createIcons();
  }

  function scheduleSubmitCooldown() {
    setTimeout(() => {
      submitCooldown = false;
      submitBtn.classList.remove('loading');
      submitBtn.querySelector('span').textContent = t('entry.submit');
      updateSubmitState();
      lucide.createIcons();
    }, CONFIG.SUBMIT_COOLDOWN_MS);
  }

  /* ══════════════════════════════════════════
     Session List
     ══════════════════════════════════════════ */

  function _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /**
   * Adds an entry to the session list.
   * @param {string} identifier - Plate number or person full name
   * @param {boolean} isNew
   * @param {'vehicle'|'persona'} entryType
   */
  function addToSession(identifier, isNew, entryType) {
    const session = getSessionData();
    session.items.push({
      identifier,
      isNew,
      entryType,
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    });
    saveSessionData(session);
    renderSessionList(session);
  }

  /**
   * Gets session data from localStorage. Resets if date or user changed.
   * @returns {{ date: string, user: string, items: Array }}
   */
  function getSessionData() {
    try {
      const stored = JSON.parse(localStorage.getItem(SESSION_STORE_KEY));
      if (stored && stored.date === _todayStr() && stored.user === currentUser) {
        return stored;
      }
    } catch { /* fall through */ }
    return { date: _todayStr(), user: currentUser, items: [] };
  }

  function saveSessionData(session) {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(session));
  }

  function loadSessionList() {
    renderSessionList(getSessionData());
  }

  /**
   * Renders the session list DOM.
   * @param {{ items: Array }} session
   */
  function renderSessionList(session) {
    const items = session.items || [];

    if (items.length === 0) {
      sessionItems.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.padding = 'var(--space-lg)';
      const p = document.createElement('p');
      p.className = 'text-sm text-muted';
      p.textContent = t('session.empty');
      empty.appendChild(p);
      sessionItems.appendChild(empty);
      sessionCount.classList.add('hidden');
      copySessionBtn.classList.add('hidden');
      return;
    }

    sessionItems.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'session-item';

      const badge = document.createElement('span');
      badge.className = 'session-badge ' + (item.isNew ? 'session-badge-new' : 'session-badge-known');
      badge.textContent = item.isNew ? t('session.badge.new') : t('session.badge.known');

      const idSpan = document.createElement('span');
      idSpan.className = 'plate';
      /* Show emoji prefix for persona entries */
      idSpan.textContent = item.entryType === 'persona' ? `🚶 ${item.identifier}` : item.identifier;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'time';
      timeSpan.textContent = item.time;

      el.appendChild(badge);
      el.appendChild(idSpan);
      el.appendChild(timeSpan);
      sessionItems.appendChild(el);
    });

    const newCount = items.filter(i => i.isNew).length;
    sessionCount.textContent = items.length;
    sessionCount.classList.remove('hidden');

    if (newCount > 0) {
      copySessionBtn.classList.remove('hidden');
      const btnSpan = copySessionBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = t('session.copy') + ` (${newCount})`;
    } else {
      copySessionBtn.classList.add('hidden');
    }

    sessionItems.scrollTop = sessionItems.scrollHeight;
  }

  /**
   * Copies all NEW entries from today's session to clipboard.
   * For vehicles: copies the plate number.
   * For persons: copies the id_number if available, otherwise full name.
   */
  async function copySessionPlates() {
    const session = getSessionData();
    const lines = (session.items || [])
      .filter(s => s.isNew)
      .map(s => s.identifier)
      .join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      const btnText = copySessionBtn.querySelector('span');
      const original = btnText.textContent;
      btnText.textContent = t('session.copied');
      copySessionBtn.classList.add('btn-success');
      copySessionBtn.classList.remove('btn-secondary');
      setTimeout(() => {
        btnText.textContent = original;
        copySessionBtn.classList.remove('btn-success');
        copySessionBtn.classList.add('btn-secondary');
      }, 2000);
    } catch {
      /* Fallback */
      const textarea = document.createElement('textarea');
      textarea.value = lines;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  /* ══════════════════════════════════════════
     UI Helpers
     ══════════════════════════════════════════ */

  /**
   * Shows the vehicle/person status badge.
   *
   * @param {boolean} isNew - true = new, false = known
   * @param {Object|null} data - vehicle or person data (null if new)
   * @param {'vehicle'|'persona'} entryType
   */
  function showStatusBadge(isNew, data, entryType) {
    vehicleStatus.innerHTML = '';
    vehicleStatus.classList.remove('hidden');

    const card = document.createElement('div');
    card.className = 'status-card ' + (isNew ? 'status-new' : 'status-known');

    const icon = document.createElement('span');
    icon.className = 'status-icon';
    icon.textContent = isNew ? '🟢' : '🔵';

    const textDiv = document.createElement('div');

    const mainText = document.createElement('div');
    mainText.className = 'status-text';

    if (entryType === 'persona') {
      mainText.textContent = isNew ? t('badge.new.person') : t('badge.known.person');
    } else {
      mainText.textContent = isNew ? t('badge.new') : t('badge.known');
    }

    textDiv.appendChild(mainText);

    if (!isNew && data) {
      const detail = document.createElement('div');
      detail.className = 'status-detail';
      const lastSeenDisplay = data.lastSeen && data.lastSeen.includes('-')
        ? data.lastSeen.split('-').reverse().join('/')
        : (data.lastSeen || '');
      detail.textContent = `${t('badge.known.lastSeen')}: ${lastSeenDisplay} — ${data.totalVisits} ${t('badge.known.totalVisits')}`;
      textDiv.appendChild(detail);

      /* History hint + click (vehicles only) */
      if (entryType === 'vehicle' && data.vehicleId) {
        const hint = document.createElement('div');
        hint.className = 'status-card-hint';
        hint.textContent = t('badge.known.clickHistory');
        textDiv.appendChild(hint);

        card.classList.add('status-card-clickable');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.addEventListener('click', () => openHistoryModal(data.vehicleId, data.placa || placaInput.value));
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ')
            openHistoryModal(data.vehicleId, data.placa || placaInput.value);
        });
      }
    } else if (isNew) {
      const detail = document.createElement('div');
      detail.className = 'status-detail';
      detail.textContent = entryType === 'persona'
        ? t('badge.new.person.subtitle')
        : t('badge.new.subtitle');
      textDiv.appendChild(detail);
    }

    card.appendChild(icon);
    card.appendChild(textDiv);
    vehicleStatus.appendChild(card);
  }

  function hideStatus() {
    vehicleStatus.classList.add('hidden');
    vehicleStatus.innerHTML = '';
  }

  function showError(message) {
    placaError.textContent = message;
    placaError.classList.remove('hidden');
    placaInput.classList.add('error');
  }

  function hideError() {
    placaError.classList.add('hidden');
    placaError.textContent = '';
    placaInput.classList.remove('error');
  }

  function showIdError(message) {
    idError.textContent = message;
    idError.classList.remove('hidden');
    idNumberInput.classList.add('error');
  }

  function hideIdError() {
    idError.classList.add('hidden');
    idError.textContent = '';
    idNumberInput.classList.remove('error');
  }

  /**
   * Shows/hides the loading spinner.
   * @param {'vehicle'|'persona'} mode
   * @param {boolean} show
   */
  function showSpinner(mode, show) {
    if (mode === 'persona') {
      idSpinner.classList.toggle('hidden', !show);
    } else {
      placaSpinner.classList.toggle('hidden', !show);
    }
  }

  /**
   * Shows a confirmation banner below the form.
   * @param {string} message
   * @param {'success-new'|'success-known'} type
   * @param {string} identifier
   */
  function showConfirmation(message, type, identifier) {
    confirmation.className = 've-confirmation ' + type;
    confirmation.textContent = `✅ ${message} — ${identifier}`;
    confirmation.classList.remove('hidden');
    setTimeout(() => confirmation.classList.add('hidden'), 5000);
  }

  /**
   * Shows a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   */
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /** Updates submit button enabled/disabled state based on current mode. */
  function updateSubmitState() {
    const hasLocation = !!selectedLocation;
    if (selectedTipo === 'persona') {
      const id = idNumberInput.value.trim();
      const isValid = CONFIG.ID_NUMBER_PATTERN.test(id) &&
        id.length >= CONFIG.ID_NUMBER_MIN_LENGTH &&
        id.length <= CONFIG.ID_NUMBER_MAX_LENGTH;
      submitBtn.disabled = !isValid || !hasLocation || submitCooldown;
    } else {
      const placa = placaInput.value.trim();
      const isValid = placa.length >= CONFIG.PLACA_MIN_LENGTH &&
        placa.length <= CONFIG.PLACA_MAX_LENGTH &&
        CONFIG.PLACA_PATTERN.test(placa);
      submitBtn.disabled = !isValid || !hasLocation || submitCooldown;
    }
  }

  /** Resets the form to empty state after a successful save. */
  function resetForm() {
    placaInput.value = '';
    firstNameInput.value = '';
    lastNameInput.value = '';
    idNumberInput.value = '';
    notesInput.value = '';
    charCount.textContent = '0';
    currentVehicle = null;
    currentPerson  = null;
    currentTodayLocations = [];
    selectedLocation = '';
    locationBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
    locationError.classList.add('hidden');
    locationWarning.classList.add('hidden');
    hideError();
    hideIdError();
    hideStatus();
    updateSubmitState();
    /* Focus the primary input for the current mode */
    if (selectedTipo === 'persona') {
      firstNameInput.focus();
    } else {
      placaInput.focus();
    }
  }

  /** Updates lang toggle active state. */
  function updateLangToggle() {
    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === getCurrentLang());
    });
  }

  /* ══════════════════════════════════════════
     Visit History Modal (vehicle only)
     ══════════════════════════════════════════ */

  let _historyAutoCloseTimer = null;
  let _historyData = [];

  /**
   * Opens the visit history modal for a vehicle.
   * @param {string} vehicleId
   * @param {string} placa
   * @returns {Promise<void>}
   */
  async function openHistoryModal(vehicleId, placa) {
    clearTimeout(_historyAutoCloseTimer);
    _historyData = [];
    veHistoryCopy.classList.add('hidden');

    veHistoryPlate.textContent = placa || '';
    veHistoryBody.innerHTML = `<p class="text-sm text-muted" style="padding:var(--space-md) 0">${t('loading')}</p>`;
    veHistoryModal.classList.remove('hidden');

    try {
      const result = await DataStore.getVehicleHistory(vehicleId);
      const history = result.history || [];

      if (history.length === 0) {
        veHistoryBody.innerHTML = `<p class="text-sm text-muted" style="padding:var(--space-md) 0">${t('empty.noEntries')}</p>`;
      } else {
        _historyData = history;
        veHistoryBody.innerHTML = '';
        history.forEach(entry => {
          const item = document.createElement('div');
          item.className = 've-history-item';

          const dateEl = document.createElement('span');
          dateEl.className = 've-history-date';
          const dateOnly = entry.date ? String(entry.date).substring(0, 10) : '';
          dateEl.textContent = dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)
            ? dateOnly.split('-').reverse().join('/')
            : (entry.date || '');

          const timeEl = document.createElement('span');
          timeEl.className = 've-history-time';
          timeEl.textContent = entry.time || '';

          item.appendChild(dateEl);
          item.appendChild(timeEl);

          if (entry.location) {
            const locEl = document.createElement('span');
            locEl.className = 've-history-location';
            locEl.textContent = locationLabel(entry.location);
            item.appendChild(locEl);
          }

          if (entry.notes) {
            const noteEl = document.createElement('span');
            noteEl.className = 've-history-note';
            noteEl.textContent = entry.notes;
            item.appendChild(noteEl);
          }

          veHistoryBody.appendChild(item);
        });
        veHistoryCopy.classList.remove('hidden');
      }

      _historyAutoCloseTimer = setTimeout(closeHistoryModal, 10000);

    } catch {
      veHistoryBody.innerHTML = `<p class="text-sm text-muted" style="padding:var(--space-md) 0">${t('msg.error.server')}</p>`;
    }
  }

  function closeHistoryModal() {
    clearTimeout(_historyAutoCloseTimer);
    veHistoryModal.classList.add('hidden');
  }

  async function copyHistoryTable() {
    if (_historyData.length === 0) return;
    const plate = veHistoryPlate.textContent || '';
    const header = `${plate}\n${'תאריך'.padEnd(12)}${'שעה'.padEnd(8)}${'מיקום'.padEnd(18)}הערה`;
    const rows = _historyData.map(e => {
      const dateOnly = e.date ? String(e.date).substring(0, 10) : '';
      const dateStr = dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)
        ? dateOnly.split('-').reverse().join('/')
        : (e.date || '');
      const locStr = e.location ? locationLabel(e.location) : '';
      return `${dateStr.padEnd(12)}${(e.time || '').padEnd(8)}${locStr.padEnd(18)}${e.notes || ''}`;
    });
    const text = [header, ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      const orig = veHistoryCopy.textContent;
      veHistoryCopy.textContent = '✓ הועתק';
      setTimeout(() => { veHistoryCopy.textContent = orig; }, 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const orig = veHistoryCopy.textContent;
      veHistoryCopy.textContent = '✓ הועתק';
      setTimeout(() => { veHistoryCopy.textContent = orig; }, 2000);
    }
  }

  /* ══════════════════════════════════════════
     Duplicate Location Check
     ══════════════════════════════════════════ */

  /**
   * Fetches today's entry locations for a known vehicle or person in the background.
   * Stores results in currentTodayLocations and re-checks the warning.
   * @param {'vehicle'|'persona'} type
   * @param {string} id - vehicleId or person_id
   */
  async function fetchTodayLocations(type, id) {
    try {
      let history;
      if (type === 'vehicle') {
        const res = await DataStore.getVehicleHistory(id);
        history = res.history || [];
      } else {
        const res = await DataStore.getPersonHistory(id);
        history = res.history || [];
      }
      const today = _todayStr();
      currentTodayLocations = history
        .filter(e => {
          const d = e.date ? String(e.date).substring(0, 10) : '';
          return d === today && e.location;
        })
        .map(e => e.location);
    } catch {
      currentTodayLocations = [];
    }
    if (selectedLocation) checkAndShowDuplicateWarning();
  }

  /**
   * Shows a warning if the selected location differs from any of today's existing entries.
   */
  function checkAndShowDuplicateWarning() {
    if (!selectedLocation || currentTodayLocations.length === 0) {
      locationWarning.classList.add('hidden');
      return;
    }
    const hasDifferent = currentTodayLocations.some(loc => loc !== selectedLocation);
    if (hasDifferent) {
      locationWarning.textContent = t('entry.location.warning');
      locationWarning.classList.remove('hidden');
    } else {
      locationWarning.classList.add('hidden');
    }
  }

  /**
   * Returns a translated display label for a location key.
   * @param {string} loc - 'central' | 'small' | 'environ'
   * @returns {string}
   */
  function locationLabel(loc) {
    const map = { central: t('entry.location.central'), small: t('entry.location.small'), environ: t('entry.location.environ') };
    return map[loc] || loc;
  }

  /* ══════════════════════════════════════════
     Online / Offline
     ══════════════════════════════════════════ */

  function setupOnlineOfflineListeners() {
    function updateOnlineStatus() {
      offlineBar.classList.toggle('active', !navigator.onLine);
    }

    window.addEventListener('online', () => {
      updateOnlineStatus();
      showToast(t('msg.online'), 'success');
      if (DataStore.getQueueSize() > 0) {
        DataStore.processQueue().then(result => {
          if (result.sent > 0) showToast(`${result.sent} ${t('msg.online')}`, 'success');
        });
      }
    });

    window.addEventListener('offline', () => {
      updateOnlineStatus();
      showToast(t('msg.offline'), 'warning');
    });

    updateOnlineStatus();
  }
});
