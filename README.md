# Copy Path with Code

A Visual Studio Code extension that allows you to copy both the relative file path and its content with a single keyboard shortcut.

## Features

- Copy file path and content to clipboard
- Support for copying selected text portions with line numbers
- Multiple file copying with automatic duplicate handling
- Clear clipboard with a single shortcut
- Uses keyboard shortcuts:
  - `Ctrl+Alt+C` (Windows/Linux) or `Cmd+Alt+C` (Mac) to copy
  - `Ctrl+Alt+Z` (Windows/Linux) or `Cmd+Alt+Z` (Mac) to clear clipboard
- Works in any text editor within VS Code and VS Code-based IDEs

## Important Note

⚠️ You must click inside the code area of the file (make the text editor active) before using the extension shortcuts. Simply selecting a file in the explorer panel is not sufficient.

## Usage

1. Open any file in VS Code
2. Click inside the file's code area to make it active
3. Select text (optional) or copy entire file
4. Press `Ctrl+Alt+C` (Windows/Linux) or `Cmd+Alt+C` (Mac)
5. The file's path and content will be copied to your clipboard in the format:
```
path/to/file.ext:1-5 (if text selected)

[selected content]

---

another/path/to/file.ext

[entire file content]
```
6. Press `Ctrl+Alt+Z` to clear all copied content

## Requirements

- Visual Studio Code version 1.50.0 or higher

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial release:
- Copy file path with content
- Support for selected text portions
- Multiple file copying
- Clear clipboard shortcut
