# Copy Path with Code 📋✨

A powerful Visual Studio Code extension that allows you to copy file paths along with their content, organize files into folders, and manage clipboard content efficiently.

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌟 Features

### 🎯 Core Copying Capabilities

- **Copy file paths with content** in formatted markdown-style code blocks
- **Support for selections** - copy specific code sections with line numbers
- **Error information inclusion** - include error messages and line context
- **Multi-file accumulation** - collect multiple files in clipboard

### 📁 Advanced Folder Management

- **Create custom folders** to organize related files
- **Visual file browser** with tree view interface
- **Batch file operations** - add/remove multiple files at once
- **Workspace and global views** - switch between workspace-specific and all folders

### 🔄 Clipboard Management

- **Temporary storage** - save and restore clipboard contents
- **Clipboard detection** - automatically parse and display files from clipboard
- **Clipboard integrity checking** - ensure your copied content remains intact
- **Visual clipboard queue** - see all detected files in a dedicated panel

### 🔍 Search & Navigation

- **Search filtering** - find files and folders quickly
- **File context menus** - full right-click support for file operations
- **Directory expansion** - navigate through folder structures easily

## 🚀 Quick Start

### Installation

1. Open VS Code Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for "Copy Path with Code"
3. Click Install and reload VS Code

### Basic Usage

1. **Open any file** in your editor
2. **Select text** (optional) or keep cursor for full file
3. **Press `Ctrl+Alt+C`** (Win/Linux) or `Cmd+Alt+C` (Mac)
4. **Paste anywhere** - get formatted output with path and code!

## ⌨️ Keyboard Shortcuts

| Action                | Windows/Linux | macOS       |
| --------------------- | ------------- | ----------- |
| Copy Path and Content | `Ctrl+Alt+C`  | `Cmd+Alt+C` |
| Copy with Error Info  | `Ctrl+Alt+A`  | `Cmd+Alt+A` |
| Clear Clipboard       | `Ctrl+Alt+Z`  | `Cmd+Alt+Z` |
| Save to Temp Storage  | `Ctrl+Alt+Q`  | `Cmd+Alt+Q` |
| Restore from Temp     | `Ctrl+Alt+E`  | `Cmd+Alt+E` |

## 📁 Folder Management

### Creating Folders

1. Click the **folder icon** in activity bar to open Code Folders view
2. Click the **+ button** to create new folder
3. Choose to start empty or include currently open files

### File Operations

- **Add files**: Right-click folder → "Add Files to Folder"
- **Remove files**: Right-click folder → "Remove Files from Folder"
- **Open all files**: Right-click folder → "Open Folder Files"
- **Copy folder contents**: Right-click folder → "Copy Folder Contents"

## 🔄 Clipboard Features

### Temporary Storage

- **Save current clipboard** to temporary storage for later use
- **Restore previously saved** clipboard contents when needed
- **Status bar indicators** show current and temp file counts

### Clipboard Detection

- **Automatic parsing** of files copied to system clipboard
- **Visual file queue** in Clipboard Files panel (Explorer view)
- **File preview support** - click to open detected files

## 🎨 Interface Overview

### Views

- **Code Folders** - Manage your organized file collections
- **Clipboard Files** - View files detected from clipboard (when available)

### Status Bar

- Shows current copied file count
- Indicates temporary storage status
- Provides quick access to common actions

## ⚙️ Configuration

Access settings via VS Code Settings (`Ctrl+,` / `Cmd+,`):

- `copyPathWithCode.enableClipboardDetection` - Toggle automatic detection
- `copyPathWithCode.showFileCount` - Show file counts in UI
- `copyPathWithCode.searchCaseSensitive` - Case-sensitive search options

## 📝 Release Notes

### Version 1.0.1

- Enhanced folder management system
- Improved clipboard detection and parsing
- Better cross-workspace file handling
- Optimized performance and stability

## 🤝 Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/khanhromvn/copy-path-with-code).

## 📄 License

MIT License - see LICENSE file for details.

---

**Happy coding!** 🎉
