# Copy Path with Code

A Visual Studio Code extension that allows you to copy both the relative file path and its entire content with a single keyboard shortcut.

## Features

- Copy the current file's relative path and its entire content to clipboard
- Uses keyboard shortcut: `Ctrl+Alt+C` (Windows/Linux) or `Cmd+Alt+C` (Mac)
- Works in any text editor within VS Code and VS Code-based IDEs

## Installation

### From VSIX File
1. Download the `.vsix` file
2. Run `code --install-extension copy-path-with-code-0.0.1.vsix`

### Manual Installation
1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Run `vsce package`
5. Install the generated `.vsix` file using VS Code's "Install from VSIX" command

## Usage

1. Open any file in VS Code
2. Press `Ctrl+Alt+C` (Windows/Linux) or `Cmd+Alt+C` (Mac)
3. The file's relative path and content will be copied to your clipboard in the format:
```
path/to/file.ext

[file content]
```

## Requirements

- Visual Studio Code version 1.50.0 or higher

## Extension Settings

This extension does not contribute any additional settings.

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial release:
- Basic functionality to copy file path with content
- Keyboard shortcut support
