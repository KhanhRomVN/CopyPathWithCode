# Copy Path with Code 📋✨

A powerful Visual Studio Code extension that revolutionizes how you copy and manage code snippets with their file paths. Perfect for developers who need to share code with context, create documentation, or organize related files efficiently.

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-brightgreen)
![Version](https://img.shields.io/badge/version-0.0.8-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/khanhromvn.copy-path-with-code)

## 🌟 Features

### 🎯 Core Copying Capabilities

- **Smart Path + Content Copying** - Copy file paths along with their content in one action
- **Selective Copying** - Copy specific code selections with precise line numbers
- **Multi-file Support** - Accumulate multiple files in clipboard with automatic deduplication
- **Error-Enhanced Copying** - Special formatting for error messages with line context
- **Clipboard Detection** - Automatically detect and parse files from clipboard content

### 📁 Advanced Folder Management

- **Code Folders** - Organize related files into custom folders
- **Visual File Browser** - Interactive webview for adding/removing files from folders
- **Batch Operations** - Open all files in a folder or copy their entire contents
- **Smart Organization** - Color-coded folders with intuitive management

### 🔄 Clipboard Management

- **Temporary Storage** - Save and restore clipboard contents with `Ctrl+Alt+Q`/`Ctrl+Alt+E`
- **Clipboard Monitoring** - Real-time detection of files copied to clipboard
- **Visual Queue** - View and manage detected files in the Clipboard Files panel
- **File Previews** - Quick preview of detected clipboard files

### 📊 Status & Feedback

- **Visual Counter** - Status bar shows current clipboard file count
- **Temporary Storage Indicator** - See how many files are saved in temp storage
- **Extension Logs** - Access detailed logs for debugging purposes

## 🚀 Quick Start

### Installation

1. Open **Extensions** in VS Code (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **"Copy Path with Code"**
3. Click **Install**
4. Reload VS Code when prompted

### Basic Usage

1. **Open any file** in VS Code
2. **Click inside the editor** to activate the text area
3. **Select text** (optional) or keep cursor position for full file
4. **Press `Ctrl+Alt+C`** (Win/Linux) or `Cmd+Alt+C` (Mac)
5. **Paste anywhere** - get formatted output with path and content!

### Output Format

```
relative/path/to/file.js:15-20
```

```javascript
function example() {
  return "This code was copied with context!";
}
```

```
---
another/file.py
```

```python
def hello_world():
    print("Hello from Python!")
```

## ⌨️ Keyboard Shortcuts

| Action                     | Windows/Linux      | macOS             | Description                         |
| -------------------------- | ------------------ | ----------------- | ----------------------------------- |
| Copy Path and Content      | `Ctrl+Alt+C`       | `Cmd+Alt+C`       | Copy file path with content         |
| Copy with Error Formatting | `Ctrl+Alt+A`       | `Cmd+Alt+A`       | Copy with error information         |
| Clear Clipboard            | `Ctrl+Alt+Z`       | `Cmd+Alt+Z`       | Clear all copied files              |
| Add to Folder              | `Ctrl+Alt+Shift+A` | `Cmd+Alt+Shift+A` | Add current file to folder          |
| Remove from Folder         | `Ctrl+Alt+D`       | `Cmd+Alt+D`       | Remove current file from folder     |
| Clear Clipboard Queue      | `Ctrl+Alt+Shift+Z` | `Cmd+Alt+Shift+Z` | Clear detected clipboard files      |
| Save to Temp               | `Ctrl+Alt+Q`       | `Cmd+Alt+Q`       | Save clipboard to temporary storage |
| Restore from Temp          | `Ctrl+Alt+E`       | `Cmd+Alt+E`       | Restore from temporary storage      |

## 📁 Folder Management Guide

### Creating Code Folders

1. Click the **folder icon** in the activity bar to open Code Folders view
2. Click the **+ button** to create a new folder
3. Name your folder and it will automatically include currently open files

### Managing Files in Folders

- **Add Files**: Right-click folder → "Add File to Folder" or use webview interface
- **Remove Files**: Right-click folder → "Remove File from Folder"
- **Batch Operations**: Open all folder files or copy their contents with one click

### Folder Context Menu

Right-click any folder to access:

- 📝 Rename Folder
- ➕ Add Files to Folder
- ➖ Remove Files from Folder
- 📂 Open All Folder Files
- 📋 Copy All Folder Contents
- 🗑️ Delete Folder

## 🔄 Clipboard Features

### Temporary Storage

- **Save Current Clipboard**: `Ctrl+Alt+Q` - Moves current clipboard to temp storage
- **Restore from Temp**: `Ctrl+Alt+E` - Restores previously saved clipboard
- **Visual Indicator**: Status bar shows temp file count

### Clipboard Detection

- **Automatic Parsing**: Extension automatically detects files copied to clipboard
- **Visual Queue**: View detected files in "Clipboard Files" panel in Explorer
- **File Previews**: Click any detected file to open a preview

### Managing Detected Files

- **Clear Queue**: `Ctrl+Alt+Shift+Z` to clear all detected files
- **Toggle Detection**: Use command palette to enable/disable auto-detection

## 🎨 Interface Overview

### Activity Bar Components

1. **Code Folders View** (Folder icon) - Manage your code folders
2. **Clipboard Files Panel** (in Explorer) - View detected clipboard files

### Status Bar Indicators

- **$(clippy) 3 files** - Current clipboard file count
- **$(archive) Temp: 2 files** - Files in temporary storage

### Command Palette Commands

Access all features via Command Palette (`Ctrl+Shift+P`):

- `Copy Path with Code: Copy Path and Content`
- `Copy Path with Code: Show Extension Logs`
- `Copy Path with Code: Toggle Clipboard Detection`
- And many more...

## ⚙️ Configuration

### Extension Settings

```json
{
  "copyPathWithCode.enableClipboardDetection": true
}
```

### Customizing Behavior

- Enable/disable automatic clipboard detection
- Access extension logs for debugging
- Manage keyboard shortcuts through VS Code keybindings

## 🐛 Troubleshooting

### Common Issues

**Shortcuts don't work?**

- Ensure you've clicked inside the editor area first
- Check for shortcut conflicts in VS Code Keyboard Shortcuts (`Ctrl+K Ctrl+S`)

**Webview not loading?**

- Try reloading VS Code (`Ctrl+Shift+P` > "Developer: Reload Window")

**Clipboard issues?**

- Check if you have clipboard permission granted to VS Code

### Performance Tips

- For folders with many large files, use the "Open Folder Files" feature instead of copying all content
- Clear clipboard regularly when working with large codebases
- Use temporary storage to preserve clipboard contents between sessions

### Getting Help

1. Check the **Extension Logs** via command palette
2. Ensure you're using the latest version
3. Check existing issues on [GitHub](https://github.com/khanhromvn/copy-path-with-code/issues)

## 🔧 Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/khanhromvn/copy-path-with-code.git

# Install dependencies
npm install

# Build in development mode
npm run compile

# Build for production
npm run package
```

### Project Structure

```
src/
├── commands/          # Command handlers
├── models/           # Data models and state
├── providers/        # Tree view providers
├── utils/           # Utility functions
├── views/           # Webview components
└── extension.ts     # Extension entry point
```

## 📝 Release Notes

### Version 0.0.8

- ✅ Added temporary clipboard storage functionality
- ✅ Enhanced clipboard detection and parsing
- ✅ Improved file preview capabilities
- ✅ Added comprehensive status bar indicators
- ✅ Fixed various bugs and performance issues

### Version 0.0.8

- ✅ Added clipboard file detection system
- ✅ Implemented clipboard tree view
- ✅ Added file preview functionality
- ✅ Enhanced error handling and logging

### Version 0.0.7

- ✅ Added comprehensive folder management system
- ✅ Implemented interactive webview for file selection
- ✅ Added theme-aware UI components
- ✅ Enhanced error formatting capabilities

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain consistent code style
- Add appropriate logging
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- VS Code Extension API team
- All contributors and testers
- The open source community for inspiration and support

---

**Happy Coding!** 🎉 If you find this extension helpful, please consider giving it a ⭐ on [GitHub](https://github.com/khanhromvn/copy-path-with-code)!

---

_Note: This extension works best when you have the editor focused. Simply selecting a file in the explorer won't activate the extension shortcuts._

### Support

For bugs, feature requests, or questions:

- 📧 Create an issue on [GitHub](https://github.com/khanhromvn/copy-path-with-code/issues)
- 💬 Check existing discussions and solutions

**Enjoy using Copy Path with Code!** 🚀
