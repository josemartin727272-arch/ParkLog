/**
 * ParkLog — Version Check (version-check.js)
 *
 * Must be the FIRST script loaded on every page.
 * Runs synchronously — before config.js, auth.js, or any app code.
 *
 * If the stored version does not match CURRENT_VERSION, all localStorage
 * and sessionStorage is wiped and the user is redirected to the login
 * page (index.html) so they must re-authenticate.
 *
 * When bumping the app version, update CURRENT_VERSION here AND
 * CONFIG.PARKLOG_VERSION in config.js to the same value.
 */
(function () {
  var CURRENT_VERSION = '2.0';
  var VERSION_KEY     = 'parklog-version';

  if (localStorage.getItem(VERSION_KEY) !== CURRENT_VERSION) {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);

    /* Redirect to index unless already there */
    var path = window.location.pathname;
    if (!path.endsWith('index.html') && path !== '/' && path !== '') {
      window.location.replace('index.html');
    }
  }
})();
