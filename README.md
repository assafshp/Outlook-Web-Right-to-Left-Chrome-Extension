# Outlook Web & Gemini Enterprise Right-to-Left Chrome Extension

A Chrome extension that automatically applies Right-to-Left (RTL) text direction where it matters for Hebrew (and other RTL) users:

- **Outlook Web** — sets RTL direction and positions the cursor on the right side in the email compose window.
- **Gemini Enterprise (Vertex AI Search)** — sets RTL direction for the conversation area, so Hebrew answers align to the right instead of clinging to the left edge.

Each integration can be turned on or off independently from the extension's settings page.

## Features

- Automatically detects Outlook email compose windows and applies RTL + right-side cursor
- Applies RTL to Gemini Enterprise conversations on `vertexaisearch.cloud.google`
- Per-site toggles: enable/disable Outlook and Gemini independently (both on by default)
- Live updates — toggling a setting takes effect without reloading (newly rendered content)
- Narrowly scoped: only runs on the declared hosts and only touches the relevant elements
- Minimal permissions (`storage` only), error handling, and performance throttling

## Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store page](#)
2. Click "Add to Chrome"
3. Click "Add Extension" in the popup

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

### Outlook Web
1. Go to [Outlook Web App](https://outlook.office.com/mail/)
2. Click "New email" or "Reply" to any email
3. Move your cursor to the email body — it positions on the right side
4. Start typing in Hebrew

### Gemini Enterprise
1. Open your Gemini Enterprise / Vertex AI Search workspace on `vertexaisearch.cloud.google`
2. Open or start a conversation
3. Hebrew answers are displayed Right-to-Left, aligned to the right

### Settings
Open `chrome://extensions/`, find this extension, click **Details → Extension options** (or right-click the extension icon → **Options**). Toggle Outlook and Gemini independently.

## Requirements

- Google Chrome version 88 or later
- Access to Outlook Web App and/or Gemini Enterprise (Vertex AI Search)

## Privacy & Security

- No data collection, no external services
- Only permission used is `storage`, to remember your two on/off preferences
- Content scripts run **only** on the declared Outlook mail hosts and on the `vertexaisearch.cloud.google` hosts — no other site is affected
- On each site, only the relevant elements (the Outlook compose body / the Gemini conversation area) are modified

## Development

### Project Structure
```
Outlook-Web-Right-to-Left-Chrome-Extension/
├── manifest.json      # Extension configuration (MV3)
├── background.js      # Background service worker (install handling)
├── common.js          # Shared utilities: logger, throttle, settings (window.OWRTL)
├── outlook.js         # Outlook Web RTL content script
├── gemini.js          # Gemini Enterprise RTL content script
├── options.html       # Settings page UI
├── options.js         # Settings page logic
└── icons/             # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### How it works
- `common.js` is injected before each site script and exposes `window.OWRTL`
  (`CONFIG`, `Logger`, `throttle`, `Settings`). The version is read from the
  manifest so it never drifts.
- `outlook.js` and `gemini.js` each read their own setting
  (`outlookEnabled` / `geminiEnabled`), apply RTL via a `MutationObserver`, and
  subscribe to `chrome.storage.onChanged` to react to toggles live.
- `options.html` / `options.js` provide the per-site toggles, persisted in
  `chrome.storage.sync`.

### Building from Source
1. Clone the repository
2. Make your changes (set `DEBUG: true` in `common.js` for verbose logs)
3. Test locally using Chrome's developer mode
4. Create a pull request

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/assafshp/Outlook-Web-Right-to-Left-Chrome-Extension/issues) on GitHub.

## Version History

- **1.1.0**
  - Added Right-to-Left support for Gemini Enterprise (Vertex AI Search)
  - Added a settings page with independent per-site toggles (Outlook / Gemini)
  - Refactored into shared (`common.js`) + per-site modules (`outlook.js`, `gemini.js`)
  - Version is now sourced from the manifest to avoid drift
- **1.0.4**
  - Outlook Web RTL compose support across Outlook mail hosts
- **1.0.0**
  - Initial release: basic RTL support for new emails and replies
