'use strict';

// Extension configuration
const CONFIG = {
  VERSION: '1.0.0',
  DEBUG: false, // Set to false in production
  OBSERVER_THROTTLE_MS: 100
};

// Logging utility
const Logger = {
  info: (msg) => CONFIG.DEBUG && console.log(`OWRTL [${CONFIG.VERSION}]: ${msg}`),
  error: (msg, err) => console.error(`OWRTL [${CONFIG.VERSION}] Error: ${msg}`, err)
};

/**
 * Throttle function to limit the rate of function calls
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Moves the cursor to the right side of the element and sets RTL direction
 * @param {HTMLElement} element - The element to set cursor position in
 * @returns {boolean} - Whether the operation was successful
 */
function setCursorToRightSide(element) {
  try {
    if (!element || !(element instanceof HTMLElement)) {
      Logger.error('Invalid element provided');
      return false;
    }

    // Set RTL direction
    element.dir = 'rtl';

    // Move cursor to the right
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
 * Find compose pane elements using multiple strategies
 * @returns {HTMLElement[]} - Array of found compose pane elements
 */
function findComposePanes() {
  const found = new Set();

  // Exclude patterns for To/Cc/Bcc address fields
  const isAddressField = (el) => {
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    const role = el.getAttribute('role') || '';
    // Address fields typically have aria-label like "To", "Cc", "Bcc" or Hebrew equivalents
    const addressLabels = ['to', 'cc', 'bcc', 'אל', 'עותק', 'עותק מוסתר'];
    if (addressLabels.includes(label.trim())) return true;
    // Address fields often have a combobox-like role or are inside a picker
    if (role === 'combobox') return true;
    if (el.closest('[role="combobox"]')) return true;
    // Check for people picker containers
    if (el.closest('[aria-label="To"]') || el.closest('[aria-label="Cc"]') || el.closest('[aria-label="Bcc"]')) return true;
    return false;
  };

  // Strategy 1: EditorClass pattern (seen in current Outlook DOM — most specific)
  document.querySelectorAll('[class*="EditorClass"]').forEach(el => {
    if (!isAddressField(el)) found.add(el);
  });

  // Strategy 2: ARIA textbox that looks like a message body (not an address field)
  document.querySelectorAll('[role="textbox"][contenteditable="true"][aria-multiline="true"]').forEach(el => {
    if (!isAddressField(el)) found.add(el);
  });

  // Strategy 3: contenteditable divs with message/body aria-label
  document.querySelectorAll('div[contenteditable="true"][aria-label]').forEach(el => {
    const label = (el.getAttribute('aria-label') || '').toLowerCase();
    if (label.includes('message') || label.includes('body') || label.includes('הודעה')) {
      found.add(el);
    }
  });

  return Array.from(found);
}

/**
 * Sets up the compose pane event listener
 * @param {HTMLElement} composerPane - The compose pane element
 */
function setupComposePane(composerPane) {
  if (!composerPane || !(composerPane instanceof HTMLElement)) {
    Logger.error('Invalid composer pane element');
    return;
  }

  // Skip if we've already handled this pane
  if (composerPane.dataset.owrtlHandled) {
    return;
  }

  Logger.info(`Found compose pane: tag=${composerPane.tagName}, role=${composerPane.getAttribute('role')}, class=${composerPane.className.substring(0, 80)}`);

  // Apply RTL and Hebrew language immediately
  composerPane.dir = 'rtl';
  composerPane.lang = 'he';
  composerPane.style.direction = 'rtl';
  composerPane.style.textAlign = 'right';
  composerPane.dataset.owrtlHandled = 'true';
  Logger.info('Applied RTL direction to compose pane');

  // Also set cursor when focused
  const handleFocus = () => {
    Logger.info('Compose pane focused');
    setCursorToRightSide(composerPane);
  };

  composerPane.addEventListener('focus', handleFocus);
  
  // If already focused, apply now
  if (document.activeElement === composerPane) {
    setCursorToRightSide(composerPane);
  }
}

// Global observer reference for cleanup
let observer = null;

/**
 * Initialize the mutation observer
 */
function initObserver() {
  try {
    observer = new MutationObserver(
      throttle((mutations) => {
        try {
          findComposePanes().forEach(pane => setupComposePane(pane));
        } catch (err) {
          Logger.error('Error in mutation observer callback', err);
        }
      }, CONFIG.OBSERVER_THROTTLE_MS)
    );

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Also listen for focus events as a backup detection method
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (el && el.isContentEditable && !el.dataset.owrtlHandled) {
        Logger.info('Detected focusin on contenteditable element');
        findComposePanes().forEach(pane => setupComposePane(pane));
      }
    });
    
    Logger.info('Observer and focusin listener started');
  } catch (err) {
    Logger.error('Error starting observer', err);
  }
}

/**
 * Cleanup function to remove observers and event listeners
 */
function cleanup() {
  try {
    if (observer) {
      observer.disconnect();
      observer = null;
      Logger.info('Observer disconnected during cleanup');
    }
  } catch (err) {
    Logger.error('Error during cleanup', err);
  }
}

// Initialize extension
Logger.info('Script loaded');

/**
 * Start the observer as soon as document.body is available
 */
function startWhenReady() {
  if (document.body) {
    Logger.info('Body available, starting observer');
    initObserver();
  } else {
    Logger.info('Body not ready, waiting...');
    const bodyObserver = new MutationObserver(() => {
      if (document.body) {
        bodyObserver.disconnect();
        Logger.info('Body now available, starting observer');
        initObserver();
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true });
  }
}

// Try to start immediately, on DOMContentLoaded, and on load — whichever fires first
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhenReady);
} else {
  startWhenReady();
}

// Cleanup on window unload
window.addEventListener('unload', cleanup);
