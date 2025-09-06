# Lotus Forum Thread Exporter

A Chrome extension that exports WoltLab Lotus Forum threads as beautifully formatted PDF documents.

## Features

- 🏎️ **British Racing Green Theme** - Elegant PDF styling
- 📄 **Complete Thread Export** - All pages and posts included
- 📎 **Attachment Support** - Links to attachments and media
- 💬 **Quote Preservation** - Maintains quoted content structure
- 🎯 **Smart Detection** - Automatically detects WoltLab threads
- ⚡ **One-Click Export** - Simple button integration
- 📊 **Export History** - Track your exports with statistics

## Installation

### From Chrome Web Store
*Coming soon...*

### Manual Installation
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will appear in your extensions list

## Usage

1. Navigate to any WoltLab Lotus Forum thread
2. Look for the 📥 export button in the thread interface
3. Click the button to export the thread as PDF
4. The PDF will download automatically with all posts and formatting

## Technical Details

- **Manifest V3** - Latest Chrome extension standard
- **html2pdf.js** - PDF generation engine
- **Modular Architecture** - Clean, maintainable code structure
- **Chrome Storage API** - Persistent settings and history
- **CORS Handling** - Proper cross-origin resource management

## Development

### Project Structure
```
├── manifest.json          # Extension configuration
├── content.js            # Main content script
├── background.js         # Service worker
├── popup.html/css/js     # Extension popup
├── styles.css           # Thread button styling
└── js/
    ├── config.js        # Configuration constants
    ├── logger.js        # Logging system
    ├── thread-detector.js    # Thread detection logic
    ├── thread-scraper.js     # Content scraping
    ├── pdf-generator.js      # PDF generation
    └── ui-manager.js         # UI management
```

### Building
No build process required - the extension runs directly from source files.

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and feature requests, please use the GitHub Issues tab.

---

Made for [lotus-forum.de](https://www.lotus-forum.de/) 🏎️
