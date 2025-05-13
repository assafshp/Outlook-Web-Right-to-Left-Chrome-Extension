'use strict';

const CONFIG = {
  VERSION: '1.0.0',
  DEBUG: false
};

const Logger = {
  info: (msg) => CONFIG.DEBUG && console.log(`OWRTL [${CONFIG.VERSION}]: ${msg}`),
  error: (msg, err) => console.error(`OWRTL [${CONFIG.VERSION}] Error: ${msg}`, err)
};

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  try {
    const installType = details.reason;
    Logger.info(`Extension installed (${installType})`);

    switch (installType) {
      case 'install':
        Logger.info('First time installation');
        break;
      case 'update':
        Logger.info(`Updated from version ${details.previousVersion} to ${CONFIG.VERSION}`);
        break;
    }
  } catch (err) {
    Logger.error('Error handling installation', err);
  }
});
