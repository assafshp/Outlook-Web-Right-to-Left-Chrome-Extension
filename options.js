'use strict';

/**
 * Options page logic.
 * Reads/writes the two per-site toggles from chrome.storage.sync.
 * Kept dependency-free (does not rely on common.js) so it runs standalone
 * as an extension page.
 */
(function () {
  const DEFAULTS = { outlookEnabled: true, geminiEnabled: true };
  const KEYS = Object.keys(DEFAULTS);

  const els = {
    outlookEnabled: document.getElementById('outlookEnabled'),
    geminiEnabled: document.getElementById('geminiEnabled'),
    status: document.getElementById('status'),
    version: document.getElementById('version')
  };

  let statusTimer = null;
  function showStatus(msg) {
    els.status.textContent = msg;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (els.status.textContent = ''), 1500);
  }

  // Load current values into the checkboxes.
  function load() {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      const values = { ...DEFAULTS, ...items };
      KEYS.forEach((key) => {
        els[key].checked = !!values[key];
      });
    });
  }

  // Persist a single toggle when the user flips it.
  function bind(key) {
    els[key].addEventListener('change', () => {
      const value = els[key].checked;
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Could not save. Try again.');
          return;
        }
        showStatus('Saved');
      });
    });
  }

  // Keep the UI in sync if changed elsewhere (e.g. another synced device).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    KEYS.forEach((key) => {
      if (changes[key]) els[key].checked = !!changes[key].newValue;
    });
  });

  function showVersion() {
    try {
      els.version.textContent = `Version ${chrome.runtime.getManifest().version}`;
    } catch (e) {
      /* no-op */
    }
  }

  KEYS.forEach(bind);
  load();
  showVersion();
})();
