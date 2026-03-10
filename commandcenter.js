/**
 * ParkLog — CommandCenter Logic
 * Dashboard: KPIs, Chart.js charts, sortable/filterable table,
 * 4 export types (CSV + clipboard), note editing, vehicle history.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ── DOM References ── */
  const langToggle = document.getElementById('lang-toggle');
  const offlineBar = document.getElementById('offline-bar');
  const refreshBtn = document.getElementById('refresh-btn');
  const lastUpdatedEl = document.getElementById('last-updated');

  /* KPIs */
  const kpiEntriesToday = document.getElementById('kpi-entries-today');
  const kpiNewToday = document.getElementById('kpi-new-today');
  const kpiTotalVehicles = document.getElementById('kpi-total-vehicles');
  const kpiWeeklyEntries = document.getElementById('kpi-weekly-entries');

  /* Filters */
  const filterSearch = document.getElementById('filter-search');
  const filterTipo = document.getElementById('filter-tipo');
  const filterStatus = document.getElementById('filter-status');
  const filterDateFrom = document.getElementById('filter-date-from');
  const filterDateTo = document.getElementById('filter-date-to');
  const columnsToggleBtn = document.getElementById('columns-toggle-btn');
  const columnsDropdown = document.getElementById('columns-dropdown');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  /* Exports */
  const exportSubmenu = document.getElementById('export-submenu');
  const exportCsvBtn = document.getElementById('export-csv');
  const exportClipboardBtn = document.getElementById('export-clipboard');

  /* Table */
  const tableHeader = document.getElementById('table-header');
  const tableBody = document.getElementById('table-body');
  const tableEmpty = document.getElementById('table-empty');
  const tableNoResults = document.getElementById('table-no-results');
  const tableWrapper = document.getElementById('table-wrapper');

  /* Notes Modal */
  const notesModal = document.getElementById('notes-modal');
  const notesModalClose = document.getElementById('notes-modal-close');
  const notesModalPlaca = document.getElementById('notes-modal-placa');
  const notesModalDate = document.getElementById('notes-modal-date');
  const notesModalInput = document.getElementById('notes-modal-input');
  const notesModalCount = document.getElementById('notes-modal-count');
  const notesModalCancel = document.getElementById('notes-modal-cancel');
  const notesModalSave = document.getElementById('notes-modal-save');
  const notesModalDelete = document.getElementById('notes-modal-delete');

  /* History Modal */
  const historyModal = document.getElementById('history-modal');
  const historyModalClose = document.getElementById('history-modal-close');
  const historyPlate = document.getElementById('history-plate');
  const historyList = document.getElementById('history-list');
  const historyModalDone = document.getElementById('history-modal-done');

  /* KPI List Modal */
  const kpiListModal = document.getElementById('kpi-list-modal');
  const kpiListModalTitle = document.getElementById('kpi-list-modal-title');
  const kpiListModalClose = document.getElementById('kpi-list-modal-close');
  const kpiListContent = document.getElementById('kpi-list-content');
  const kpiListEmpty = document.getElementById('kpi-list-empty');
  const kpiListCopy = document.getElementById('kpi-list-copy');
  const kpiListDone = document.getElementById('kpi-list-done');
  const kpiCardEntries = document.getElementById('kpi-card-entries');
  const kpiCardNew = document.getElementById('kpi-card-new');

  /* ── Login ── */
  const loginOverlay = document.getElementById('login-overlay');
  const loginBtn = document.getElementById('login-btn');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');

  /* ── State ── */
  let allVehicles = [];
  let filteredVehicles = [];
  let sortConfig = { column: 'lastSeen', direction: 'desc' };
  let activeExportType = null;
  let editingVehicle = null; // { vehicleId, placa }
  let lastFocusedElement = null; // for returning focus after modal close
  let weeklyChart = null;
  let ratioChart = null;
  let searchTimer = null;

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

  const STORAGE_CC_USER_KEY = 'parklog-cc-username';
  let currentCCUser = localStorage.getItem(STORAGE_CC_USER_KEY) || '';

  const headerUserBtn = document.getElementById('header-user-btn');

  function showHeaderUser() {
    if (currentCCUser && headerUserBtn) {
      headerUserBtn.textContent = `👤 ${currentCCUser} ✕`;
      headerUserBtn.classList.remove('hidden');
    }
  }

  function handleSignOut() {
    localStorage.removeItem(STORAGE_CC_USER_KEY);
    location.reload();
  }

  if (headerUserBtn) headerUserBtn.addEventListener('click', handleSignOut);

  if (currentCCUser) {
    loginOverlay.classList.add('hidden');
    showHeaderUser();
    init();
  } else {
    const savedUser = localStorage.getItem(STORAGE_CC_USER_KEY + '-last');
    if (savedUser) loginUsernameInput.value = savedUser;
    loginBtn.addEventListener('click', handleCCLogin);
    loginPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleCCLogin(); });
  }

  function handleCCLogin() {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    if (!username) {
      loginError.textContent = 'Ingresa tu nombre de usuario';
      loginError.classList.remove('hidden');
      return;
    }
    if (password !== CONFIG.CC_PASSWORD) {
      loginError.textContent = 'Contraseña incorrecta';
      loginError.classList.remove('hidden');
      loginPasswordInput.value = '';
      return;
    }
    currentCCUser = username;
    localStorage.setItem(STORAGE_CC_USER_KEY, username);
    localStorage.setItem(STORAGE_CC_USER_KEY + '-last', username);
    loginOverlay.classList.add('hidden');
    showHeaderUser();
    init();
  }

  /* ══════════════════════════════════════════
     Initialization
     ══════════════════════════════════════════ */

  function init() {
    applyTranslations();
    lucide.createIcons();
    setupEventListeners();
    renderColumnToggle();
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

    /* Column toggle button */
    columnsToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      columnsDropdown.classList.toggle('hidden');
    });

    /* Close dropdown on outside click */
    document.addEventListener('click', (e) => {
      if (!columnsDropdown.contains(e.target) && e.target !== columnsToggleBtn) {
        columnsDropdown.classList.add('hidden');
      }
      /* Close export submenu on outside click */
      if (!e.target.closest('.cc-exports')) {
        closeExportSubmenu();
      }
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
    notesModal.addEventListener('click', (e) => {
      if (e.target === notesModal) closeNotesModal();
    });

    /* History Modal */
    historyModalClose.addEventListener('click', closeHistoryModal);
    historyModalDone.addEventListener('click', closeHistoryModal);
    historyModal.addEventListener('click', (e) => {
      if (e.target === historyModal) closeHistoryModal();
    });

    /* KPI List Modal */
    kpiCardEntries.addEventListener('click', () => openKpiListModal('entries'));
    kpiCardNew.addEventListener('click', () => openKpiListModal('new'));
    kpiListModalClose.addEventListener('click', closeKpiListModal);
    kpiListDone.addEventListener('click', closeKpiListModal);
    kpiListCopy.addEventListener('click', copyKpiListPlates);
    kpiListModal.addEventListener('click', (e) => {
      if (e.target === kpiListModal) closeKpiListModal();
    });

    /* Keyboard: Escape closes modals */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeNotesModal();
        closeHistoryModal();
        closeKpiListModal();
        columnsDropdown.classList.add('hidden');
      }
    });
  }

  /* ══════════════════════════════════════════
     Data Loading
     ══════════════════════════════════════════ */

  /**
   * Loads all dashboard data: KPIs, charts, and vehicles table.
   * @returns {Promise<void>}
   */
  async function loadData() {
    refreshBtn.classList.add('spinning');

    try {
      if (!CONFIG.APPS_SCRIPT_URL) {
        /* Dev mode: use mock data */
        const mock = generateMockData();
        renderKPIs(mock.kpis);
        initCharts(mock);
        allVehicles = mock.vehicles;
        applyFilters();
      } else {
        /* Production: load KPIs first so numbers appear quickly, then vehicles */
        let dashboard, vehicleData;

        try {
          dashboard = await DataStore.getDashboardData();
          renderKPIs(dashboard.kpis);
          initCharts(dashboard);
        } catch (dashErr) {
          renderKPIsError();
          showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
        }

        try {
          vehicleData = await DataStore.getVehicles();
          allVehicles = vehicleData.vehicles || [];
          applyFilters();
        } catch (vehicleErr) {
          allVehicles = [];
          applyFilters();
          if (!dashboard) { /* only show second toast if KPIs also failed */
            showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
          }
        }
      }

      lastUpdatedEl.textContent = new Date().toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit'
      });

    } catch (err) {
      showToast(navigator.onLine ? t('msg.error.server') : t('msg.error.network'), 'error');
    } finally {
      refreshBtn.classList.remove('spinning');
    }
  }

  /* ══════════════════════════════════════════
     KPI Rendering
     ══════════════════════════════════════════ */

  /**
   * Updates KPI card values.
   * @param {{ entriesToday: number, newToday: number, totalVehicles: number, weeklyEntries: number }} kpis
   */
  function renderKPIs(kpis) {
    kpiEntriesToday.textContent = kpis.entriesToday ?? '--';
    kpiNewToday.textContent = kpis.newToday ?? '--';
    kpiTotalVehicles.textContent = kpis.totalVehicles ?? '--';
    kpiWeeklyEntries.textContent = kpis.weeklyEntries ?? '--';
  }

  function renderKPIsError() {
    kpiEntriesToday.textContent = '--';
    kpiNewToday.textContent = '--';
    kpiTotalVehicles.textContent = '--';
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
   * Weekly bar chart (8 weeks + current).
   * @param {Array<{ weekStart: string, count: number }>} weeklyData
   */
  function initWeeklyChart(weeklyData) {
    const ctx = document.getElementById('chart-weekly').getContext('2d');
    const labels = weeklyData.map(w => {
      /* Convert YYYY-MM-DD weekStart to DD/MM display label */
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
            ticks: {
              stepSize: 1,
              font: { family: 'Inter', size: 12 },
              color: '#64748B'
            },
            grid: { color: '#E2E8F0' }
          },
          x: {
            ticks: {
              font: { family: 'Inter', size: 12 },
              color: '#64748B'
            },
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
    const ctx = document.getElementById('chart-ratio').getContext('2d');
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

  /** Updates chart labels when language changes. */
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

  /** Renders both header and body of the data table. */
  function renderTable() {
    renderTableHeader();
    renderTableBody();
    lucide.createIcons();
  }

  /** Generates table header row based on visible columns. */
  function renderTableHeader() {
    tableHeader.innerHTML = '';

    COLUMNS.forEach(col => {
      if (!visibleColumns.has(col.id)) return;

      const th = document.createElement('th');
      th.textContent = t(col.i18nKey);
      th.dataset.column = col.id;

      if (col.id === 'placa') {
        th.classList.add('col-fixed');
      }

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

  /** Generates table body rows from filteredVehicles. */
  function renderTableBody() {
    tableBody.innerHTML = '';

    /* Toggle empty states */
    const hasData = allVehicles.length > 0;
    const hasResults = filteredVehicles.length > 0;

    tableWrapper.classList.toggle('hidden', !hasResults);
    tableEmpty.classList.toggle('hidden', hasData);
    tableNoResults.classList.toggle('hidden', !hasData || hasResults);

    if (!hasResults) return;

    const todayStr = formatDateYMD(new Date());

    filteredVehicles.forEach((vehicle, index) => {
      const tr = document.createElement('tr');
      const isNew = vehicle.first_seen === todayStr && vehicle.total_visits <= 1;

      COLUMNS.forEach(col => {
        if (!visibleColumns.has(col.id)) return;

        const td = document.createElement('td');
        const label = t(col.i18nKey);
        td.setAttribute('data-label', label);

        switch (col.id) {
          case 'num':
            td.textContent = index + 1;
            break;

          case 'tipo':
            td.className = 'cell-tipo';
            td.textContent = vehicle.tipo === 'moto' ? '🛵' : '🚗';
            /* Mobile: full row for placa */
            break;

          case 'placa':
            td.className = 'cell-placa col-fixed mobile-header-cell';
            const placaText = document.createElement('span');
            placaText.textContent = vehicle.placa;
            td.appendChild(placaText);

            /* Status badge inline on mobile */
            const mobileBadge = document.createElement('span');
            mobileBadge.className = 'badge-mobile ' + (isNew ? 'badge badge-new' : 'badge badge-known');
            mobileBadge.textContent = isNew ? ('🟢 ' + t('badge.new')) : ('🔵 ' + t('badge.known'));
            td.appendChild(mobileBadge);
            break;

          case 'firstSeen':
            td.textContent = displayDate(vehicle.first_seen);
            break;

          case 'lastSeen':
            td.textContent = displayDate(vehicle.last_seen);
            break;

          case 'totalVisits':
            td.textContent = vehicle.total_visits || 0;
            break;

          case 'status': {
            const badge = document.createElement('span');
            badge.className = isNew ? 'badge badge-new' : 'badge badge-known';
            badge.textContent = isNew ? ('🟢 ' + t('badge.new')) : ('🔵 ' + t('badge.known'));
            td.appendChild(badge);
            break;
          }

          case 'createdBy':
            td.textContent = vehicle.created_by || 'anonymous';
            break;

          case 'notes':
            td.className = 'cell-notes';
            if (vehicle.notes) {
              const noteText = document.createElement('span');
              noteText.textContent = vehicle.notes;
              td.appendChild(noteText);
              if (vehicle.notes_updated) {
                const noteDate = document.createElement('small');
                noteDate.className = 'note-date';
                noteDate.textContent = displayDate(vehicle.notes_updated);
                td.appendChild(noteDate);
              }
              td.title = vehicle.notes;
            } else {
              td.textContent = '-';
            }
            break;

          case 'actions': {
            td.className = 'cell-actions mobile-footer-cell';
            td.removeAttribute('data-label');

            /* History button */
            const histBtn = document.createElement('button');
            histBtn.title = t('history.title');
            histBtn.setAttribute('aria-label', t('history.title'));
            histBtn.innerHTML = '<i data-lucide="clock" style="width:16px;height:16px"></i>';
            histBtn.addEventListener('click', () => openHistoryModal(vehicle.vehicle_id, vehicle.placa));
            td.appendChild(histBtn);

            /* Edit notes button */
            const noteBtn = document.createElement('button');
            noteBtn.title = t('notes.edit');
            noteBtn.setAttribute('aria-label', t('notes.edit'));
            noteBtn.innerHTML = '<i data-lucide="pencil" style="width:16px;height:16px"></i>';
            noteBtn.addEventListener('click', () => openNotesModal(vehicle));
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

  /** Applies all active filters to allVehicles and re-renders table. */
  function applyFilters() {
    const searchTerm = filterSearch.value.trim().toUpperCase();
    const tipoFilter = filterTipo.value;
    const statusFilter = filterStatus.value;
    const dateFromVal = filterDateFrom.value; // YYYY-MM-DD
    const dateToVal = filterDateTo.value;     // YYYY-MM-DD

    /* Warn if date range is inverted */
    if (dateFromVal && dateToVal && dateFromVal > dateToVal) {
      showToast(t('filter.dateError'), 'warning');
    }

    const todayStr = formatDateYMD(new Date());

    filteredVehicles = allVehicles.filter(v => {
      /* Search by placa */
      if (searchTerm && !v.placa.toUpperCase().includes(searchTerm)) return false;

      /* Filter by tipo */
      if (tipoFilter && v.tipo !== tipoFilter) return false;

      /* Filter by status (new = first_seen is today with 1 visit) */
      if (statusFilter) {
        const isNew = v.first_seen === todayStr && v.total_visits <= 1;
        if (statusFilter === 'new' && !isNew) return false;
        if (statusFilter === 'known' && isNew) return false;
      }

      /* Filter by date range (using first_seen) */
      if (dateFromVal || dateToVal) {
        const vehicleDate = parseDate(v.first_seen);
        if (!vehicleDate) return false;

        if (dateFromVal) {
          const from = new Date(dateFromVal);
          if (vehicleDate < from) return false;
        }
        if (dateToVal) {
          const to = new Date(dateToVal);
          to.setHours(23, 59, 59, 999);
          if (vehicleDate > to) return false;
        }
      }

      return true;
    });

    sortVehicles();
    renderTable();
  }

  /** Clears all filter inputs and reapplies. */
  function clearFilters() {
    filterSearch.value = '';
    filterTipo.value = '';
    filterStatus.value = '';
    filterDateFrom.value = '';
    filterDateTo.value = '';
    applyFilters();
  }

  /* ══════════════════════════════════════════
     Sorting
     ══════════════════════════════════════════ */

  /** Sorts filteredVehicles based on sortConfig. */
  function sortVehicles() {
    const { column, direction } = sortConfig;
    const mult = direction === 'asc' ? 1 : -1;

    filteredVehicles.sort((a, b) => {
      let valA, valB;

      switch (column) {
        case 'placa':
          valA = a.placa;
          valB = b.placa;
          return mult * valA.localeCompare(valB);

        case 'tipo':
          valA = a.tipo;
          valB = b.tipo;
          return mult * valA.localeCompare(valB);

        case 'firstSeen':
          valA = parseDate(a.first_seen) || new Date(0);
          valB = parseDate(b.first_seen) || new Date(0);
          return mult * (valA - valB);

        case 'lastSeen':
          valA = parseDate(a.last_seen) || new Date(0);
          valB = parseDate(b.last_seen) || new Date(0);
          return mult * (valA - valB);

        case 'totalVisits':
          valA = a.total_visits || 0;
          valB = b.total_visits || 0;
          return mult * (valA - valB);

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
   * Handles column header click for sorting.
   * @param {string} columnId
   */
  function handleSort(columnId) {
    if (sortConfig.column === columnId) {
      sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      sortConfig.column = columnId;
      sortConfig.direction = 'asc';
    }
    sortVehicles();
    renderTable();
  }

  /* ══════════════════════════════════════════
     Column Toggle
     ══════════════════════════════════════════ */

  /** Renders column visibility checkboxes in the dropdown. */
  function renderColumnToggle() {
    columnsDropdown.innerHTML = '';

    COLUMNS.filter(c => c.toggleable).forEach(col => {
      const label = document.createElement('label');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = visibleColumns.has(col.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          visibleColumns.add(col.id);
        } else {
          visibleColumns.delete(col.id);
        }
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
   * Handles export button click — shows CSV/clipboard submenu.
   * @param {string} type — 'newToday' | 'byDate' | 'byLastSeen' | 'all'
   */
  function handleExportClick(type) {
    /* Toggle active state on export buttons */
    document.querySelectorAll('.cc-export-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.export === type);
    });

    if (activeExportType === type) {
      closeExportSubmenu();
      return;
    }

    activeExportType = type;
    exportSubmenu.classList.remove('hidden');
  }

  /** Hides the export submenu. */
  function closeExportSubmenu() {
    activeExportType = null;
    exportSubmenu.classList.add('hidden');
    document.querySelectorAll('.cc-export-btn').forEach(btn => btn.classList.remove('active'));
  }

  /**
   * Performs the actual export (CSV download or clipboard copy).
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
   * Returns filtered vehicle data for the given export type.
   * @param {string} type
   * @returns {Array<Object>}
   */
  function getExportData(type) {
    const todayStr = formatDateYMD(new Date());

    switch (type) {
      case 'newToday':
        return allVehicles.filter(v => v.first_seen === todayStr && v.total_visits <= 1);

      case 'byDate':
        /* Use current date filter, or default to all */
        return filteredVehicles.slice().sort((a, b) => {
          const dA = parseDate(a.first_seen) || new Date(0);
          const dB = parseDate(b.first_seen) || new Date(0);
          return dB - dA;
        });

      case 'byLastSeen':
        return [...filteredVehicles].sort((a, b) => {
          const dA = parseDate(a.last_seen) || new Date(0);
          const dB = parseDate(b.last_seen) || new Date(0);
          return dB - dA;
        });

      case 'all':
        return [...allVehicles];

      default:
        return [];
    }
  }

  /**
   * Downloads data as a CSV file.
   * @param {Array<Object>} data
   * @param {string} filename
   */
  function downloadCSV(data, filename) {
    const headers = [
      t('table.placa'), t('table.tipo'), t('table.firstSeen'),
      t('table.lastSeen'), t('table.totalVisits'), t('table.notes')
    ];

    const rows = data.map(v => [
      v.placa,
      v.tipo,
      displayDate(v.first_seen),
      displayDate(v.last_seen),
      v.total_visits,
      `"${(v.notes || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`${filename} ✓`, 'success');
  }

  /**
   * Copies vehicle data to clipboard as tab-separated text.
   * @param {Array<Object>} data
   */
  async function copyToClipboard(data) {
    const headers = [
      t('table.placa'), t('table.tipo'), t('table.firstSeen'),
      t('table.lastSeen'), t('table.totalVisits'), t('table.notes')
    ];

    const rows = data.map(v => [
      v.placa, v.tipo, displayDate(v.first_seen), displayDate(v.last_seen), v.total_visits, v.notes || ''
    ].join('\t'));

    const text = [headers.join('\t'), ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      showToast(t('export.copied'), 'success');
    } catch {
      /* Fallback */
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
   * Attach with addEventListener('keydown', trapTabInModal) on the modal element.
   *
   * @param {KeyboardEvent} e
   */
  function trapTabInModal(e) {
    if (e.key !== 'Tab') return;

    const modal = e.currentTarget;
    const focusable = Array.from(modal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.closest('.hidden') && el.offsetParent !== null);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ══════════════════════════════════════════
     Notes Modal
     ══════════════════════════════════════════ */

  /**
   * Opens the notes editing modal for a vehicle.
   * @param {Object} vehicle
   */
  function openNotesModal(vehicle) {
    lastFocusedElement = document.activeElement; // save opener for focus return
    editingVehicle = { vehicleId: vehicle.vehicle_id, placa: vehicle.placa };
    notesModalPlaca.textContent = vehicle.placa;
    notesModalInput.value = vehicle.notes || '';
    notesModalCount.textContent = (vehicle.notes || '').length;

    /* Show/hide notes date */
    if (vehicle.notes_updated) {
      notesModalDate.textContent = `${t('notes.lastUpdated')}: ${displayDate(vehicle.notes_updated)}`;
      notesModalDate.classList.remove('hidden');
    } else {
      notesModalDate.classList.add('hidden');
    }

    /* Show delete button only if notes exist */
    notesModalDelete.classList.toggle('hidden', !vehicle.notes);

    notesModal.classList.add('active');
    notesModalInput.focus();

    /* Tab trap: keep focus inside modal */
    notesModal.addEventListener('keydown', trapTabInModal);
  }

  /** Closes the notes modal and returns focus to the opener. */
  function closeNotesModal() {
    notesModal.classList.remove('active');
    notesModal.removeEventListener('keydown', trapTabInModal);
    editingVehicle = null;
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  /** Saves the edited notes to backend. */
  async function saveNotes() {
    if (!editingVehicle) return;

    const newNotes = notesModalInput.value.trim();
    notesModalSave.disabled = true;
    notesModalSave.textContent = '...';

    try {
      if (CONFIG.APPS_SCRIPT_URL) {
        await DataStore.updateNotes('vehicle', editingVehicle.vehicleId, newNotes);
      }

      /* Update local state */
      const vehicle = allVehicles.find(v => v.vehicle_id === editingVehicle.vehicleId);
      if (vehicle) {
        vehicle.notes = newNotes;
        vehicle.notes_updated = newNotes ? formatDateYMD(new Date()) : '';
      }

      showToast(t('notes.saved'), 'success');
      closeNotesModal();
      renderTable();

    } catch (err) {
      showToast(t('msg.error.server'), 'error');
    } finally {
      notesModalSave.disabled = false;
      notesModalSave.textContent = t('notes.save');
    }
  }

  /** Deletes notes for the current vehicle. */
  async function deleteNotes() {
    if (!editingVehicle) return;

    notesModalDelete.disabled = true;

    try {
      if (CONFIG.APPS_SCRIPT_URL) {
        await DataStore.updateNotes('vehicle', editingVehicle.vehicleId, '');
      }

      const vehicle = allVehicles.find(v => v.vehicle_id === editingVehicle.vehicleId);
      if (vehicle) {
        vehicle.notes = '';
        vehicle.notes_updated = '';
      }

      showToast(t('notes.deleted'), 'success');
      closeNotesModal();
      renderTable();

    } catch (err) {
      showToast(t('msg.error.server'), 'error');
    } finally {
      notesModalDelete.disabled = false;
    }
  }

  /* ══════════════════════════════════════════
     History Modal
     ══════════════════════════════════════════ */

  /**
   * Opens the vehicle history modal and loads entry dates.
   * @param {string} vehicleId
   * @param {string} placa
   */
  async function openHistoryModal(vehicleId, placa) {
    lastFocusedElement = document.activeElement; // save opener for focus return
    historyPlate.textContent = placa;
    setHistoryMessage('loading');
    historyModal.classList.add('active');
    historyModal.addEventListener('keydown', trapTabInModal);

    try {
      let history;

      if (!CONFIG.APPS_SCRIPT_URL) {
        /* Dev mode mock */
        history = generateMockHistory();
      } else {
        const result = await DataStore.getVehicleHistory(vehicleId);
        history = result.history || [];
      }

      renderHistory(history);

    } catch (err) {
      setHistoryMessage('msg.error.server');
    }
  }

  /**
   * Sets a single status/message inside the history list (no user data — safe).
   * Replaces innerHTML concatenation with t() to avoid the pattern entirely.
   *
   * @param {string} i18nKey - Translation key
   */
  function setHistoryMessage(i18nKey) {
    historyList.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'cc-history-loading';
    div.textContent = t(i18nKey);
    historyList.appendChild(div);
  }

  /**
   * Renders history entries in the modal.
   * @param {Array<{ date: string, time: string }>} history
   */
  function renderHistory(history) {
    historyList.innerHTML = '';

    if (history.length === 0) {
      setHistoryMessage('empty.noEntries');
      return;
    }

    history.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'cc-history-item';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'history-date';
      dateSpan.textContent = displayDate(entry.date);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'history-time';
      timeSpan.textContent = entry.time;

      item.appendChild(dateSpan);
      item.appendChild(timeSpan);
      historyList.appendChild(item);
    });
  }

  /** Closes the history modal and returns focus to the opener. */
  function closeHistoryModal() {
    historyModal.classList.remove('active');
    historyModal.removeEventListener('keydown', trapTabInModal);
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  /* ══════════════════════════════════════════
     KPI List Modal
     ══════════════════════════════════════════ */

  /** Currently displayed KPI list plates (for copy). */
  let kpiListPlates = [];

  /**
   * Opens the KPI list modal showing plates for a given type.
   * @param {'entries'|'new'} type - Which KPI list to show
   */
  async function openKpiListModal(type) {
    lastFocusedElement = document.activeElement; // save opener for focus return
    const todayStr = formatDateYMD(new Date());
    let title = '';
    let emptyMsg = '';

    kpiListModal.classList.add('active');
    kpiListModal.addEventListener('keydown', trapTabInModal);
    kpiListContent.innerHTML = `<p class="text-sm text-muted" style="padding:var(--space-md) 0">${t('loading')}</p>`;
    kpiListContent.classList.remove('hidden');
    kpiListEmpty.classList.add('hidden');
    kpiListCopy.classList.add('hidden');
    kpiListModalClose.focus();

    if (type === 'entries') {
      title = t('kpi.entriesToday.title');
      emptyMsg = t('kpi.emptyEntries');
      kpiListModalTitle.textContent = title;

      /* Fetch actual entries for today, group by placa to get per-vehicle counts */
      let entryCounts = {}; // placa → count
      try {
        const result = await DataStore.getEntries({ dateFrom: todayStr, dateTo: todayStr });
        const entries = result.entries || [];
        entries.forEach(e => {
          const p = e.placa || e.vehicle_placa || '';
          if (p) entryCounts[p] = (entryCounts[p] || 0) + 1;
        });
      } catch (_) { /* fall back to allVehicles last_seen */ }

      const vehicles = allVehicles.filter(v => v.last_seen === todayStr);
      kpiListPlates = vehicles.map(v => v.placa);
      kpiListContent.innerHTML = '';

      if (vehicles.length === 0) {
        kpiListContent.classList.add('hidden');
        kpiListEmpty.classList.remove('hidden');
        kpiListEmpty.querySelector('span').textContent = emptyMsg;
      } else {
        kpiListContent.classList.remove('hidden');
        kpiListCopy.classList.remove('hidden');
        vehicles.forEach(v => {
          const item = document.createElement('div');
          item.className = 'kpi-list-item';

          const placa = document.createElement('span');
          placa.className = 'kpi-list-placa';
          placa.textContent = v.placa;

          const tipo = document.createElement('span');
          tipo.className = 'kpi-list-tipo';
          tipo.textContent = v.tipo === 'moto' ? '🛵' : '🚗';

          item.appendChild(placa);
          item.appendChild(tipo);

          const count = entryCounts[v.placa] || 0;
          if (count > 1) {
            const badge = document.createElement('span');
            badge.className = 'kpi-list-badge';
            badge.textContent = `×${count}`;
            item.appendChild(badge);
          }

          kpiListContent.appendChild(item);
        });
      }

    } else {
      title = t('kpi.newToday.title');
      emptyMsg = t('kpi.emptyNew');
      kpiListModalTitle.textContent = title;

      /* New vehicles: first_seen === today (no total_visits restriction) */
      const vehicles = allVehicles.filter(v => v.first_seen === todayStr);
      kpiListPlates = vehicles.map(v => v.placa);
      kpiListContent.innerHTML = '';

      if (vehicles.length === 0) {
        kpiListContent.classList.add('hidden');
        kpiListEmpty.classList.remove('hidden');
        kpiListEmpty.querySelector('span').textContent = emptyMsg;
      } else {
        kpiListContent.classList.remove('hidden');
        kpiListCopy.classList.remove('hidden');
        vehicles.forEach(v => {
          const item = document.createElement('div');
          item.className = 'kpi-list-item';

          const placa = document.createElement('span');
          placa.className = 'kpi-list-placa';
          placa.textContent = v.placa;

          const tipo = document.createElement('span');
          tipo.className = 'kpi-list-tipo';
          tipo.textContent = v.tipo === 'moto' ? '🛵' : '🚗';

          item.appendChild(placa);
          item.appendChild(tipo);
          kpiListContent.appendChild(item);
        });
      }
    }

    lucide.createIcons();
  }

  /** Closes the KPI list modal and returns focus to the opener. */
  function closeKpiListModal() {
    kpiListModal.classList.remove('active');
    kpiListModal.removeEventListener('keydown', trapTabInModal);
    kpiListPlates = [];
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  /** Copies the KPI list plates to clipboard. */
  async function copyKpiListPlates() {
    if (kpiListPlates.length === 0) return;

    const text = kpiListPlates.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      showToast(t('kpi.copiedPlates'), 'success');
    } catch {
      /* Fallback */
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
     UI Helpers
     ══════════════════════════════════════════ */

  /** Updates lang toggle active state. */
  function updateLangToggle() {
    document.querySelectorAll('.lang-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === getCurrentLang());
    });
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

  /* ══════════════════════════════════════════
     Date Utilities
     ══════════════════════════════════════════ */

  /**
   * Formats a Date object to YYYY-MM-DD (internal format, matches backend).
   * Used for comparisons, filtering, filenames, and as the canonical format.
   * @param {Date} date
   * @returns {string}
   */
  function formatDateYMD(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Converts a YYYY-MM-DD string to DD/MM/YYYY for user-facing display.
   * Passes through DD/MM/YYYY strings unchanged.
   * @param {string} str - Date string
   * @returns {string} DD/MM/YYYY formatted string, or '-' if empty
   */
  function displayDate(str) {
    if (!str) return '-';
    /* Extract just the date part if a full ISO timestamp was returned */
    const dateOnly = typeof str === 'string' ? str.substring(0, 10) : String(str);
    if (dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = dateOnly.split('-');
      return `${d}/${m}/${y}`;
    }
    return str;
  }

  /**
   * Parses a date string (YYYY-MM-DD or DD/MM/YYYY) to a Date object.
   * @param {string} str
   * @returns {Date|null}
   */
  function parseDate(str) {
    if (!str) return null;
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    return null;
  }

  /* ══════════════════════════════════════════
     Online / Offline
     ══════════════════════════════════════════ */

  /** Sets up network status listeners. */
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

  /**
   * Generates realistic mock data for development/testing.
   * @returns {{ kpis: Object, weeklyData: Array, newVsKnown: Object, vehicles: Array }}
   */
  function generateMockData() {
    const today = new Date();
    const placas = [
      'ABC-123', 'XYZ-789', 'DEF-456', 'GHI-012', 'JKL-345',
      'MNO-678', 'PQR-901', 'STU-234', 'VWX-567', 'YZA-890',
      'BCD-111', 'EFG-222', 'HIJ-333', 'KLM-444', 'NOP-555'
    ];

    const notes = [
      'Estacionamiento regular',
      'Cliente frecuente',
      'Vehículo grande — doble espacio',
      '',
      'Pago mensual',
      ''
    ];

    const vehicles = placas.map((placa, i) => {
      const daysAgo = Math.floor(Math.random() * 90) + 1;
      const firstSeen = new Date(today);
      firstSeen.setDate(firstSeen.getDate() - daysAgo);

      const lastDaysAgo = Math.floor(Math.random() * Math.min(daysAgo, 7));
      const lastSeen = new Date(today);
      lastSeen.setDate(lastSeen.getDate() - lastDaysAgo);

      const note = notes[i % notes.length];
      return {
        vehicle_id: `mock-v${i + 1}`,
        placa,
        tipo: i % 5 === 0 ? 'moto' : 'auto',
        first_seen: formatDateYMD(firstSeen),
        last_seen: formatDateYMD(lastSeen),
        total_visits: Math.floor(Math.random() * 25) + 1,
        notes: note,
        notes_updated: note ? formatDateYMD(lastSeen) : ''
      };
    });

    /* Make 3 vehicles "new today" */
    for (let i = 0; i < 3; i++) {
      vehicles[i].first_seen = formatDateYMD(today);
      vehicles[i].last_seen = formatDateYMD(today);
      vehicles[i].total_visits = 1;
    }

    /* Weekly data (9 weeks: 8 past + current) */
    const weeklyData = [];
    for (let w = 8; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (w * 7));

      weeklyData.push({
        weekStart: formatDateYMD(weekStart),
        count: Math.floor(Math.random() * 40) + 10
      });
    }

    /* KPIs */
    const entriesToday = Math.floor(Math.random() * 20) + 5;
    const newToday = 3;
    const totalVehicles = vehicles.length;
    const weeklyEntries = weeklyData[weeklyData.length - 1].count;

    return {
      kpis: { entriesToday, newToday, totalVehicles, weeklyEntries },
      weeklyData,
      newVsKnown: {
        new: newToday,
        known: totalVehicles - newToday
      },
      vehicles
    };
  }

  /**
   * Generates mock history entries for a vehicle.
   * @returns {Array<{ date: string, time: string }>}
   */
  function generateMockHistory() {
    const today = new Date();
    const entries = [];
    const numEntries = Math.floor(Math.random() * 8) + 2;

    for (let i = 0; i < numEntries; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - Math.floor(Math.random() * 60));
      const hours = String(Math.floor(Math.random() * 12) + 7).padStart(2, '0');
      const minutes = String(Math.floor(Math.random() * 60)).padStart(2, '0');

      entries.push({
        date: formatDateYMD(d),
        time: `${hours}:${minutes}`
      });
    }

    /* Sort by date descending */
    entries.sort((a, b) => {
      const dA = parseDate(a.date);
      const dB = parseDate(b.date);
      return dB - dA;
    });

    return entries;
  }
});
