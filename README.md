# Copy Path with Code 📋✨

A powerful Visual Studio Code extension that revolutionizes how you copy and manage code snippets with their file paths. Perfect for developers who need to share code with context!

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-brightgreen)
![Version](https://img.shields.io/badge/version-0.0.7-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌟 Features

### 🎯 Core Copying Capabilities

- **Smart Path + Content Copying** - Copy file paths along with their content in one action
- **Selective Copying** - Copy specific code selections with precise line numbers
- **Multi-file Support** - Accumulate multiple files in clipboard with automatic deduplication
- **Error-Enhanced Copying** - Special formatting for error messages with line context

### 📁 Advanced Folder Management

- **Code Folders** - Organize related files into custom folders
- **Visual File Browser** - Interactive webview for adding/removing files from folders
- **Batch Operations** - Open all files in a folder or copy their entire contents
- **Smart Organization** - Color-coded folders with intuitive management

### ⌨️ Keyboard Shortcuts

| Action                     | Windows/Linux      | macOS             |
| -------------------------- | ------------------ | ----------------- |
| Copy Path and Content      | `Ctrl+Alt+C`       | `Cmd+Alt+C`       |
| Copy with Error Formatting | `Ctrl+Alt+A`       | `Cmd+Alt+A`       |
| Clear Clipboard            | `Ctrl+Alt+Z`       | `Cmd+Alt+Z`       |
| Add to Folder              | `Ctrl+Alt+Shift+A` | `Cmd+Alt+Shift+A` |
| Remove from Folder         | `Ctrl+Alt+D`       | `Cmd+Alt+D`       |

## 🚀 Quick Start

### Basic Usage

1. **Open any file** in VS Code
2. **Click inside the editor** to activate the text area
3. **Select text** (optional) or keep cursor position for full file
4. **Press `Ctrl+Alt+C`** (Win/Linux) or `Cmd+Alt+C` (Mac)
5. **Paste anywhere** - get formatted output with path and content!

### Output Format

```
relative/path/to/file.js:15-20

function example() {
  return "This code was copied with context!";
}

---

another/file.py

def hello_world():
    print("Hello from Python!")
```

## 📁 Folder Management Guide

### Creating Code Folders

1. Click the **folder icon** in the activity bar to open Code Folders view
2. Click the **+ button** to create a new folder
3. Name your folder and it will automatically include currently open files

### Managing Files in Folders

- **Add Files**: Use the webview interface to browse and select files
- **Remove Files**: Cleanly remove files from folders while keeping the folder intact
- **Batch Operations**: Open all folder files or copy their contents with one click

### Folder Context Menu

Right-click any folder to access:

- 📝 Rename Folder
- ➕ Add Files to Folder
- ➖ Remove Files from Folder
- 📂 Open All Folder Files
- 📋 Copy All Folder Contents
- 🗑️ Delete Folder

## 🎨 Advanced Features

### Error-Enhanced Copying

Use `Ctrl+Alt+A` to copy code with special error formatting that captures:

- Error messages
- Line numbers
- Contextual code content

### Smart Clipboard Management

- **Visual Counter**: Status bar shows how many files are in clipboard
- **One-Click Clear**: Quickly reset your clipboard with the clear shortcut
- **Duplicate Prevention**: Automatic detection and replacement of same-file content

### Theme-Aware Interface

- Adapts to your VS Code theme (light/dark/high contrast)
- Consistent with VS Code design language
- Accessible color schemes and contrast ratios

## ⚙️ Installation

1. Open **Extensions** in VS Code (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **"Copy Path with Code"**
3. Click **Install**
4. Reload VS Code when prompted

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/khanhromvn/copy-path-with-code.git

# Navigate to extension directory
cd copy-path-with-code

# Install dependencies
npm install

# Package and install
vsce package
code --install-extension copy-path-with-code-0.0.7.vsix
```

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

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
npm install
npm run compile
npm run watch  # For development with auto-recompile
```

## 📝 Release Notes

### Version 0.0.7

- ✅ Added comprehensive folder management system
- ✅ Implemented interactive webview for file selection
- ✅ Added theme-aware UI components
- ✅ Enhanced error formatting capabilities
- ✅ Improved keyboard shortcut coverage

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
