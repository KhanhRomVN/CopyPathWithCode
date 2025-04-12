import * as vscode from 'vscode';
import * as path from 'path';

interface CopiedFile {
    displayPath: string;
    basePath: string;  // Store base path without line numbers
    content: string;
}

let copiedFiles: CopiedFile[] = [];

export function activate(context: vscode.ExtensionContext) {
    // Command to copy path with content
    let copyDisposable = vscode.commands.registerCommand('copy-path-with-code.copyPathWithContent', async () => {
        try {
            // Get the active editor
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            // Get basic file information
            const document = editor.document;
            const filePath = document.uri.fsPath;

            // Get relative path if possible
            let displayPath = filePath;
            let basePath = filePath;
            if (vscode.workspace.workspaceFolders) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0];
                if (workspaceFolder) {
                    displayPath = path.relative(workspaceFolder.uri.fsPath, filePath);
                    basePath = displayPath;
                }
            }

            // Get content based on selection
            let content: string;
            const selection = editor.selection;
            if (!selection.isEmpty) {
                // If there's a selection, get selected text
                content = document.getText(selection);
                // Add line numbers to the selection
                const startLine = selection.start.line + 1;
                const endLine = selection.end.line + 1;
                displayPath = `${displayPath}:${startLine}-${endLine}`;
            } else {
                // If no selection, get entire file
                content = document.getText();
            }

            // Remove any existing entries from the same file
            copiedFiles = copiedFiles.filter(file => file.basePath !== basePath);

            // Add new entry
            copiedFiles.push({ displayPath, basePath, content });

            // Combine all copied files
            const combinedContent = copiedFiles
                .map(file => `${file.displayPath}\n\n${file.content}`)
                .join('\n\n---\n\n');

            // Copy to clipboard
            await vscode.env.clipboard.writeText(combinedContent);
            
            // Show notification with count
            const fileCount = copiedFiles.length;
            vscode.window.showInformationMessage(
                `Copied ${fileCount} file${fileCount > 1 ? 's' : ''} to clipboard`
            );

        } catch (error: any) {
            const message = error.message || 'Unknown error';
            vscode.window.showErrorMessage(`Failed to copy: ${message}`);
            console.error('Error:', error);
        }
    });

    // Command to clear clipboard
    let clearDisposable = vscode.commands.registerCommand('copy-path-with-code.clearClipboard', async () => {
        try {
            copiedFiles = [];
            await vscode.env.clipboard.writeText('');
            vscode.window.showInformationMessage('Clipboard cleared');
        } catch (error: any) {
            const message = error.message || 'Unknown error';
            vscode.window.showErrorMessage(`Failed to clear clipboard: ${message}`);
            console.error('Error:', error);
        }
    });

    context.subscriptions.push(copyDisposable, clearDisposable);
}

export function deactivate() {
    copiedFiles = [];
}
