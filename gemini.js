'use strict';

/**
 * Gemini Enterprise (Vertex AI Search) RTL content script.
 *
 * Applies Right-to-Left direction to the conversation area so Hebrew (and other
 * RTL) answers align to the right instead of clinging to the left edge.
 *
 * IMPORTANT: The Vertex AI Search chat UI renders inside a Shadow DOM
 * (a web component with an open shadow root). Regular document.querySelector
 * and a <style> in document.head do NOT reach into a shadow root, which is why
 * a naive approach has no effect. This script therefore:
 *   1. Recursively walks open shadow roots to find the conversation host(s).
 *   2. Injects a scoped stylesheet INTO each relevant shadow root (via
 *      adoptedStyleSheets when available, else a <style> element inside the
 *      root) so the rule actually applies to the shadowed content.
 *   3. Also sets an inline direction on matched elements as a fallback.
 *   4. Handles SPA navigation (pushState/replaceState/popstate) and DOM
 *      mutations so new conversation views get RTL without a page reload.
 *
 * Scope stays narrow: runs only on the vertexaisearch.cloud.google hosts
 * (declared in manifest) and only touches conversation containers.
 */
(function () {
  if (!window.OWRTL) return;

  const { CONFIG, Logger, throttle, Settings } = window.OWRTL;

  const APPLIED_ATTR = 'data-owrtl-gemini';

  // Selectors for the conversation container within any (shadow) root.
  // Observed DOM path:
  //   div.chat-mode  #shadow-root
  //     div.chat-mode-conversation-and-results
  //       div.chat-mode-conversation
  //         div.chat-mode-scroller
  //           ucs-conversation
  const CONVERSATION_SELECTORS = [
    'ucs-conversation',
    '.chat-mode-conversation',
    '.chat-mode-conversation-and-results',
    '.chat-mode-scroller'
  ];

  const CSS = CONVERSATION_SELECTORS.map(
    (s) => `${s}{direction:rtl !important;text-align:right !important;}`
  ).join('\n');

  // A constructable stylesheet we can adopt into shadow roots (and the
  // top document) cheaply. Fall back to <style> where unsupported.
  let sheet = null;
  const supportsAdopted =
    'adoptedStyleSheets' in Document.prototype &&
    'replaceSync' in CSSStyleSheet.prototype;
  if (supportsAdopted) {
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
    } catch (e) {
      sheet = null;
    }
  }

  // Track roots we've styled so we can add/remove cleanly. Uses the root
  // object itself as the key.
  const styledRoots = new Set();

  let enabled = false;
  let observer = null;

  /**
   * Collect the top document and every open shadow root reachable from it.
   * Breadth-first over hosts; each root's descendants are scanned once.
   * @returns {Array<Document|ShadowRoot>}
   */
  function collectRoots() {
    const roots = [document];
    try {
      // roots grows as we discover nested shadow roots; index-based loop
      // lets us process newly-added roots without recursion.
      for (let i = 0; i < roots.length; i += 1) {
        const root = roots[i];
        if (!root.querySelectorAll) continue;
        root.querySelectorAll('*').forEach((el) => {
          if (el.shadowRoot) roots.push(el.shadowRoot);
        });
      }
    } catch (err) {
      Logger.error('Error walking shadow roots', err);
    }
    return roots;
  }

  /**
   * Ensure the RTL stylesheet is present in a given root.
   * @param {Document|ShadowRoot} root
   */
  function styleRoot(root) {
    if (styledRoots.has(root)) return;
    try {
      if (sheet && 'adoptedStyleSheets' in root) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      } else {
        const styleEl = document.createElement('style');
        styleEl.setAttribute(APPLIED_ATTR, 'true');
        styleEl.textContent = CSS;
        (root === document ? document.head || document.documentElement : root).appendChild(styleEl);
      }
      styledRoots.add(root);
      Logger.info('Styled a root (shadow or document)');
    } catch (err) {
      Logger.error('Error styling root', err);
    }
  }

  /**
   * Remove the RTL stylesheet from every root we styled.
   */
  function unstyleAllRoots() {
    styledRoots.forEach((root) => {
      try {
        if (sheet && 'adoptedStyleSheets' in root) {
          root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== sheet);
        }
      } catch (err) {
        Logger.error('Error removing adopted sheet', err);
      }
    });
    styledRoots.clear();
    // Remove any <style> fallbacks (in document or shadow roots).
    try {
      document.querySelectorAll(`style[${APPLIED_ATTR}="true"]`).forEach((el) => el.remove());
      collectRoots().forEach((root) => {
        if (root.querySelectorAll) {
          root.querySelectorAll(`style[${APPLIED_ATTR}="true"]`).forEach((el) => el.remove());
        }
      });
    } catch (err) {
      Logger.error('Error removing style fallbacks', err);
    }
  }

  /**
   * Inline RTL fallback on a single element.
   * @param {HTMLElement} el
   */
  function applyRtl(el) {
    if (!el || !(el instanceof HTMLElement)) return;
    if (el.getAttribute(APPLIED_ATTR) === 'true') return;
    el.style.direction = 'rtl';
    el.style.textAlign = 'right';
    el.setAttribute(APPLIED_ATTR, 'true');
  }

  /**
   * Scan all roots: style each root and apply the inline fallback to every
   * matched conversation container.
   */
  function applyToAll() {
    try {
      const roots = collectRoots();
      let matched = 0;
      roots.forEach((root) => {
        styleRoot(root);
        CONVERSATION_SELECTORS.forEach((selector) => {
          if (!root.querySelectorAll) return;
          root.querySelectorAll(selector).forEach((el) => {
            applyRtl(el);
            matched += 1;
          });
        });
      });
      Logger.info(`applyToAll: ${roots.length} root(s), ${matched} matched element(s)`);
    } catch (err) {
      Logger.error('Error applying RTL', err);
    }
  }

  /**
   * Revert inline fallbacks and remove injected stylesheets.
   */
  function revertAll() {
    try {
      collectRoots().forEach((root) => {
        if (!root.querySelectorAll) return;
        root.querySelectorAll(`[${APPLIED_ATTR}="true"]`).forEach((el) => {
          if (el.tagName === 'STYLE') return;
          el.style.direction = '';
          el.style.textAlign = '';
          el.removeAttribute(APPLIED_ATTR);
        });
      });
    } catch (err) {
      Logger.error('Error reverting RTL', err);
    }
    unstyleAllRoots();
  }

  function startObserver() {
    if (observer) return;
    try {
      observer = new MutationObserver(
        throttle(() => {
          if (enabled) applyToAll();
        }, CONFIG.OBSERVER_THROTTLE_MS)
      );
      observer.observe(document.documentElement, { childList: true, subtree: true });
      Logger.info('Gemini observer started');
    } catch (err) {
      Logger.error('Error starting observer', err);
    }
  }

  function stopObserver() {
    if (!observer) return;
    try {
      observer.disconnect();
    } catch (err) {
      Logger.error('Error stopping observer', err);
    }
    observer = null;
    Logger.info('Gemini observer stopped');
  }

  /**
   * Turn the feature on or off in response to settings.
   * @param {boolean} value
   */
  function setEnabled(value) {
    enabled = !!value;
    if (enabled) {
      startObserver();
      applyToAll();
    } else {
      stopObserver();
      revertAll();
    }
  }

  /**
   * Re-run on SPA route changes (Gemini navigates without a full reload).
   */
  function watchSpaNavigation() {
    const reapply = () => {
      if (enabled) setTimeout(applyToAll, 150);
    };
    const wrap = (method) => {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        reapply();
        return result;
      };
    };
    try {
      wrap('pushState');
      wrap('replaceState');
      window.addEventListener('popstate', reapply);
      Logger.info('SPA navigation watcher attached');
    } catch (err) {
      Logger.error('Could not attach SPA navigation watcher', err);
    }
  }

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
  Logger.info('Gemini script loaded');

  Settings.getAll().then((settings) => {
    whenBodyReady(() => {
      watchSpaNavigation();
      setEnabled(settings.geminiEnabled);
    });
  });

  Settings.onChange('geminiEnabled', (newValue) => {
    Logger.info(`geminiEnabled changed to ${newValue}`);
    whenBodyReady(() => setEnabled(newValue));
  });

  window.addEventListener('unload', stopObserver);
})();
