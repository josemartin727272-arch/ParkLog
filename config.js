/**
 * ParkLog — Application Configuration
 * Central configuration constants used across the application.
 */

const CONFIG = {
  /**
   * Google Apps Script Web App URL
   * Set after Apps Script deployment (see SETUP_INSTRUCTIONS_HE.md)
   * Example: https://script.google.com/macros/s/AKfycby.../exec
   */
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwBw3cSF0XA74lg53aQ8R23kGT-QPU2IFRa1ItM60upvJscI7XZz67LlD_ZC1pC0MWaDQ/exec',

  /**
   * App version — bump this to invalidate all stored sessions and localStorage.
   * Change 3: bumped to '2.0' to force re-login for all users on v2.0 deploy.
   */
  PARKLOG_VERSION: '2.1',

  /** Placa validation */
  PLACA_MIN_LENGTH: 2,
  PLACA_MAX_LENGTH: 10,
  PLACA_PATTERN: /^[A-Z0-9-]+$/,

  /** ID Number validation (persona entry type) — digits only, 5–12 chars */
  ID_NUMBER_MIN_LENGTH: 5,
  ID_NUMBER_MAX_LENGTH: 12,
  ID_NUMBER_PATTERN: /^[0-9]+$/,

  /** Notes */
  NOTES_MAX_LENGTH: 300,

  /** Debounce delay for plate/person lookup (ms) */
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

  /** All entry types — vehicles + person on foot */
  ENTRY_TYPES: ['auto', 'moto', 'persona'],

  /** Default language */
  DEFAULT_LANG: 'es',
  SUPPORTED_LANGS: ['es', 'he'],

  /** Session TTL — 8 hours in milliseconds */
  SESSION_TTL_MS: 8 * 60 * 60 * 1000
};

Object.freeze(CONFIG);
