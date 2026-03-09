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

  if (currentUser) {
    loginOverlay.classList.add('hidden');
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

  /* ── Session Storage Key ── */
  const SESSION_KEY = 'parklog-session-new-vehicles';

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
          createdBy: currentUser || 'anonymous'
        });
      }

      /* Show confirmation */
      if (result.queued) {
        showToast(t('msg.queued'), 'warning');
      } else if (result.isNew) {
        showConfirmation(t('msg.saved.new'), 'success-new', placa);
        addToSession(placa);
      } else {
        const msg = t('msg.saved.known', { count: result.vehicle?.totalVisits || '?' });
        showConfirmation(msg, 'success-known', placa);
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
     Session List (New Vehicles)
     ══════════════════════════════════════════ */

  /**
   * Adds a new vehicle to the session list.
   * @param {string} placa - Plate number
   */
  function addToSession(placa) {
    const session = getSessionData();
    session.push({
      placa,
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    renderSessionList(session);
  }

  /**
   * Gets current session data from sessionStorage.
   * @returns {Array<{ placa: string, time: string }>}
   */
  function getSessionData() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || [];
    } catch {
      return [];
    }
  }

  /** Loads and renders the session list on page load. */
  function loadSessionList() {
    const session = getSessionData();
    if (session.length > 0) {
      renderSessionList(session);
    }
  }

  /**
   * Renders the session list DOM.
   * @param {Array<{ placa: string, time: string }>} session
   */
  function renderSessionList(session) {
    if (session.length === 0) {
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
    session.forEach(item => {
      const el = document.createElement('div');
      el.className = 'session-item';

      const plateSpan = document.createElement('span');
      plateSpan.className = 'plate';
      plateSpan.textContent = item.placa;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'time';
      timeSpan.textContent = item.time;

      el.appendChild(plateSpan);
      el.appendChild(timeSpan);
      sessionItems.appendChild(el);
    });

    /* Update count badge */
    sessionCount.textContent = session.length;
    sessionCount.classList.remove('hidden');
    copySessionBtn.classList.remove('hidden');

    /* Scroll to bottom */
    sessionItems.scrollTop = sessionItems.scrollHeight;
  }

  /** Copies all session plates to clipboard. */
  async function copySessionPlates() {
    const session = getSessionData();
    const plates = session.map(s => s.placa).join('\n');

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
