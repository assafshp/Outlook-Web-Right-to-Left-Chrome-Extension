'use strict';

/**
 * Shared utilities for the Outlook Web & Gemini Enterprise RTL extension.
 * Loaded before each site-specific content script (outlook.js / gemini.js).
 * Exposes a single global namespace: window.OWRTL
 */
(function () {
  // Avoid double-initialization if injected more than once.
  if (window.OWRTL) {
    return;
  }

  // Read the version straight from the manifest so it can never drift.
  const VERSION = (() => {
    try {
      return chrome.runtime.getManifest().version;
    } catch (e) {
      return 'unknown';
    }
  })();

  const CONFIG = {
    VERSION,
    DEBUG: false, // Set to true during development for verbose logging.
    OBSERVER_THROTTLE_MS: 100
  };

  const Logger = {
    info: (msg) => CONFIG.DEBUG && console.log(`OWRTL [${CONFIG.VERSION}]: ${msg}`),
    error: (msg, err) => console.error(`OWRTL [${CONFIG.VERSION}] Error: ${msg}`, err)
  };

  /**
   * Throttle function to limit the rate of function calls.
   * @param {Function} func - The function to throttle.
   * @param {number} limit - The time limit in milliseconds.
   * @returns {Function} - Throttled function.
   */
  function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Default per-site enablement. Both sites are ON out of the box.
   */
  const DEFAULT_SETTINGS = {
    outlookEnabled: true,
    geminiEnabled: true
  };

  const Settings = {
    DEFAULTS: DEFAULT_SETTINGS,

    /**
     * Read all settings, falling back to defaults when storage is empty
     * or unavailable (e.g. permission edge cases).
     * @returns {Promise<{outlookEnabled: boolean, geminiEnabled: boolean}>}
     */
    getAll() {
      return new Promise((resolve) => {
        try {
          chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
            if (chrome.runtime.lastError) {
              Logger.error('Failed to read settings', chrome.runtime.lastError);
              resolve({ ...DEFAULT_SETTINGS });
              return;
            }
            resolve({ ...DEFAULT_SETTINGS, ...items });
          });
        } catch (err) {
          Logger.error('storage.sync unavailable, using defaults', err);
          resolve({ ...DEFAULT_SETTINGS });
        }
      });
    },

    /**
     * Persist a partial settings update.
     * @param {Object} partial
     * @returns {Promise<void>}
     */
    set(partial) {
      return new Promise((resolve) => {
        try {
          chrome.storage.sync.set(partial, () => {
            if (chrome.runtime.lastError) {
              Logger.error('Failed to save settings', chrome.runtime.lastError);
            }
            resolve();
          });
        } catch (err) {
          Logger.error('storage.sync.set failed', err);
          resolve();
        }
      });
    },

    /**
     * Subscribe to changes for a single setting key.
     * @param {string} key - The setting key to watch.
     * @param {(newValue: boolean) => void} callback
     */
    onChange(key, callback) {
      try {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && changes[key]) {
            callback(changes[key].newValue);
          }
        });
      } catch (err) {
        Logger.error('Could not attach storage change listener', err);
      }
    }
  };

  window.OWRTL = { CONFIG, Logger, throttle, Settings };
})();
