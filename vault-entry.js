/**
 * ParkLog — VaultEntry Logic
 * Form handling, plate lookup, submission, session tracking.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ── Login ── */
  const loginOverlay = document.getElementById('login-overlay');
  const loginBtn = document.getElementById('login-btn');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');

  const STORAGE_USER_KEY = 'parklog-ve-username';
  let currentUser = localStorage.getItem(STORAGE_USER_KEY) || '';

  const headerUserBtn = document.getElementById('header-user-btn');

  function showHeaderUser() {
    if (currentUser && headerUserBtn) {
      headerUserBtn.textContent = `👤 ${currentUser} ✕`;
      headerUserBtn.classList.remove('hidden');
    }
  }

  function handleSignOut() {
    localStorage.removeItem(STORAGE_USER_KEY);
    location.reload();
  }

  if (headerUserBtn) headerUserBtn.addEventListener('click', handleSignOut);

  if (currentUser) {
    loginOverlay.classList.add('hidden');
    showHeaderUser();
  } else {
    // Pre-fill username if previously used
    const savedUser = localStorage.getItem(STORAGE_USER_KEY + '-last');
    if (savedUser) loginUsernameInput.value = savedUser;
  }

  loginBtn.addEventListener('click', handleLogin);
  loginPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  function handleLogin() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    if (!username) {
      loginError.textContent = 'Ingresa tu nombre de usuario';
      loginError.classList.remove('hidden');
      return;
    }
    if (password !== CONFIG.VAULT_PASSWORD) {
      loginError.textContent = 'Contraseña incorrecta';
      loginError.classList.remove('hidden');
      loginPasswordInput.value = '';
      return;
    }
    currentUser = username;
    localStorage.setItem(STORAGE_USER_KEY, username);
    localStorage.setItem(STORAGE_USER_KEY + '-last', username);
    loginOverlay.classList.add('hidden');
    showHeaderUser();
  }

  /* ── DOM References ── */
  const placaInput = document.getElementById('placa-input');
  const placaError = document.getElementById('placa-error');
  const placaSpinner = document.getElementById('placa-spinner');
  const vehicleStatus = document.getElementById('vehicle-status');
  const notesInput = document.getElementById('notes-input');
  const charCount = document.getElementById('char-count');
  const submitBtn = document.getElementById('submit-btn');
  const confirmation = document.getElementById('confirmation');
  const sessionItems = document.getElementById('session-items');
  const sessionCount = document.getElementById('session-count');
  const copySessionBtn = document.getElementById('copy-session-btn');
  const langToggle = document.getElementById('lang-toggle');
  const offlineBar = document.getElementById('offline-bar');

  /* ── State ── */
  let currentVehicle = null; // { isNew, vehicle } from lookup
  let selectedTipo = CONFIG.DEFAULT_VEHICLE_TYPE;
  let lookupTimer = null;
  let lookupGeneration = 0; // incremented each lookup — stale results are discarded
  let submitCooldown = false;

  /* ── Session Storage Key (v2: all vehicles, localStorage, daily) ── */
  const SESSION_STORE_KEY = 'parklog-session-v2';

  /* ── History Modal ── */
  const veHistoryModal = document.getElementById('ve-history-modal');
  const veHistoryClose = document.getElementById('ve-history-close');
  const veHistoryDone = document.getElementById('ve-history-done');
  const veHistoryCopy = document.getElementById('ve-history-copy');
  const veHistoryPlate = document.getElementById('ve-history-plate');
  const veHistoryBody = document.getElementById('ve-history-body');

  veHistoryClose.addEventListener('click', closeHistoryModal);
  veHistoryDone.addEventListener('click', closeHistoryModal);
  veHistoryModal.addEventListener('click', e => { if (e.target === veHistoryModal) closeHistoryModal(); });
  veHistoryCopy.addEventListener('click', copyHistoryTable);

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
     Event Listeners
     ══════════════════════════════════════════ */

  /* ── Placa Input: auto-uppercase + debounced lookup ── */
  placaInput.addEventListener('input', (e) => {
    /* Auto-uppercase */
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    e.target.setSelectionRange(pos, pos);

    /* Clear previous state */
    hideError();
    hideStatus();
    currentVehicle = null;
    updateSubmitState();

    /* Debounced lookup */
    clearTimeout(lookupTimer);
    const placa = e.target.value.trim();

    if (placa.length >= CONFIG.PLACA_MIN_LENGTH) {
      lookupTimer = setTimeout(() => lookupVehicle(placa), CONFIG.LOOKUP_DEBOUNCE_MS);
    }
  });

  /* ── Placa: validate on blur ── */
  placaInput.addEventListener('blur', () => {
    const placa = placaInput.value.trim();
    if (placa.length > 0 && placa.length < CONFIG.PLACA_MIN_LENGTH) {
      showError(t('msg.error.format'));
    }
  });

  /* ── Notes: character counter ── */
  notesInput.addEventListener('input', () => {
    charCount.textContent = notesInput.value.length;
  });

  /* ── Tipo Toggle ── */
  document.querySelectorAll('.toggle-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-option').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      selectedTipo = btn.dataset.tipo;
    });
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

  /* ── Copy Session Plates ── */
  copySessionBtn.addEventListener('click', copySessionPlates);

  /* ── Keyboard: Enter to submit ── */
  placaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !submitBtn.disabled) {
      handleSubmit();
    }
  });

  /* ══════════════════════════════════════════
     Vehicle Lookup
     ══════════════════════════════════════════ */

  /**
   * Looks up a plate in the backend.
   * Shows green badge (new) or blue badge (known).
   *
   * @param {string} placa - Normalized plate
   * @returns {Promise<void>}
   */
  async function lookupVehicle(placa) {
    const gen = ++lookupGeneration; // capture this lookup's generation

    if (!CONFIG.APPS_SCRIPT_URL) {
      /* Dev mode: simulate lookup */
      currentVehicle = { isNew: true, vehicle: null };
      showStatusBadge(true, null);
      updateSubmitState();
      return;
    }

    showSpinner(true);

    try {
      const result = await DataStore.searchVehicle(placa);
      if (gen !== lookupGeneration) return; // a newer lookup is in flight — discard
      currentVehicle = result;
      showStatusBadge(result.isNew, result.vehicle);
    } catch (err) {
      if (gen !== lookupGeneration) return;
      /* Network failure: allow save without badge */
      currentVehicle = { isNew: null, vehicle: null };
    } finally {
      if (gen === lookupGeneration) {
        showSpinner(false);
        updateSubmitState();
      }
    }
  }

  /* ══════════════════════════════════════════
     Form Submission
     ══════════════════════════════════════════ */

  /**
   * Handles form submission.
   * Validates, saves, shows confirmation, updates session list.
   *
   * @returns {Promise<void>}
   */
  async function handleSubmit() {
    if (submitCooldown || submitBtn.disabled) return;

    const placa = placaInput.value.trim();

    /* Validate */
    if (!placa) {
      showError(t('msg.error.empty'));
      placaInput.focus();
      return;
    }

    if (!CONFIG.PLACA_PATTERN.test(placa) || placa.length > CONFIG.PLACA_MAX_LENGTH) {
      showError(t('msg.error.format'));
      placaInput.focus();
      return;
    }

    /* Set cooldown */
    submitCooldown = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.querySelector('span').textContent = t('entry.submitting');

    try {
      let result;

      if (!CONFIG.APPS_SCRIPT_URL) {
        /* Dev mode: simulate save */
        result = {
          success: true,
          isNew: currentVehicle?.isNew ?? true,
          vehicle: { placa, totalVisits: 1 },
          entry: { entryTime: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }
        };
      } else {
        result = await DataStore.saveEntry({
          placa,
          tipo: selectedTipo,
          notes: notesInput.value.trim(),
          createdBy: currentUser || 'anonymous',
          entryDate: _todayStr()  // client-side local date — eliminates Apps Script timezone dependency
        });
      }

      /* Show confirmation */
      if (result.queued) {
        showToast(t('msg.queued'), 'warning');
      } else if (result.isNew) {
        showConfirmation(t('msg.saved.new'), 'success-new', placa);
        addToSession(placa, true);
      } else {
        const msg = t('msg.saved.known', { count: result.vehicle?.totalVisits || '?' });
        showConfirmation(msg, 'success-known', placa);
        addToSession(placa, false);
      }

      /* Reset form */
      resetForm();

    } catch (err) {
      showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
      /* Release cooldown immediately on error so user can retry */
      submitCooldown = false;
      submitBtn.classList.remove('loading');
      submitBtn.querySelector('span').textContent = t('entry.submit');
      updateSubmitState();
      lucide.createIcons();
      return;
    }
    /* Cooldown timer only after successful save */
    setTimeout(() => {
      submitCooldown = false;
      submitBtn.classList.remove('loading');
      submitBtn.querySelector('span').textContent = t('entry.submit');
      updateSubmitState();
      lucide.createIcons();
    }, CONFIG.SUBMIT_COOLDOWN_MS);
  }

  /* ══════════════════════════════════════════
     Session List (All Vehicles — daily, per user)
     ══════════════════════════════════════════ */

  function _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /**
   * Adds a vehicle to the session list (new or known).
   * @param {string} placa
   * @param {boolean} isNew
   */
  function addToSession(placa, isNew) {
    const session = getSessionData();
    session.items.push({
      placa,
      isNew,
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
      const today = _todayStr();
      if (stored && stored.date === today && stored.user === currentUser) {
        return stored;
      }
    } catch { /* fall through */ }
    return { date: _todayStr(), user: currentUser, items: [] };
  }

  function saveSessionData(session) {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(session));
  }

  /** Loads and renders the session list on page load. */
  function loadSessionList() {
    const session = getSessionData();
    renderSessionList(session);
  }

  /**
   * Renders the session list DOM.
   * @param {{ items: Array<{ placa: string, time: string, isNew: boolean }> }} session
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

      const plateSpan = document.createElement('span');
      plateSpan.className = 'plate';
      plateSpan.textContent = item.placa;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'time';
      timeSpan.textContent = item.time;

      el.appendChild(badge);
      el.appendChild(plateSpan);
      el.appendChild(timeSpan);
      sessionItems.appendChild(el);
    });

    const newCount = items.filter(i => i.isNew).length;
    sessionCount.textContent = items.length;
    sessionCount.classList.remove('hidden');

    /* Show copy button only if there are new vehicles */
    if (newCount > 0) {
      copySessionBtn.classList.remove('hidden');
      const btnSpan = copySessionBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = t('session.copy') + ` (${newCount})`;
    } else {
      copySessionBtn.classList.add('hidden');
    }

    /* Scroll to bottom */
    sessionItems.scrollTop = sessionItems.scrollHeight;
  }

  /** Copies only NEW vehicles from today's session to clipboard. */
  async function copySessionPlates() {
    const session = getSessionData();
    const plates = (session.items || []).filter(s => s.isNew).map(s => s.placa).join('\n');

    try {
      await navigator.clipboard.writeText(plates);
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
      /* Fallback: textarea copy */
      const textarea = document.createElement('textarea');
      textarea.value = plates;
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
   * Shows the vehicle status badge (new=green, known=blue).
   * @param {boolean} isNew
   * @param {Object|null} vehicle
   */
  function showStatusBadge(isNew, vehicle) {
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
    mainText.textContent = isNew ? t('badge.new') : t('badge.known');

    textDiv.appendChild(mainText);

    if (!isNew && vehicle) {
      const detail = document.createElement('div');
      detail.className = 'status-detail';
      /* Convert YYYY-MM-DD from backend to DD/MM/YYYY for display */
      const lastSeenDisplay = vehicle.lastSeen && vehicle.lastSeen.includes('-')
        ? vehicle.lastSeen.split('-').reverse().join('/')
        : vehicle.lastSeen;
      detail.textContent = `${t('badge.known.lastSeen')}: ${lastSeenDisplay} — ${vehicle.totalVisits} ${t('badge.known.totalVisits')}`;
      textDiv.appendChild(detail);

      /* Hint: click to see history */
      const hint = document.createElement('div');
      hint.className = 'status-card-hint';
      hint.textContent = t('badge.known.clickHistory');
      textDiv.appendChild(hint);

      /* Make card clickable */
      card.classList.add('status-card-clickable');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.addEventListener('click', () => openHistoryModal(vehicle.vehicleId, vehicle.placa || placaInput.value));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openHistoryModal(vehicle.vehicleId, vehicle.placa || placaInput.value); });
    } else if (isNew) {
      const detail = document.createElement('div');
      detail.className = 'status-detail';
      detail.textContent = t('badge.new.subtitle');
      textDiv.appendChild(detail);
    }

    card.appendChild(icon);
    card.appendChild(textDiv);
    vehicleStatus.appendChild(card);
  }

  /** Hides the vehicle status badge. */
  function hideStatus() {
    vehicleStatus.classList.add('hidden');
    vehicleStatus.innerHTML = '';
  }

  /**
   * Shows an inline error below the placa field.
   * @param {string} message
   */
  function showError(message) {
    placaError.textContent = message;
    placaError.classList.remove('hidden');
    placaInput.classList.add('error');
  }

  /** Hides the placa error. */
  function hideError() {
    placaError.classList.add('hidden');
    placaError.textContent = '';
    placaInput.classList.remove('error');
  }

  /**
   * Shows/hides the loading spinner on placa input.
   * @param {boolean} show
   */
  function showSpinner(show) {
    placaSpinner.classList.toggle('hidden', !show);
  }

  /**
   * Shows a confirmation banner below the form.
   * @param {string} message
   * @param {'success-new'|'success-known'} type
   * @param {string} placa
   */
  function showConfirmation(message, type, placa) {
    confirmation.className = 've-confirmation ' + type;
    confirmation.textContent = `✅ ${message} — ${placa}`;
    confirmation.classList.remove('hidden');

    setTimeout(() => {
      confirmation.classList.add('hidden');
    }, 5000);
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

  /** Updates the submit button enabled/disabled state. */
  function updateSubmitState() {
    const placa = placaInput.value.trim();
    const isValid = placa.length >= CONFIG.PLACA_MIN_LENGTH && placa.length <= CONFIG.PLACA_MAX_LENGTH && CONFIG.PLACA_PATTERN.test(placa);
    submitBtn.disabled = !isValid || submitCooldown;
  }

  /** Resets the form to empty state. */
  function resetForm() {
    placaInput.value = '';
    notesInput.value = '';
    charCount.textContent = '0';
    currentVehicle = null;
    hideError();
    hideStatus();
    updateSubmitState();
    placaInput.focus();
  }

  /* ══════════════════════════════════════════
     Visit History Modal
     ══════════════════════════════════════════ */

  let _historyAutoCloseTimer = null;
  let _historyData = []; // for copy-to-clipboard

  async function openHistoryModal(vehicleId, placa) {
    /* Clear any previous auto-close timer */
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
          const dateParts = dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)
            ? dateOnly.split('-').reverse().join('/')
            : (entry.date || '');
          dateEl.textContent = dateParts;

          const timeEl = document.createElement('span');
          timeEl.className = 've-history-time';
          timeEl.textContent = entry.time || '';

          const noteEl = document.createElement('span');
          noteEl.className = 've-history-note';
          noteEl.textContent = entry.notes || '';

          item.appendChild(dateEl);
          item.appendChild(timeEl);
          item.appendChild(noteEl);
          veHistoryBody.appendChild(item);
        });
        veHistoryCopy.classList.remove('hidden');
      }

      /* Auto-close 10 seconds AFTER data is shown (not from when loading started) */
      _historyAutoCloseTimer = setTimeout(closeHistoryModal, 10000);

    } catch (err) {
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
    const header = `${plate}\n${'תאריך'.padEnd(12)}${'שעה'.padEnd(8)}הערה`;
    const rows = _historyData.map(e => {
      const dateOnly = e.date ? String(e.date).substring(0, 10) : '';
      const dateStr = dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)
        ? dateOnly.split('-').reverse().join('/')
        : (e.date || '');
      return `${dateStr.padEnd(12)}${(e.time || '').padEnd(8)}${e.notes || ''}`;
    });
    const text = [header, ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      const orig = veHistoryCopy.textContent;
      veHistoryCopy.textContent = '✓ הועתק';
      setTimeout(() => { veHistoryCopy.textContent = orig; }, 2000);
    } catch {
      /* fallback for older browsers */
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
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
     Online/Offline
     ══════════════════════════════════════════ */

  /** Sets up network status listeners. */
  function setupOnlineOfflineListeners() {
    function updateOnlineStatus() {
      offlineBar.classList.toggle('active', !navigator.onLine);
    }

    window.addEventListener('online', () => {
      updateOnlineStatus();
      showToast(t('msg.online'), 'success');

      /* Process queued entries */
      if (DataStore.getQueueSize() > 0) {
        DataStore.processQueue().then(result => {
          if (result.sent > 0) {
            showToast(`${result.sent} ${t('msg.online')}`, 'success');
          }
        });
      }
    });

    window.addEventListener('offline', () => {
      updateOnlineStatus();
      showToast(t('msg.offline'), 'warning');
    });

    updateOnlineStatus();
  }

  /** Updates lang toggle active state. */
  function updateLangToggle() {
    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === getCurrentLang());
    });
  }
});
