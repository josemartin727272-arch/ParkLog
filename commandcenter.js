/**
 * ParkLog — CommandCenter Logic
 * Dashboard: KPIs, charts, sortable/filterable table,
 * 4 export types (CSV + clipboard), note editing, vehicle history,
 * persona records, settings panel (admin only).
 * v2.0: auth.js-based login, persona type, settings tab.
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
  const offlineBar    = document.getElementById('offline-bar');
  const refreshBtn    = document.getElementById('refresh-btn');
  const lastUpdatedEl = document.getElementById('last-updated');

  /* KPIs */
  const kpiEntriesToday  = document.getElementById('kpi-entries-today');
  const kpiNewToday      = document.getElementById('kpi-new-today');
  const kpiTotalVehicles = document.getElementById('kpi-total-vehicles');
  const kpiTotalPersons  = document.getElementById('kpi-total-persons');
  const kpiWeeklyEntries = document.getElementById('kpi-weekly-entries');

  /* Filters */
  const filterSearch    = document.getElementById('filter-search');
  const filterTipo      = document.getElementById('filter-tipo');
  const filterStatus    = document.getElementById('filter-status');
  const filterDateFrom  = document.getElementById('filter-date-from');
  const filterDateTo    = document.getElementById('filter-date-to');
  const columnsToggleBtn  = document.getElementById('columns-toggle-btn');
  const columnsDropdown   = document.getElementById('columns-dropdown');
  const clearFiltersBtn   = document.getElementById('clear-filters-btn');

  /* Exports */
  const exportSubmenu      = document.getElementById('export-submenu');
  const exportCsvBtn       = document.getElementById('export-csv');
  const exportClipboardBtn = document.getElementById('export-clipboard');

  /* Table */
  const tableHeader    = document.getElementById('table-header');
  const tableBody      = document.getElementById('table-body');
  const tableEmpty     = document.getElementById('table-empty');
  const tableNoResults = document.getElementById('table-no-results');
  const tableWrapper   = document.getElementById('table-wrapper');

  /* Notes Modal */
  const notesModal       = document.getElementById('notes-modal');
  const notesModalClose  = document.getElementById('notes-modal-close');
  const notesModalPlaca  = document.getElementById('notes-modal-placa');
  const notesModalDate   = document.getElementById('notes-modal-date');
  const notesModalInput  = document.getElementById('notes-modal-input');
  const notesModalCount  = document.getElementById('notes-modal-count');
  const notesModalCancel = document.getElementById('notes-modal-cancel');
  const notesModalSave   = document.getElementById('notes-modal-save');
  const notesModalDelete = document.getElementById('notes-modal-delete');

  /* History Modal */
  const historyModal      = document.getElementById('history-modal');
  const historyModalClose = document.getElementById('history-modal-close');
  const historyPlate      = document.getElementById('history-plate');
  const historyList       = document.getElementById('history-list');
  const historyModalDone  = document.getElementById('history-modal-done');

  /* KPI List Modal */
  const kpiListModal       = document.getElementById('kpi-list-modal');
  const kpiListModalTitle  = document.getElementById('kpi-list-modal-title');
  const kpiListModalClose  = document.getElementById('kpi-list-modal-close');
  const kpiListContent     = document.getElementById('kpi-list-content');
  const kpiListEmpty       = document.getElementById('kpi-list-empty');
  const kpiListCopy        = document.getElementById('kpi-list-copy');
  const kpiListDone        = document.getElementById('kpi-list-done');
  const kpiCardEntries     = document.getElementById('kpi-card-entries');
  const kpiCardNew         = document.getElementById('kpi-card-new');

  /* Login */
  const loginOverlay = document.getElementById('login-overlay');
  const loginBtn     = document.getElementById('login-btn');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginError   = document.getElementById('login-error');

  const headerUserBtn = document.getElementById('header-user-btn');

  /* ── State ── */
  let allVehicles      = [];
  let allPersons       = [];
  let allRecords       = []; // merged for table display
  let filteredRecords  = [];
  let sortConfig       = { column: 'lastSeen', direction: 'desc' };
  let activeExportType = null;
  let editingRecord    = null; // { id, placa, type: 'vehicle'|'person' }
  let lastFocusedElement = null;
  let weeklyChart      = null;
  let ratioChart       = null;
  let searchTimer      = null;

  /* ── Column Definition ── */
  const COLUMNS = [
    { id: 'num',         i18nKey: 'table.num',         sortable: false,  toggleable: false, defaultVisible: true },
    { id: 'tipo',        i18nKey: 'table.tipo',        sortable: true,   toggleable: true,  defaultVisible: true },
    { id: 'placa',       i18nKey: 'table.placa',       sortable: true,   toggleable: false, defaultVisible: true },
    { id: 'firstSeen',   i18nKey: 'table.firstSeen',   sortable: true,   toggleable: true,  defaultVisible: true },
    { id: 'lastSeen',    i18nKey: 'table.lastSeen',    sortable: true,   toggleable: true,  defaultVisible: true },
    { id: 'totalVisits', i18nKey: 'table.totalVisits', sortable: true,   toggleable: true,  defaultVisible: true },
    { id: 'status',      i18nKey: 'table.status',      sortable: true,   toggleable: true,  defaultVisible: true },
    { id: 'createdBy',   i18nKey: 'table.createdBy',   sortable: true,   toggleable: true,  defaultVisible: true },
    { id: 'notes',       i18nKey: 'table.notes',       sortable: false,  toggleable: true,  defaultVisible: true },
    { id: 'actions',     i18nKey: 'table.actions',     sortable: false,  toggleable: false, defaultVisible: true }
  ];

  let visibleColumns = new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.id));

  /* ══════════════════════════════════════════
     Auth — Login / Session
     ══════════════════════════════════════════ */

  function showHeaderUser(displayName) {
    if (displayName && headerUserBtn) {
      headerUserBtn.textContent = `👤 ${displayName} ✕`;
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
    loginOverlay.classList.add('hidden');
    showHeaderUser(existingSession.display_name);
    init();
  } else {
    loginBtn.addEventListener('click', handleCCLogin);
    loginPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleCCLogin(); });
  }

  /**
   * Authenticates via Apps Script then stores session in Auth.
   * @returns {Promise<void>}
   */
  async function handleCCLogin() {
    const displayName = loginUsernameInput.value.trim();
    const password    = loginPasswordInput.value;

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
        loginPasswordInput.value = '';
        return;
      }

      Auth.setSession(result);
      loginOverlay.classList.add('hidden');
      showHeaderUser(result.display_name);
      init();

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

  function init() {
    applyTranslations();
    lucide.createIcons();
    setupEventListeners();
    renderColumnToggle();
    initSettings();
    loadData();
    setupOnlineOffline();
  }

  /* ══════════════════════════════════════════
     Event Listeners
     ══════════════════════════════════════════ */

  function setupEventListeners() {
    /* Language toggle */
    updateLangToggle();
    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.lang !== getCurrentLang()) {
          toggleLang();
          updateLangToggle();
          lucide.createIcons();
          renderTable();
          updateChartLabels();
        }
      });
    });

    /* Refresh */
    refreshBtn.addEventListener('click', () => {
      DataStore.clearCache();
      loadData();
    });

    /* Search (debounced) */
    filterSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 200);
    });

    /* Dropdown filters (instant) */
    filterTipo.addEventListener('change', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
    filterDateFrom.addEventListener('change', applyFilters);
    filterDateTo.addEventListener('change', applyFilters);

    /* Clear filters */
    clearFiltersBtn.addEventListener('click', clearFilters);

    /* Column toggle */
    columnsToggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      columnsDropdown.classList.toggle('hidden');
    });

    /* Close dropdowns on outside click */
    document.addEventListener('click', e => {
      if (!columnsDropdown.contains(e.target) && e.target !== columnsToggleBtn) {
        columnsDropdown.classList.add('hidden');
      }
      if (!e.target.closest('.cc-exports')) closeExportSubmenu();
    });

    /* Sticky New Today button */
    document.getElementById('sticky-new-today-btn').addEventListener('click', () => {
      handleExportClick('newToday');
    });

    /* Export buttons */
    document.querySelectorAll('.cc-export-btn').forEach(btn => {
      btn.addEventListener('click', () => handleExportClick(btn.dataset.export));
    });
    exportCsvBtn.addEventListener('click', () => doExport('csv'));
    exportClipboardBtn.addEventListener('click', () => doExport('clipboard'));

    /* Notes Modal */
    notesModalClose.addEventListener('click', closeNotesModal);
    notesModalCancel.addEventListener('click', closeNotesModal);
    notesModalSave.addEventListener('click', saveNotes);
    notesModalDelete.addEventListener('click', deleteNotes);
    notesModalInput.addEventListener('input', () => {
      notesModalCount.textContent = notesModalInput.value.length;
    });
    notesModal.addEventListener('click', e => { if (e.target === notesModal) closeNotesModal(); });

    /* History Modal */
    historyModalClose.addEventListener('click', closeHistoryModal);
    historyModalDone.addEventListener('click', closeHistoryModal);
    historyModal.addEventListener('click', e => { if (e.target === historyModal) closeHistoryModal(); });

    /* KPI List Modal */
    kpiCardEntries.addEventListener('click', () => openKpiListModal('entries'));
    kpiCardNew.addEventListener('click', () => openKpiListModal('new'));
    kpiListModalClose.addEventListener('click', closeKpiListModal);
    kpiListDone.addEventListener('click', closeKpiListModal);
    kpiListCopy.addEventListener('click', copyKpiListPlates);
    kpiListModal.addEventListener('click', e => { if (e.target === kpiListModal) closeKpiListModal(); });

    /* Settings panel */
    const addUserBtn    = document.getElementById('add-user-btn');
    const addUserForm   = document.getElementById('add-user-form');
    const addUserSubmit = document.getElementById('add-user-submit');
    const addUserCancel = document.getElementById('add-user-cancel');
    const newUserName   = document.getElementById('new-user-name');

    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => {
        addUserForm.classList.toggle('hidden');
        if (!addUserForm.classList.contains('hidden')) newUserName.focus();
      });
    }
    if (addUserCancel) {
      addUserCancel.addEventListener('click', () => {
        addUserForm.classList.add('hidden');
        newUserName.value = '';
      });
    }
    if (addUserSubmit) addUserSubmit.addEventListener('click', handleCreateUser);

    /* New Password Modal */
    const newPasswordClose = document.getElementById('new-password-close');
    const newPasswordDone  = document.getElementById('new-password-done');
    const newPasswordCopy  = document.getElementById('new-password-copy');

    if (newPasswordClose) newPasswordClose.addEventListener('click', closeNewPasswordModal);
    if (newPasswordDone)  newPasswordDone.addEventListener('click', closeNewPasswordModal);
    if (newPasswordCopy)  newPasswordCopy.addEventListener('click', async () => {
      const val = document.getElementById('new-password-value');
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val.textContent);
        showToast(t('export.copied'), 'success');
      } catch { /* no-op */ }
    });
    const newPasswordModal = document.getElementById('new-password-modal');
    if (newPasswordModal) newPasswordModal.addEventListener('click', e => {
      if (e.target === newPasswordModal) closeNewPasswordModal();
    });

    /* Keyboard: Escape closes all modals */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeNotesModal();
        closeHistoryModal();
        closeKpiListModal();
        closeNewPasswordModal();
        columnsDropdown.classList.add('hidden');
      }
    });
  }

  /* ══════════════════════════════════════════
     Data Loading
     ══════════════════════════════════════════ */

  /**
   * Loads all dashboard data: KPIs, charts, vehicles, persons.
   * @returns {Promise<void>}
   */
  async function loadData() {
    refreshBtn.classList.add('spinning');

    try {
      if (!CONFIG.APPS_SCRIPT_URL) {
        const mock = generateMockData();
        renderKPIs(mock.kpis);
        initCharts(mock);
        allVehicles = mock.vehicles;
        allPersons  = [];
        buildAllRecords();
        applyFilters();
      } else {
        let dashboard;
        try {
          dashboard = await DataStore.getDashboardData();
          renderKPIs(dashboard.kpis);
          initCharts(dashboard);
        } catch {
          renderKPIsError();
          showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
        }

        /* Load vehicles and persons in parallel */
        const [vehicleResult, personResult] = await Promise.allSettled([
          DataStore.getVehicles(),
          DataStore.getPersons()
        ]);

        allVehicles = vehicleResult.status === 'fulfilled' ? (vehicleResult.value.vehicles || []) : [];
        allPersons  = personResult.status  === 'fulfilled' ? (personResult.value.persons   || []) : [];

        buildAllRecords();
        applyFilters();
      }

      lastUpdatedEl.textContent = new Date().toLocaleTimeString('es', {
        hour: '2-digit', minute: '2-digit'
      });

    } catch {
      showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
    } finally {
      refreshBtn.classList.remove('spinning');
    }
  }

  /**
   * Merges vehicles and persons into a unified allRecords array.
   * Person records are mapped to have the same shape as vehicle records.
   */
  function buildAllRecords() {
    const personRecords = allPersons.map(p => ({
      record_type:   'persona',
      vehicle_id:    p.person_id,   // reuse field name for history/notes actions
      placa:         `${p.first_name} ${p.last_name}`,
      id_number:     p.id_number,
      tipo:          'persona',
      first_seen:    p.first_seen,
      last_seen:     p.last_seen,
      total_visits:  p.total_visits,
      notes:         p.notes || '',
      notes_updated: p.notes_updated || '',
      created_by:    p.created_by || 'anonymous'
    }));

    allRecords = [
      ...allVehicles.map(v => ({ ...v, record_type: 'vehicle' })),
      ...personRecords
    ];
  }

  /* ══════════════════════════════════════════
     KPI Rendering
     ══════════════════════════════════════════ */

  /**
   * Updates KPI card values.
   * @param {{ entriesToday: number, newToday: number, totalVehicles: number, totalPersons: number, weeklyEntries: number }} kpis
   */
  function renderKPIs(kpis) {
    kpiEntriesToday.textContent  = kpis.entriesToday  ?? '--';
    kpiNewToday.textContent      = kpis.newToday      ?? '--';
    kpiTotalVehicles.textContent = kpis.totalVehicles ?? '--';
    kpiTotalPersons.textContent  = kpis.totalPersons  ?? '--';
    kpiWeeklyEntries.textContent = kpis.weeklyEntries ?? '--';
  }

  function renderKPIsError() {
    kpiEntriesToday.textContent  = '--';
    kpiNewToday.textContent      = '--';
    kpiTotalVehicles.textContent = '--';
    kpiTotalPersons.textContent  = '--';
    kpiWeeklyEntries.textContent = '--';
  }

  /* ══════════════════════════════════════════
     Chart.js Charts
     ══════════════════════════════════════════ */

  /**
   * Initializes or updates both Chart.js charts.
   * @param {{ weeklyData: Array, newVsKnown: { new: number, known: number } }} data
   */
  function initCharts(data) {
    initWeeklyChart(data.weeklyData);
    initRatioChart(data.newVsKnown);
  }

  /**
   * Weekly bar chart.
   * @param {Array<{ weekStart: string, count: number }>} weeklyData
   */
  function initWeeklyChart(weeklyData) {
    const ctx    = document.getElementById('chart-weekly').getContext('2d');
    const labels = weeklyData.map(w => {
      if (w.weekStart && w.weekStart.includes('-')) {
        const parts = w.weekStart.split('-');
        return `${parts[2]}/${parts[1]}`;
      }
      return w.weekStart || '';
    });
    const values = weeklyData.map(w => w.count);

    if (weeklyChart) {
      weeklyChart.data.labels = labels;
      weeklyChart.data.datasets[0].data = values;
      weeklyChart.update();
      return;
    }

    weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: t('chart.weeklyLoad'),
          data: values,
          backgroundColor: '#6366F1',
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1E293B',
            titleFont: { family: 'Inter' },
            bodyFont: { family: 'Inter' },
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { family: 'Inter', size: 12 }, color: '#64748B' },
            grid: { color: '#E2E8F0' }
          },
          x: {
            ticks: { font: { family: 'Inter', size: 12 }, color: '#64748B' },
            grid: { display: false }
          }
        }
      }
    });
  }

  /**
   * New vs Known doughnut chart.
   * @param {{ new: number, known: number }} ratioData
   */
  function initRatioChart(ratioData) {
    const ctx    = document.getElementById('chart-ratio').getContext('2d');
    const values = [ratioData.new, ratioData.known];
    const labels = [t('chart.new'), t('chart.known')];

    if (ratioChart) {
      ratioChart.data.labels = labels;
      ratioChart.data.datasets[0].data = values;
      ratioChart.update();
      return;
    }

    ratioChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#10B981', '#3B82F6'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { family: 'Inter', size: 13 },
              color: '#1E293B',
              usePointStyle: true,
              pointStyleWidth: 12,
              generateLabels(chart) {
                const data = chart.data;
                return data.labels.map((label, i) => ({
                  text: `${label} — ${data.datasets[0].data[i]}`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].backgroundColor[i],
                  pointStyle: 'circle',
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            backgroundColor: '#1E293B',
            titleFont: { family: 'Inter' },
            bodyFont: { family: 'Inter' },
            padding: 12,
            cornerRadius: 8
          }
        }
      }
    });
  }

  function updateChartLabels() {
    if (weeklyChart) {
      weeklyChart.data.datasets[0].label = t('chart.weeklyLoad');
      weeklyChart.update();
    }
    if (ratioChart) {
      ratioChart.data.labels = [t('chart.new'), t('chart.known')];
      ratioChart.update();
    }
  }

  /* ══════════════════════════════════════════
     Table Rendering
     ══════════════════════════════════════════ */

  function renderTable() {
    renderTableHeader();
    renderTableBody();
    lucide.createIcons();
  }

  function renderTableHeader() {
    tableHeader.innerHTML = '';
    COLUMNS.forEach(col => {
      if (!visibleColumns.has(col.id)) return;
      const th = document.createElement('th');
      th.textContent = t(col.i18nKey);
      th.dataset.column = col.id;
      if (col.id === 'placa') th.classList.add('col-fixed');
      if (col.sortable) {
        th.classList.add('th-sortable');
        const arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        if (sortConfig.column === col.id) {
          th.classList.add(sortConfig.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
          arrow.textContent = sortConfig.direction === 'asc' ? '▲' : '▼';
        } else {
          arrow.textContent = '▲';
        }
        th.appendChild(arrow);
        th.addEventListener('click', () => handleSort(col.id));
      }
      tableHeader.appendChild(th);
    });
  }

  /** Generates table body rows from filteredRecords (vehicles + persons unified). */
  function renderTableBody() {
    tableBody.innerHTML = '';
    const hasData    = allRecords.length > 0;
    const hasResults = filteredRecords.length > 0;

    tableWrapper.classList.toggle('hidden', !hasResults);
    tableEmpty.classList.toggle('hidden', hasData);
    tableNoResults.classList.toggle('hidden', !hasData || hasResults);

    if (!hasResults) return;

    const todayStr = formatDateYMD(new Date());

    filteredRecords.forEach((record, index) => {
      const tr    = document.createElement('tr');
      const isNew = record.first_seen === todayStr && record.total_visits <= 1;

      COLUMNS.forEach(col => {
        if (!visibleColumns.has(col.id)) return;
        const td    = document.createElement('td');
        const label = t(col.i18nKey);
        td.setAttribute('data-label', label);

        switch (col.id) {
          case 'num':
            td.textContent = index + 1;
            break;

          case 'tipo':
            td.className = 'cell-tipo';
            td.textContent = record.tipo === 'moto' ? '🛵' : record.tipo === 'persona' ? '🚶' : '🚗';
            break;

          case 'placa': {
            td.className = 'cell-placa col-fixed mobile-header-cell';
            const placaText = document.createElement('span');
            placaText.textContent = record.placa;
            td.appendChild(placaText);

            const mobileBadge = document.createElement('span');
            mobileBadge.className = 'badge-mobile ' + (isNew ? 'badge badge-new' : 'badge badge-known');
            mobileBadge.textContent = isNew ? ('🟢 ' + t('badge.new')) : ('🔵 ' + t('badge.known'));
            td.appendChild(mobileBadge);
            break;
          }

          case 'firstSeen':
            td.textContent = displayDate(record.first_seen);
            break;

          case 'lastSeen':
            td.textContent = displayDate(record.last_seen);
            break;

          case 'totalVisits':
            td.textContent = record.total_visits || 0;
            break;

          case 'status': {
            const badge = document.createElement('span');
            badge.className = isNew ? 'badge badge-new' : 'badge badge-known';
            badge.textContent = isNew ? ('🟢 ' + t('badge.new')) : ('🔵 ' + t('badge.known'));
            td.appendChild(badge);
            break;
          }

          case 'createdBy':
            td.textContent = record.created_by || 'anonymous';
            break;

          case 'notes':
            td.className = 'cell-notes';
            if (record.notes) {
              const noteText = document.createElement('span');
              noteText.textContent = record.notes;
              td.appendChild(noteText);
              if (record.notes_updated) {
                const noteDate = document.createElement('small');
                noteDate.className = 'note-date';
                noteDate.textContent = displayDate(record.notes_updated);
                td.appendChild(noteDate);
              }
              td.title = record.notes;
            } else {
              td.textContent = '-';
            }
            break;

          case 'actions': {
            td.className = 'cell-actions mobile-footer-cell';
            td.removeAttribute('data-label');

            /* History button — vehicles only */
            if (record.record_type === 'vehicle') {
              const histBtn = document.createElement('button');
              histBtn.title = t('history.title');
              histBtn.setAttribute('aria-label', t('history.title'));
              histBtn.innerHTML = '<i data-lucide="clock" style="width:16px;height:16px"></i>';
              histBtn.addEventListener('click', () => openHistoryModal(record.vehicle_id, record.placa));
              td.appendChild(histBtn);
            }

            /* Edit notes button */
            const noteBtn = document.createElement('button');
            noteBtn.title = t('notes.edit');
            noteBtn.setAttribute('aria-label', t('notes.edit'));
            noteBtn.innerHTML = '<i data-lucide="pencil" style="width:16px;height:16px"></i>';
            noteBtn.addEventListener('click', () => openNotesModal(record));
            td.appendChild(noteBtn);
            break;
          }
        }

        tr.appendChild(td);
      });

      tableBody.appendChild(tr);
    });
  }

  /* ══════════════════════════════════════════
     Filtering
     ══════════════════════════════════════════ */

  function applyFilters() {
    const searchTerm  = filterSearch.value.trim().toUpperCase();
    const tipoFilter  = filterTipo.value;
    const statusFilter = filterStatus.value;
    const dateFromVal  = filterDateFrom.value;
    const dateToVal    = filterDateTo.value;

    if (dateFromVal && dateToVal && dateFromVal > dateToVal) {
      showToast(t('filter.dateError'), 'warning');
    }

    const todayStr = formatDateYMD(new Date());

    filteredRecords = allRecords.filter(r => {
      /* Search — placa or id_number */
      if (searchTerm) {
        const searchTarget = r.placa.toUpperCase() + (r.id_number ? ' ' + r.id_number : '');
        if (!searchTarget.includes(searchTerm)) return false;
      }

      /* Tipo filter */
      if (tipoFilter && r.tipo !== tipoFilter) return false;

      /* Status filter */
      if (statusFilter) {
        const isNew = r.first_seen === todayStr && r.total_visits <= 1;
        if (statusFilter === 'new'   && !isNew) return false;
        if (statusFilter === 'known' && isNew)  return false;
      }

      /* Date range filter (using first_seen) */
      if (dateFromVal || dateToVal) {
        const recordDate = parseDate(r.first_seen);
        if (!recordDate) return false;
        if (dateFromVal) {
          const from = new Date(dateFromVal);
          if (recordDate < from) return false;
        }
        if (dateToVal) {
          const to = new Date(dateToVal);
          to.setHours(23, 59, 59, 999);
          if (recordDate > to) return false;
        }
      }

      return true;
    });

    sortRecords();
    renderTable();
  }

  function clearFilters() {
    filterSearch.value   = '';
    filterTipo.value     = '';
    filterStatus.value   = '';
    filterDateFrom.value = '';
    filterDateTo.value   = '';
    applyFilters();
  }

  /* ══════════════════════════════════════════
     Sorting
     ══════════════════════════════════════════ */

  function sortRecords() {
    const { column, direction } = sortConfig;
    const mult = direction === 'asc' ? 1 : -1;

    filteredRecords.sort((a, b) => {
      switch (column) {
        case 'placa':
          return mult * a.placa.localeCompare(b.placa);
        case 'tipo':
          return mult * a.tipo.localeCompare(b.tipo);
        case 'firstSeen': {
          const dA = parseDate(a.first_seen) || new Date(0);
          const dB = parseDate(b.first_seen) || new Date(0);
          return mult * (dA - dB);
        }
        case 'lastSeen': {
          const dA = parseDate(a.last_seen) || new Date(0);
          const dB = parseDate(b.last_seen) || new Date(0);
          return mult * (dA - dB);
        }
        case 'totalVisits':
          return mult * ((a.total_visits || 0) - (b.total_visits || 0));
        case 'status': {
          const todayStr = formatDateYMD(new Date());
          const aNew = a.first_seen === todayStr && a.total_visits <= 1 ? 1 : 0;
          const bNew = b.first_seen === todayStr && b.total_visits <= 1 ? 1 : 0;
          return mult * (aNew - bNew);
        }
        default:
          return 0;
      }
    });
  }

  /**
   * @param {string} columnId
   */
  function handleSort(columnId) {
    if (sortConfig.column === columnId) {
      sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortConfig.column    = columnId;
      sortConfig.direction = 'asc';
    }
    sortRecords();
    renderTable();
  }

  /* ══════════════════════════════════════════
     Column Toggle
     ══════════════════════════════════════════ */

  function renderColumnToggle() {
    columnsDropdown.innerHTML = '';
    COLUMNS.filter(c => c.toggleable).forEach(col => {
      const label    = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type    = 'checkbox';
      checkbox.checked = visibleColumns.has(col.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) visibleColumns.add(col.id);
        else visibleColumns.delete(col.id);
        renderTable();
      });
      const text = document.createElement('span');
      text.textContent = t(col.i18nKey);
      label.appendChild(checkbox);
      label.appendChild(text);
      columnsDropdown.appendChild(label);
    });
  }

  /* ══════════════════════════════════════════
     Exports
     ══════════════════════════════════════════ */

  /**
   * @param {string} type
   */
  function handleExportClick(type) {
    document.querySelectorAll('.cc-export-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.export === type);
    });
    if (activeExportType === type) { closeExportSubmenu(); return; }
    activeExportType = type;
    exportSubmenu.classList.remove('hidden');
  }

  function closeExportSubmenu() {
    activeExportType = null;
    exportSubmenu.classList.add('hidden');
    document.querySelectorAll('.cc-export-btn').forEach(btn => btn.classList.remove('active'));
  }

  /**
   * @param {'csv'|'clipboard'} format
   */
  function doExport(format) {
    const data = getExportData(activeExportType);
    if (data.length === 0) {
      showToast(t('table.noResults'), 'warning');
      closeExportSubmenu();
      return;
    }
    if (format === 'csv') {
      downloadCSV(data, `parklog-${activeExportType}-${formatDateYMD(new Date())}.csv`);
    } else {
      copyToClipboard(data);
    }
    closeExportSubmenu();
  }

  /**
   * @param {string} type
   * @returns {Array<Object>}
   */
  function getExportData(type) {
    const todayStr = formatDateYMD(new Date());
    switch (type) {
      case 'newToday':
        return allRecords.filter(r => r.first_seen === todayStr && r.total_visits <= 1);
      case 'byDate':
        return filteredRecords.slice().sort((a, b) => {
          return (parseDate(b.first_seen) || new Date(0)) - (parseDate(a.first_seen) || new Date(0));
        });
      case 'byLastSeen':
        return [...filteredRecords].sort((a, b) => {
          return (parseDate(b.last_seen) || new Date(0)) - (parseDate(a.last_seen) || new Date(0));
        });
      case 'all':
        return [...allRecords];
      default:
        return [];
    }
  }

  /**
   * @param {Array<Object>} data
   * @param {string} filename
   */
  function downloadCSV(data, filename) {
    const headers = [
      t('table.tipo'), t('table.placa'), 'ID/Cédula',
      t('table.firstSeen'), t('table.lastSeen'), t('table.totalVisits'), t('table.notes')
    ];
    const rows = data.map(r => [
      r.tipo,
      r.placa,
      r.id_number || '',
      displayDate(r.first_seen),
      displayDate(r.last_seen),
      r.total_visits,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);
    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const bom  = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${filename} ✓`, 'success');
  }

  /**
   * @param {Array<Object>} data
   */
  async function copyToClipboard(data) {
    const headers = [t('table.tipo'), t('table.placa'), 'ID/Cédula', t('table.firstSeen'), t('table.lastSeen'), t('table.totalVisits'), t('table.notes')];
    const rows = data.map(r => [
      r.tipo, r.placa, r.id_number || '', displayDate(r.first_seen), displayDate(r.last_seen), r.total_visits, r.notes || ''
    ].join('\t'));
    const text = [headers.join('\t'), ...rows].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('export.copied'), 'success');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(t('export.copied'), 'success');
    }
  }

  /* ══════════════════════════════════════════
     Modal Helpers
     ══════════════════════════════════════════ */

  /**
   * Keyboard Tab trap — keeps focus cycling inside the given modal.
   * @param {KeyboardEvent} e
   */
  function trapTabInModal(e) {
    if (e.key !== 'Tab') return;
    const modal    = e.currentTarget;
    const focusable = Array.from(modal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.closest('.hidden') && el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  /* ══════════════════════════════════════════
     Notes Modal
     ══════════════════════════════════════════ */

  /**
   * Opens the notes editing modal.
   * Works for both vehicle and persona records.
   * @param {Object} record
   */
  function openNotesModal(record) {
    lastFocusedElement = document.activeElement;
    const isPersona = record.record_type === 'persona';
    editingRecord = {
      id:    record.vehicle_id,   // person_id for personas (mapped to vehicle_id)
      placa: record.placa,
      type:  isPersona ? 'person' : 'vehicle'
    };
    notesModalPlaca.textContent = record.placa;
    notesModalInput.value       = record.notes || '';
    notesModalCount.textContent = (record.notes || '').length;

    if (record.notes_updated) {
      notesModalDate.textContent = `${t('notes.lastUpdated')}: ${displayDate(record.notes_updated)}`;
      notesModalDate.classList.remove('hidden');
    } else {
      notesModalDate.classList.add('hidden');
    }

    notesModalDelete.classList.toggle('hidden', !record.notes);
    notesModal.classList.add('active');
    notesModalInput.focus();
    notesModal.addEventListener('keydown', trapTabInModal);
  }

  function closeNotesModal() {
    notesModal.classList.remove('active');
    notesModal.removeEventListener('keydown', trapTabInModal);
    editingRecord = null;
    if (lastFocusedElement) { lastFocusedElement.focus(); lastFocusedElement = null; }
  }

  async function saveNotes() {
    if (!editingRecord) return;
    const newNotes = notesModalInput.value.trim();
    notesModalSave.disabled   = true;
    notesModalSave.textContent = '...';

    try {
      if (CONFIG.APPS_SCRIPT_URL) {
        await DataStore.updateNotes(editingRecord.type, editingRecord.id, newNotes);
      }
      /* Update local state */
      const record = allRecords.find(r => r.vehicle_id === editingRecord.id);
      if (record) {
        record.notes         = newNotes;
        record.notes_updated = newNotes ? formatDateYMD(new Date()) : '';
        /* Sync back to source arrays */
        if (record.record_type === 'vehicle') {
          const v = allVehicles.find(v => v.vehicle_id === editingRecord.id);
          if (v) { v.notes = newNotes; v.notes_updated = record.notes_updated; }
        } else {
          const p = allPersons.find(p => p.person_id === editingRecord.id);
          if (p) { p.notes = newNotes; }
        }
      }
      showToast(t('notes.saved'), 'success');
      closeNotesModal();
      renderTable();
    } catch {
      showToast(t('msg.error.server'), 'error');
    } finally {
      notesModalSave.disabled    = false;
      notesModalSave.textContent = t('notes.save');
    }
  }

  async function deleteNotes() {
    if (!editingRecord) return;
    notesModalDelete.disabled = true;
    try {
      if (CONFIG.APPS_SCRIPT_URL) {
        await DataStore.updateNotes(editingRecord.type, editingRecord.id, '');
      }
      const record = allRecords.find(r => r.vehicle_id === editingRecord.id);
      if (record) { record.notes = ''; record.notes_updated = ''; }
      showToast(t('notes.deleted'), 'success');
      closeNotesModal();
      renderTable();
    } catch {
      showToast(t('msg.error.server'), 'error');
    } finally {
      notesModalDelete.disabled = false;
    }
  }

  /* ══════════════════════════════════════════
     History Modal
     ══════════════════════════════════════════ */

  /**
   * @param {string} vehicleId
   * @param {string} placa
   * @returns {Promise<void>}
   */
  async function openHistoryModal(vehicleId, placa) {
    lastFocusedElement = document.activeElement;
    historyPlate.textContent = placa;
    setHistoryMessage('loading');
    historyModal.classList.add('active');
    historyModal.addEventListener('keydown', trapTabInModal);

    try {
      let history;
      if (!CONFIG.APPS_SCRIPT_URL) {
        history = generateMockHistory();
      } else {
        const result = await DataStore.getVehicleHistory(vehicleId);
        history = result.history || [];
      }
      renderHistory(history);
    } catch {
      setHistoryMessage('msg.error.server');
    }
  }

  /**
   * @param {string} i18nKey
   */
  function setHistoryMessage(i18nKey) {
    historyList.innerHTML = '';
    const div = document.createElement('div');
    div.className   = 'cc-history-loading';
    div.textContent = t(i18nKey);
    historyList.appendChild(div);
  }

  /**
   * @param {Array<{ date: string, time: string }>} history
   */
  function renderHistory(history) {
    historyList.innerHTML = '';
    if (history.length === 0) { setHistoryMessage('empty.noEntries'); return; }

    history.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'cc-history-item';

      const dateSpan = document.createElement('span');
      dateSpan.className   = 'history-date';
      dateSpan.textContent = displayDate(entry.date);

      const timeSpan = document.createElement('span');
      timeSpan.className   = 'history-time';
      timeSpan.textContent = entry.time;

      item.appendChild(dateSpan);
      item.appendChild(timeSpan);
      historyList.appendChild(item);
    });
  }

  function closeHistoryModal() {
    historyModal.classList.remove('active');
    historyModal.removeEventListener('keydown', trapTabInModal);
    if (lastFocusedElement) { lastFocusedElement.focus(); lastFocusedElement = null; }
  }

  /* ══════════════════════════════════════════
     KPI List Modal
     ══════════════════════════════════════════ */

  let kpiListPlates = [];

  /**
   * @param {'entries'|'new'} type
   * @returns {Promise<void>}
   */
  async function openKpiListModal(type) {
    lastFocusedElement = document.activeElement;
    const todayStr = formatDateYMD(new Date());

    kpiListModal.classList.add('active');
    kpiListModal.addEventListener('keydown', trapTabInModal);
    kpiListContent.innerHTML = `<p class="text-sm text-muted" style="padding:var(--space-md) 0">${t('loading')}</p>`;
    kpiListContent.classList.remove('hidden');
    kpiListEmpty.classList.add('hidden');
    kpiListCopy.classList.add('hidden');
    kpiListModalClose.focus();

    if (type === 'entries') {
      kpiListModalTitle.textContent = t('kpi.entriesToday.title');
      let entryCounts = {};
      try {
        const result = await DataStore.getEntries({ dateFrom: todayStr, dateTo: todayStr });
        (result.entries || []).forEach(e => {
          const p = e.placa || '';
          if (p) entryCounts[p] = (entryCounts[p] || 0) + 1;
        });
      } catch { /* fall back */ }

      const records = allRecords.filter(r => r.last_seen === todayStr);
      kpiListPlates = records.map(r => r.placa);
      kpiListContent.innerHTML = '';

      if (records.length === 0) {
        kpiListContent.classList.add('hidden');
        kpiListEmpty.classList.remove('hidden');
        kpiListEmpty.querySelector('span').textContent = t('kpi.emptyEntries');
      } else {
        kpiListContent.classList.remove('hidden');
        kpiListCopy.classList.remove('hidden');
        records.forEach(r => {
          const item  = document.createElement('div');
          item.className = 'kpi-list-item';
          const placa = document.createElement('span');
          placa.className   = 'kpi-list-placa';
          placa.textContent = r.placa;
          const tipo  = document.createElement('span');
          tipo.className   = 'kpi-list-tipo';
          tipo.textContent = r.tipo === 'moto' ? '🛵' : r.tipo === 'persona' ? '🚶' : '🚗';
          item.appendChild(placa);
          item.appendChild(tipo);
          const cnt = entryCounts[r.placa] || 0;
          if (cnt > 1) {
            const badge = document.createElement('span');
            badge.className   = 'kpi-list-badge';
            badge.textContent = `×${cnt}`;
            item.appendChild(badge);
          }
          kpiListContent.appendChild(item);
        });
      }
    } else {
      kpiListModalTitle.textContent = t('kpi.newToday.title');
      const records  = allRecords.filter(r => r.first_seen === todayStr);
      kpiListPlates  = records.map(r => r.placa);
      kpiListContent.innerHTML = '';

      if (records.length === 0) {
        kpiListContent.classList.add('hidden');
        kpiListEmpty.classList.remove('hidden');
        kpiListEmpty.querySelector('span').textContent = t('kpi.emptyNew');
      } else {
        kpiListContent.classList.remove('hidden');
        kpiListCopy.classList.remove('hidden');
        records.forEach(r => {
          const item  = document.createElement('div');
          item.className = 'kpi-list-item';
          const placa = document.createElement('span');
          placa.className   = 'kpi-list-placa';
          placa.textContent = r.placa;
          const tipo  = document.createElement('span');
          tipo.className   = 'kpi-list-tipo';
          tipo.textContent = r.tipo === 'moto' ? '🛵' : r.tipo === 'persona' ? '🚶' : '🚗';
          item.appendChild(placa);
          item.appendChild(tipo);
          kpiListContent.appendChild(item);
        });
      }
    }

    lucide.createIcons();
  }

  function closeKpiListModal() {
    kpiListModal.classList.remove('active');
    kpiListModal.removeEventListener('keydown', trapTabInModal);
    kpiListPlates = [];
    if (lastFocusedElement) { lastFocusedElement.focus(); lastFocusedElement = null; }
  }

  async function copyKpiListPlates() {
    if (kpiListPlates.length === 0) return;
    const text = kpiListPlates.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('kpi.copiedPlates'), 'success');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(t('kpi.copiedPlates'), 'success');
    }
  }

  /* ══════════════════════════════════════════
     Settings Panel (Admin Only)
     ══════════════════════════════════════════ */

  /**
   * Shows the settings section and loads users — only for admins.
   * @returns {Promise<void>}
   */
  async function initSettings() {
    if (!Auth.isAdmin()) return;
    const settingsSection = document.getElementById('settings-section');
    if (settingsSection) {
      settingsSection.classList.remove('hidden');
      await loadUsers();
    }
  }

  /** Fetches users from backend and renders the table. */
  async function loadUsers() {
    try {
      const result = await DataStore.getUsers();
      renderUsersTable(result.users || []);
    } catch (err) {
      showToast(err.message || t('msg.error.server'), 'error');
    }
  }

  /**
   * Renders the users management table.
   * @param {Array<{ user_id: string, display_name: string, role: string, is_active: boolean, created_at: string }>} users
   */
  function renderUsersTable(users) {
    const wrapper = document.getElementById('users-table-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    if (users.length === 0) {
      const empty = document.createElement('p');
      empty.className   = 'text-sm text-muted';
      empty.textContent = t('table.empty');
      wrapper.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';

    const thead     = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['settings.displayName', 'settings.role', 'settings.status', 'settings.created', 'settings.actions'].forEach(key => {
      const th = document.createElement('th');
      th.textContent = t(key);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody   = document.createElement('tbody');
    const session = Auth.getSession();

    users.forEach(user => {
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = user.display_name;
      tr.appendChild(nameTd);

      const roleTd   = document.createElement('td');
      const roleBadge = document.createElement('span');
      roleBadge.className   = user.role === 'admin' ? 'badge badge-new' : 'badge badge-known';
      roleBadge.textContent = t('settings.role.' + user.role);
      roleTd.appendChild(roleBadge);
      tr.appendChild(roleTd);

      const statusTd    = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className   = user.is_active ? 'badge badge-new' : 'badge badge-known';
      statusBadge.textContent = user.is_active ? t('settings.user.active') : t('settings.user.inactive');
      statusTd.appendChild(statusBadge);
      tr.appendChild(statusTd);

      const createdTd = document.createElement('td');
      createdTd.textContent = displayDate(user.created_at);
      tr.appendChild(createdTd);

      const actionsTd = document.createElement('td');
      actionsTd.className = 'cell-actions';

      /* Toggle active (can't deactivate self) */
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn btn-sm btn-ghost';
      toggleBtn.setAttribute('aria-label', t('settings.toggleActive'));
      toggleBtn.title = t('settings.toggleActive');
      toggleBtn.innerHTML = `<i data-lucide="${user.is_active ? 'user-minus' : 'user-check'}" style="width:16px;height:16px"></i>`;
      if (session && user.user_id === session.user_id) {
        toggleBtn.disabled = true;
        toggleBtn.title    = t('settings.cantDeactivateSelf');
      } else {
        toggleBtn.addEventListener('click', () => handleToggleUser(user.user_id));
      }
      actionsTd.appendChild(toggleBtn);

      /* Reset password */
      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-sm btn-ghost';
      resetBtn.setAttribute('aria-label', t('settings.resetPassword'));
      resetBtn.title = t('settings.resetPassword');
      resetBtn.innerHTML = '<i data-lucide="key" style="width:16px;height:16px"></i>';
      resetBtn.addEventListener('click', () => handleResetPassword(user.user_id, user.display_name));
      actionsTd.appendChild(resetBtn);

      /* Delete user (can't delete self) */
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-ghost';
      deleteBtn.style.color = 'var(--color-danger)';
      deleteBtn.setAttribute('aria-label', t('settings.deleteUser'));
      deleteBtn.title = t('settings.deleteUser');
      deleteBtn.innerHTML = '<i data-lucide="trash-2" style="width:16px;height:16px"></i>';
      if (session && user.user_id === session.user_id) {
        deleteBtn.disabled = true;
        deleteBtn.title    = t('settings.cantDeleteSelf');
      } else {
        deleteBtn.addEventListener('click', () => handleDeleteUser(user.user_id, user.display_name));
      }
      actionsTd.appendChild(deleteBtn);

      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    lucide.createIcons();
  }

  /**
   * @param {string} userId
   */
  async function handleToggleUser(userId) {
    try {
      const result = await DataStore.toggleUser(userId);
      showToast(result.is_active ? t('settings.user.active') : t('settings.user.inactive'), 'success');
      await loadUsers();
    } catch (err) {
      showToast(err.message || t('msg.error.server'), 'error');
    }
  }

  /**
   * @param {string} userId
   * @param {string} displayName
   */
  async function handleResetPassword(userId, displayName) {
    try {
      const result = await DataStore.resetPassword(userId);
      showNewPasswordModal(displayName, result.plaintext_password);
    } catch (err) {
      showToast(err.message || t('msg.error.server'), 'error');
    }
  }

  /**
   * @param {string} userId
   * @param {string} displayName
   */
  async function handleDeleteUser(userId, displayName) {
    const msg = t('settings.deleteUser.confirm').replace('{name}', displayName);
    if (!confirm(msg)) return;
    try {
      await DataStore.deleteUser(userId);
      showToast(t('settings.deleteUser.success'), 'success');
      await loadUsers();
    } catch (err) {
      showToast(err.message || t('msg.error.server'), 'error');
    }
  }

  async function handleCreateUser() {
    const newUserName   = document.getElementById('new-user-name');
    const newUserRole   = document.getElementById('new-user-role');
    const addUserSubmit = document.getElementById('add-user-submit');
    const addUserForm   = document.getElementById('add-user-form');

    const displayName = newUserName.value.trim();
    if (!displayName) { showToast(t('login.error.user'), 'warning'); newUserName.focus(); return; }

    addUserSubmit.disabled = true;
    try {
      const result = await DataStore.createUser(displayName, newUserRole.value);
      if (result.success) {
        showNewPasswordModal(displayName, result.plaintext_password);
        newUserName.value = '';
        addUserForm.classList.add('hidden');
        await loadUsers();
      }
    } catch (err) {
      showToast(err.message || t('msg.error.server'), 'error');
    } finally {
      addUserSubmit.disabled = false;
    }
  }

  /**
   * Shows the one-time new password modal.
   * @param {string} displayName
   * @param {string} password
   */
  function showNewPasswordModal(displayName, password) {
    const modal    = document.getElementById('new-password-modal');
    const valueEl  = document.getElementById('new-password-value');
    const titleEl  = document.getElementById('new-password-title');
    if (!modal || !valueEl) return;

    titleEl.textContent = `${t('settings.newPasswordTitle')} — ${displayName}`;
    valueEl.textContent = password;
    modal.classList.add('active');
    modal.addEventListener('keydown', trapTabInModal);
    lastFocusedElement = document.activeElement;
    document.getElementById('new-password-done').focus();
  }

  function closeNewPasswordModal() {
    const modal = document.getElementById('new-password-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.removeEventListener('keydown', trapTabInModal);
    if (lastFocusedElement) { lastFocusedElement.focus(); lastFocusedElement = null; }
  }

  /* ══════════════════════════════════════════
     UI Helpers
     ══════════════════════════════════════════ */

  function updateLangToggle() {
    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === getCurrentLang());
    });
  }

  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   */
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast     = document.createElement('div');
    toast.className   = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /* ══════════════════════════════════════════
     Date Utilities
     ══════════════════════════════════════════ */

  /**
   * @param {Date} date
   * @returns {string} YYYY-MM-DD
   */
  function formatDateYMD(date) {
    const dd   = String(date.getDate()).padStart(2, '0');
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Converts YYYY-MM-DD → DD/MM/YYYY for display.
   * @param {string} str
   * @returns {string}
   */
  function displayDate(str) {
    if (!str) return '-';
    const dateOnly = typeof str === 'string' ? str.substring(0, 10) : String(str);
    if (dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = dateOnly.split('-');
      return `${d}/${m}/${y}`;
    }
    return str;
  }

  /**
   * @param {string} str - YYYY-MM-DD or DD/MM/YYYY
   * @returns {Date|null}
   */
  function parseDate(str) {
    if (!str) return null;
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
  }

  /* ══════════════════════════════════════════
     Online / Offline
     ══════════════════════════════════════════ */

  function setupOnlineOffline() {
    function updateStatus() {
      offlineBar.classList.toggle('active', !navigator.onLine);
    }
    window.addEventListener('online', () => {
      updateStatus();
      showToast(t('msg.online'), 'success');
      DataStore.clearCache();
      loadData();
    });
    window.addEventListener('offline', () => {
      updateStatus();
      showToast(t('msg.offline'), 'warning');
    });
    updateStatus();
  }

  /* ══════════════════════════════════════════
     Dev Mode — Mock Data
     ══════════════════════════════════════════ */

  function generateMockData() {
    const today  = new Date();
    const placas = ['ABC-123','XYZ-789','DEF-456','GHI-012','JKL-345','MNO-678','PQR-901','STU-234','VWX-567','YZA-890','BCD-111','EFG-222','HIJ-333','KLM-444','NOP-555'];
    const notes  = ['Estacionamiento regular','Cliente frecuente','Vehículo grande — doble espacio','','Pago mensual',''];

    const vehicles = placas.map((placa, i) => {
      const daysAgo   = Math.floor(Math.random() * 90) + 1;
      const firstSeen = new Date(today);
      firstSeen.setDate(firstSeen.getDate() - daysAgo);
      const lastSeen = new Date(today);
      lastSeen.setDate(lastSeen.getDate() - Math.floor(Math.random() * Math.min(daysAgo, 7)));
      const note = notes[i % notes.length];
      return {
        vehicle_id:    `mock-v${i+1}`,
        placa,
        tipo:          i % 5 === 0 ? 'moto' : 'auto',
        first_seen:    formatDateYMD(firstSeen),
        last_seen:     formatDateYMD(lastSeen),
        total_visits:  Math.floor(Math.random() * 25) + 1,
        notes:         note,
        notes_updated: note ? formatDateYMD(lastSeen) : '',
        record_type:   'vehicle'
      };
    });

    for (let i = 0; i < 3; i++) {
      vehicles[i].first_seen   = formatDateYMD(today);
      vehicles[i].last_seen    = formatDateYMD(today);
      vehicles[i].total_visits = 1;
    }

    const weeklyData = [];
    for (let w = 8; w >= 0; w--) {
      const ws = new Date(today);
      ws.setDate(ws.getDate() - (w * 7));
      weeklyData.push({ weekStart: formatDateYMD(ws), count: Math.floor(Math.random() * 40) + 10 });
    }

    return {
      kpis: { entriesToday: Math.floor(Math.random()*20)+5, newToday: 3, totalVehicles: vehicles.length, totalPersons: 0, weeklyEntries: weeklyData[weeklyData.length-1].count },
      weeklyData,
      newVsKnown: { new: 3, known: vehicles.length - 3 },
      vehicles
    };
  }

  function generateMockHistory() {
    const today   = new Date();
    const entries = [];
    const n       = Math.floor(Math.random() * 8) + 2;
    for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - Math.floor(Math.random() * 60));
      entries.push({
        date: formatDateYMD(d),
        time: `${String(Math.floor(Math.random()*12)+7).padStart(2,'0')}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}`
      });
    }
    entries.sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0));
    return entries;
  }
});
