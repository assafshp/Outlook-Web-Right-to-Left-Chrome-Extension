'use strict';

/**
 * Outlook Web RTL content script.
 *
 * Detects the email compose body and sets Right-to-Left direction plus a
 * right-aligned caret, so Hebrew composition starts on the right side.
 *
 * Runs only on the Outlook mail hosts declared in the manifest, and only
 * touches the compose body element(s) — never the whole page.
 */
(function () {
  const { CONFIG, Logger, throttle, Settings } = window.OWRTL;

  let enabled = false;
  let observer = null;
  let focusinHandler = null;

  /**
   * Moves the cursor to the right side of the element and sets RTL direction.
   * @param {HTMLElement} element - The element to set cursor position in.
   * @returns {boolean} - Whether the operation was successful.
   */
  function setCursorToRightSide(element) {
    try {
      if (!element || !(element instanceof HTMLElement)) {
        Logger.error('Invalid element provided');
        return false;
      }

      element.dir = 'rtl';

      const range = document.createRange();
      const selection = window.getSelection();

      if (!selection) {
        Logger.error('Could not get window selection');
        return false;
      }

      try {
        range.selectNodeContents(element);
        range.collapse(false); // collapse to end (right side)

        selection.removeAllRanges();
        selection.addRange(range);

        Logger.info('Cursor moved to right side');
        return true;
      } catch (err) {
        Logger.error('Error setting cursor position', err);
        return false;
      }
    } catch (err) {
      Logger.error('Unexpected error in setCursorToRightSide', err);
      return false;
    }
  }

  /**
   * Find compose pane elements using multiple strategies.
   * @returns {HTMLElement[]} - Array of found compose pane elements.
   */
  function findComposePanes() {
    const found = new Set();

    // Exclude patterns for To/Cc/Bcc address fields.
    const isAddressField = (el) => {
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      const role = el.getAttribute('role') || '';
      const addressLabels = ['to', 'cc', 'bcc', 'אל', 'עותק', 'עותק מוסתר'];
      if (addressLabels.includes(label.trim())) return true;
      if (role === 'combobox') return true;
      if (el.closest('[role="combobox"]')) return true;
      if (el.closest('[aria-label="To"]') || el.closest('[aria-label="Cc"]') || el.closest('[aria-label="Bcc"]')) return true;
      return false;
    };

    // Strategy 1: EditorClass pattern (most specific in current Outlook DOM).
    document.querySelectorAll('[class*="EditorClass"]').forEach((el) => {
      if (!isAddressField(el)) found.add(el);
    });

    // Strategy 2: ARIA multiline textbox that looks like a message body.
    document.querySelectorAll('[role="textbox"][contenteditable="true"][aria-multiline="true"]').forEach((el) => {
      if (!isAddressField(el)) found.add(el);
    });

    // Strategy 3: contenteditable divs with a message/body aria-label.
    document.querySelectorAll('div[contenteditable="true"][aria-label]').forEach((el) => {
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('message') || label.includes('body') || label.includes('הודעה')) {
        found.add(el);
      }
    });

    return Array.from(found);
  }

  /**
   * Sets up the compose pane: applies RTL and wires focus handling.
   * @param {HTMLElement} composerPane - The compose pane element.
   */
  function setupComposePane(composerPane) {
    if (!composerPane || !(composerPane instanceof HTMLElement)) {
      Logger.error('Invalid composer pane element');
      return;
    }

    if (composerPane.dataset.owrtlHandled) {
      return;
    }

    Logger.info(`Found compose pane: tag=${composerPane.tagName}, role=${composerPane.getAttribute('role')}, class=${composerPane.className.substring(0, 80)}`);

    composerPane.dir = 'rtl';
    composerPane.lang = 'he';
    composerPane.style.direction = 'rtl';
    composerPane.style.textAlign = 'right';
    composerPane.dataset.owrtlHandled = 'true';
    Logger.info('Applied RTL direction to compose pane');

    const handleFocus = () => {
      Logger.info('Compose pane focused');
      setCursorToRightSide(composerPane);
    };

    composerPane.addEventListener('focus', handleFocus);

    if (document.activeElement === composerPane) {
      setCursorToRightSide(composerPane);
    }
  }

  /**
   * Scan the DOM and set up any compose panes found.
   */
  function applyToAll() {
    try {
      findComposePanes().forEach((pane) => setupComposePane(pane));
    } catch (err) {
      Logger.error('Error applying RTL to compose panes', err);
    }
  }

  /**
   * Initialize the mutation observer and focusin backup listener.
   */
  function startObserver() {
    if (observer) return;
    try {
      observer = new MutationObserver(
        throttle(() => {
          if (enabled) applyToAll();
        }, CONFIG.OBSERVER_THROTTLE_MS)
      );

      observer.observe(document.body, { childList: true, subtree: true });

      // Backup detection: catch contenteditable focus the observer might miss.
      focusinHandler = (e) => {
        const el = e.target;
        if (enabled && el && el.isContentEditable && !el.dataset.owrtlHandled) {
          Logger.info('Detected focusin on contenteditable element');
          applyToAll();
        }
      };
      document.addEventListener('focusin', focusinHandler);

      Logger.info('Outlook observer and focusin listener started');
    } catch (err) {
      Logger.error('Error starting observer', err);
    }
  }

  /**
   * Disconnect the observer and remove the focusin listener.
   */
  function stopObserver() {
    try {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (focusinHandler) {
        document.removeEventListener('focusin', focusinHandler);
        focusinHandler = null;
      }
      Logger.info('Outlook observer stopped');
    } catch (err) {
      Logger.error('Error during cleanup', err);
    }
  }

  /**
   * Turn the feature on or off in response to settings.
   * Note: already-applied panes stay RTL until the tab is reloaded; disabling
   * simply stops applying RTL to newly opened compose windows.
   * @param {boolean} value
   */
  function setEnabled(value) {
    enabled = !!value;
    if (enabled) {
      startObserver();
      applyToAll();
    } else {
      stopObserver();
    }
  }

  /**
   * Wait for document.body before wiring up the observer.
   * @param {Function} fn
   */
  function whenBodyReady(fn) {
    if (document.body) {
      fn();
      return;
    }
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        bodyObserver.disconnect();
        fn();
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true });
  }

  // --- Bootstrap ---
  Logger.info('Outlook script loaded');

  Settings.getAll().then((settings) => {
    whenBodyReady(() => setEnabled(settings.outlookEnabled));
  });

  // React live to the toggle in the options page.
  Settings.onChange('outlookEnabled', (newValue) => {
    Logger.info(`outlookEnabled changed to ${newValue}`);
    whenBodyReady(() => setEnabled(newValue));
  });

  window.addEventListener('unload', stopObserver);
})();
