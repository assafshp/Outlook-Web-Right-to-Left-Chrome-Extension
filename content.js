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

  // Log the type of compose pane we found
  if (composerPane.classList.contains('fGO0P')) {
    Logger.info('Found reply compose pane');
  } else if (composerPane.classList.contains('z8tsM')) {
    Logger.info('Found new email compose pane');
  } else {
    Logger.info('Found compose pane (type unknown)');
  }
  
  const handleMouseEnter = () => {
    Logger.info('Mouse entered compose pane');
    
    if (setCursorToRightSide(composerPane)) {
      // Mark this pane as handled and remove the mouseenter listener
      composerPane.dataset.owrtlHandled = 'true';
      composerPane.removeEventListener('mouseenter', handleMouseEnter);
      Logger.info('Cleanup completed for this compose pane');
    }
  };

  composerPane.addEventListener('mouseenter', handleMouseEnter);
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
          const composerPane = document.querySelector('.dFCbN.dPKNh.DziEn[role="textbox"][aria-multiline="true"]');
          if (composerPane) {
            setupComposePane(composerPane);
          }
        } catch (err) {
          Logger.error('Error in mutation observer callback', err);
        }
      }, CONFIG.OBSERVER_THROTTLE_MS)
    );

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    Logger.info('Observer started and will continue running');
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

document.addEventListener('DOMContentLoaded', () => {
  Logger.info('DOM Content Loaded');
});

window.addEventListener('load', () => {
  Logger.info('Window Loaded');
  initObserver();
});

// Cleanup on window unload
window.addEventListener('unload', cleanup);
