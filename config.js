/**
 * ParkLog — Application Configuration
 * Central configuration constants used across the application.
 */

const CONFIG = {
  /**
   * Google Apps Script Web App URL
   * Set after Apps Script deployment (see SETUP_INSTRUCTIONS_HE.md)
   * Example: https://script.google.com/macros/d/AKfycby.../usercontent
   */
  APPS_SCRIPT_URL: '',

  /** Placa validation */
  PLACA_MIN_LENGTH: 2,
  PLACA_MAX_LENGTH: 10,
  PLACA_PATTERN: /^[A-Z0-9-]+$/,

  /** Notes */
  NOTES_MAX_LENGTH: 300,

  /** Debounce delay for plate lookup (ms) */
  LOOKUP_DEBOUNCE_MS: 300,

  /** Submit button cooldown after save (ms) */
  SUBMIT_COOLDOWN_MS: 3000,

  /** CommandCenter cache TTL (ms) */
  CACHE_TTL_MS: 60000,

  /** Rate limiting: minimum interval between API calls (ms) */
  RATE_LIMIT_MS: 1000,

  /** Vehicle types */
  VEHICLE_TYPES: ['auto', 'moto'],
  DEFAULT_VEHICLE_TYPE: 'auto',

  /** Default language */
  DEFAULT_LANG: 'es',
  SUPPORTED_LANGS: ['es', 'he']
};

Object.freeze(CONFIG);
