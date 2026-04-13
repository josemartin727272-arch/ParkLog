/**
 * ParkLog — Data Abstraction Layer (sheets.js)
 * The ONLY file that communicates with the backend.
 * All API calls go through DataStore methods.
 * If backend changes (Apps Script → Firebase), only this file changes.
 *
 * Features:
 *   - Response caching (60s for CommandCenter)
 *   - Offline queue with auto-retry
 *   - Rate limiting (1 req/sec)
 */

const DataStore = (() => {
  /* ── Cache ── */
  const cache = new Map();

  /* ── Rate Limiting ── */
  let lastRequestTime = 0;
  let rateLimitPending = false;

  /* ── Fetch Timeout ── */
  /* Apps Script can take 15-20s on cold start — keep timeout generous */
  const FETCH_TIMEOUT_MS = 25000;

  /* ── Offline Queue ── */
  const QUEUE_KEY = 'parklog-offline-queue';

  /**
   * Low-level GET request to Apps Script.
   *
   * @param {string} action - Action name
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<Object>} Response data
   * @throws {Error} On network or server error
   */
  async function apiGet(action, params = {}, attempt = 1) {
    await rateLimit();

    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, val);
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeoutId);
      /* Auto-retry once on timeout — Apps Script cold start can take 15-20s */
      if (err.name === 'AbortError' && attempt === 1) {
        await new Promise(r => setTimeout(r, 2000));
        return apiGet(action, params, 2);
      }
      if (err.name === 'AbortError') throw new Error('Request timed out');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  /**
   * Low-level POST request to Apps Script.
   *
   * @param {Object} body - Request body (must include `action`)
   * @returns {Promise<Object>} Response data
   * @throws {Error} On network or server error
   */
  async function apiPost(body) {
    await rateLimit();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        // text/plain avoids CORS preflight — Apps Script reads via e.postData.contents
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timed out');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  /**
   * Enforces minimum interval between API calls.
   * @returns {Promise<void>}
   */
  async function rateLimit() {
    // Update lastRequestTime before the await to prevent parallel calls
    // from both passing the check before either one updates the timestamp.
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < CONFIG.RATE_LIMIT_MS) {
      lastRequestTime = now + (CONFIG.RATE_LIMIT_MS - elapsed);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_MS - elapsed));
    } else {
      lastRequestTime = now;
    }
  }

  /**
   * Gets cached data or fetches fresh.
   *
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to call on cache miss
   * @returns {Promise<Object>}
   */
  async function getCached(key, fetchFn) {
    const cached = cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_TTL_MS) {
      return cached.data;
    }

    const data = await fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /** Clears all cached data. */
  function clearCache() {
    cache.clear();
  }

  /* ══════════════════════════════════════════
     Offline Queue
     ══════════════════════════════════════════ */

  /**
   * Adds an entry to the offline queue.
   * @param {Object} entryData - Entry to queue
   */
  function queueEntry(entryData) {
    const queue = getQueue();
    queue.push({
      data: entryData,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * Gets the current offline queue.
   * @returns {Array<Object>}
   */
  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
    } catch {
      return [];
    }
  }

  /**
   * Processes all queued entries (called when back online).
   * @returns {Promise<{ sent: number, failed: number }>}
   */
  async function processQueue() {
    const queue = getQueue();
    if (queue.length === 0) return { sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;
    const remaining = [];

    for (const item of queue) {
      try {
        /* Pass original queued timestamp so Apps Script preserves it */
        const payload = item.timestamp
          ? { ...item.data, queuedAt: item.timestamp }
          : item.data;
        await apiPost({ action: 'createEntry', data: payload });
        sent++;
      } catch {
        remaining.push(item);
        failed++;
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    if (sent > 0) clearCache();

    return { sent, failed };
  }

  /**
   * Returns the number of queued entries.
   * @returns {number}
   */
  function getQueueSize() {
    return getQueue().length;
  }

  /* ══════════════════════════════════════════
     Private Date Helpers
     ══════════════════════════════════════════ */

  function _fmtYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function _weekStartYMD(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return _fmtYMD(d);
  }

  /* ══════════════════════════════════════════
     Public API
     ══════════════════════════════════════════ */

  return {
    /**
     * Searches for a vehicle by plate number.
     *
     * @param {string} placa - License plate
     * @returns {Promise<{ isNew: boolean, vehicle: Object|null }>}
     */
    async searchVehicle(placa) {
      return apiGet('searchVehicle', { placa: placa.toUpperCase().trim() });
    },

    /**
     * Saves a new vehicle entry. Falls back to offline queue on network error.
     *
     * @param {{ placa: string, tipo: string, notes: string, createdBy: string, entryDate: string }} data
     * @returns {Promise<{ success: boolean, isNew: boolean, entry: Object, vehicle: Object, queued?: boolean }>}
     */
    async saveEntry(data) {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      const entryData = {
        placa: (data.placa || '').toUpperCase().trim(),
        tipo: data.tipo || CONFIG.DEFAULT_VEHICLE_TYPE,
        notes: (data.notes || '').trim(),
        location: data.location || '',
        createdBy: data.createdBy || (session ? session.display_name : 'anonymous'),
        userId: session ? session.user_id : '',
        entryDate: data.entryDate || null
      };

      try {
        const result = await apiPost({ action: 'createEntry', data: entryData });
        clearCache();
        return result;
      } catch (err) {
        if (!navigator.onLine) {
          queueEntry(entryData);
          return { success: true, queued: true, isNew: false, entry: {}, vehicle: {} };
        }
        throw err;
      }
    },

    /**
     * Looks up a person by ID number.
     *
     * @param {string} idNumber
     * @returns {Promise<{ found: boolean, person_id?: string, firstName?: string, lastName?: string, lastSeen?: string, totalVisits?: number }>}
     */
    async lookupPerson(idNumber) {
      return apiGet('lookupPerson', { idNumber: idNumber.trim() });
    },

    /**
     * Saves a person entry. Falls back to offline queue on network error.
     *
     * @param {{ firstName: string, lastName: string, idNumber: string, notes: string, createdBy: string, entryDate: string }} data
     * @returns {Promise<{ success: boolean, isNew: boolean, person: Object, queued?: boolean }>}
     */
    async savePersonEntry(data) {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      const entryData = {
        firstName: (data.firstName || '').trim(),
        lastName: (data.lastName || '').trim(),
        idNumber: (data.idNumber || '').trim(),
        notes: (data.notes || '').trim(),
        createdBy: data.createdBy || (session ? session.display_name : 'anonymous'),
        userId: session ? session.user_id : '',
        entryDate: data.entryDate || null,
        entryType: 'persona'
      };

      try {
        const result = await apiPost({ action: 'savePersonEntry', data: entryData });
        clearCache();
        return result;
      } catch (err) {
        if (!navigator.onLine) {
          queueEntry(entryData);
          return { success: true, queued: true, isNew: false, person: {} };
        }
        throw err;
      }
    },

    /**
     * Gets persons with optional filters (cached).
     *
     * @param {{ search?: string, dateFrom?: string, dateTo?: string }} [filters={}]
     * @returns {Promise<{ persons: Array, total: number }>}
     */
    async getPersons(filters = {}) {
      const cacheKey = 'persons:' + JSON.stringify(filters);
      return getCached(cacheKey, () => apiGet('getPersons', filters));
    },

    /**
     * Authenticates a user against the Users sheet.
     *
     * @param {string} displayName
     * @param {string} password
     * @returns {Promise<{ success: boolean, user_id?: string, display_name?: string, role?: string, error?: string }>}
     */
    async login(displayName, password) {
      return apiPost({ action: 'login', displayName, password });
    },

    /**
     * Creates a new user (admin only).
     *
     * @param {string} displayName
     * @param {'admin'|'employee'} role
     * @returns {Promise<{ success: boolean, plaintext_password?: string }>}
     */
    async createUser(displayName, role) {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      return apiPost({ action: 'createUser', displayName, role, requesterId: session?.user_id || '' });
    },

    /**
     * Toggles a user's is_active flag (admin only).
     *
     * @param {string} userId
     * @returns {Promise<{ success: boolean, is_active: boolean }>}
     */
    async toggleUser(userId) {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      return apiPost({ action: 'toggleUser', userId, requesterId: session?.user_id || '' });
    },

    /**
     * Resets a user's password and returns the new plaintext (admin only).
     *
     * @param {string} userId
     * @returns {Promise<{ success: boolean, plaintext_password: string }>}
     */
    async resetPassword(userId) {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      return apiPost({ action: 'resetPassword', userId, requesterId: session?.user_id || '' });
    },

    /**
     * Deletes a user permanently (admin only).
     *
     * @param {string} userId
     * @returns {Promise<{ success: boolean }>}
     */
    async deleteUser(userId) {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      return apiPost({ action: 'deleteUser', userId, requesterId: session?.user_id || '' });
    },

    /**
     * Gets all users (admin only).
     *
     * @returns {Promise<{ users: Array }>}
     */
    async getUsers() {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      return apiGet('getUsers', { requesterId: session?.user_id || '' });
    },

    /**
     * Gets vehicles with optional filters (cached).
     *
     * @param {{ tipo?: string, status?: string, dateFrom?: string, dateTo?: string, search?: string }} [filters={}]
     * @returns {Promise<{ vehicles: Array, total: number }>}
     */
    async getVehicles(filters = {}) {
      const cacheKey = 'vehicles:' + JSON.stringify(filters);
      return getCached(cacheKey, () => apiGet('getVehicles', filters));
    },

    /**
     * Gets entries with optional filters (cached).
     *
     * @param {{ vehicleId?: string, dateFrom?: string, dateTo?: string }} [filters={}]
     * @returns {Promise<{ entries: Array, total: number }>}
     */
    async getEntries(filters = {}) {
      const cacheKey = 'entries:' + JSON.stringify(filters);
      return getCached(cacheKey, () => apiGet('getEntries', filters));
    },

    /**
     * Gets dashboard data: KPIs + chart data (cached).
     * Passes today and weekStart client-side to avoid Apps Script timezone issues.
     *
     * @returns {Promise<{ kpis: Object, weeklyData: Array, newVsKnown: Object }>}
     */
    async getDashboardData() {
      // Compute date strings client-side to avoid Apps Script timezone issues
      const now = new Date();
      const todayStr = _fmtYMD(now);
      const weekStartStr = _weekStartYMD(now);
      return getCached('dashboard', () => apiGet('getDashboardData', { today: todayStr, weekStart: weekStartStr }));
    },

    /**
     * Gets entry history for a vehicle.
     *
     * @param {string} vehicleId
     * @returns {Promise<{ history: Array<{ date: string, time: string, notes: string, location: string }> }>}
     */
    async getVehicleHistory(vehicleId) {
      return apiGet('getVehicleHistory', { vehicleId });
    },

    /**
     * Gets entry history for a person.
     *
     * @param {string} personId
     * @returns {Promise<{ history: Array<{ date: string, time: string, notes: string, location: string }> }>}
     */
    async getPersonHistory(personId) {
      return apiGet('getPersonHistory', { personId });
    },

    /**
     * Updates notes for a vehicle or entry.
     *
     * @param {'vehicle'|'entry'} type
     * @param {string} id - Record UUID
     * @param {string} notes - New notes text
     * @returns {Promise<{ success: boolean }>}
     */
    async updateNotes(type, id, notes) {
      const result = await apiPost({ action: 'updateNotes', type, id, notes });
      clearCache();
      return result;
    },

    /**
     * Pings the backend to verify connectivity.
     * @returns {Promise<{ status: string }>}
     */
    async ping() {
      return apiGet('ping');
    },

    /** Clears response cache. */
    clearCache,

    /** Processes offline queue. */
    processQueue,

    /** Returns offline queue size. */
    getQueueSize
  };
})();
