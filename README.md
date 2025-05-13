# Outlook Web Right-to-Left Chrome Extension

A Chrome extension that automatically sets the cursor position to the right side in Outlook's email compose window, optimizing the experience for Hebrew text input.

## Features

- Automatically detects Outlook email compose windows
- Sets Right-to-Left (RTL) text direction for Hebrew typing
- Works with new emails, replies, and reply-all
- Minimal permissions required for security
- Error handling and performance optimization

## Installation

### From Chrome Web Store
1. Visit the [Outlook Web Right-to-Left Chrome Web Store page](#)
2. Click "Add to Chrome"
3. Click "Add Extension" in the popup

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Go to [Outlook Web App](https://outlook.office.com/mail/)
2. Click "New email" or "Reply" to any email
3. Move your mouse to the email body
4. The cursor will automatically position itself on the right side
5. Start typing in Hebrew!

## Requirements

- Google Chrome version 88 or later
- Access to Outlook Web App (outlook.office.com)

## Privacy & Security

- No data collection
- No external services
- Minimal permissions:
  - `activeTab`: Required for cursor positioning
  - Limited to active tab only

## Development

### Project Structure
```
outlook-web-rtl/
├── manifest.json      # Extension configuration
├── background.js      # Background service worker
├── content.js         # Main functionality
└── icons/            # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building from Source
1. Clone the repository
2. Make your changes
3. Test locally using Chrome's developer mode
4. Create a pull request

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/username/outlook-web-rtl/issues) on GitHub.

## Version History

- 1.0.0: Initial release
  - Basic RTL support
  - Outlook Web App integration
  - Support for new emails and replies
