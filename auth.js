/**
 * ParkLog — Authentication & Session Management (auth.js)
 *
 * Handles per-user login state in sessionStorage.
 * Sessions expire after 8 hours of inactivity (CONFIG.SESSION_TTL_MS).
 *
 * Public API:
 *   Auth.getSession()    → current session object or null
 *   Auth.setSession(d)   → stores session, returns session object
 *   Auth.clearSession()  → removes session from sessionStorage
 *   Auth.requireAuth()   → returns session or null (call on every page load)
 *   Auth.isAdmin()       → true if session.role === 'admin'
 */

const Auth = (() => {
  const SESSION_KEY = 'parklog_session';

  /**
   * Returns the current active session, or null if expired or missing.
   *
   * @returns {{ user_id: string, display_name: string, role: string, expires_at: number }|null}
   */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.expires_at) return null;
      if (Date.now() > session.expires_at) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Stores a new session with an 8-hour expiry.
   * Overwrites any existing session.
   *
   * @param {{ user_id: string, display_name: string, role: string }} data
   * @returns {{ user_id: string, display_name: string, role: string, expires_at: number }}
   */
  function setSession(data) {
    const session = {
      user_id: data.user_id,
      display_name: data.display_name,
      role: data.role,
      expires_at: Date.now() + CONFIG.SESSION_TTL_MS
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  /**
   * Removes the current session from sessionStorage.
   * @returns {void}
   */
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Returns the current valid session, or null if unauthenticated.
   * Call on every page load — if null, show login screen.
   *
   * @returns {{ user_id: string, display_name: string, role: string, expires_at: number }|null}
   */
  function requireAuth() {
    return getSession();
  }

  /**
   * Returns true if the current session has admin role.
   * @returns {boolean}
   */
  function isAdmin() {
    const session = getSession();
    return !!(session && session.role === 'admin');
  }

  return { getSession, setSession, clearSession, requireAuth, isAdmin };
})();
