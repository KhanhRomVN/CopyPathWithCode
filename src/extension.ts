import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('copy-path-with-code.copyPathWithContent', async () => {
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
            if (vscode.workspace.workspaceFolders) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0];
                if (workspaceFolder) {
                    displayPath = path.relative(workspaceFolder.uri.fsPath, filePath);
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
                displayPath += `:${startLine}-${endLine}`;
            } else {
                // If no selection, get entire file
                content = document.getText();
            }

            // Method 1: Try direct clipboard write
            try {
                const textToCopy = `${displayPath}\n\n${content}`;
                await vscode.env.clipboard.writeText(textToCopy);
                vscode.window.showInformationMessage(`Copied: ${displayPath}`);
                return;
            } catch (e) {
                console.log('Direct clipboard write failed, trying alternative method');
            }

            // Method 2: Try through selection
            try {
                // Remember current selection and view
                const currentSelection = editor.selection;
                const currentVisible = editor.visibleRanges[0];

                if (!selection.isEmpty) {
                    // If there's already a selection, just copy it
                    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
                } else {
                    // If no selection, select and copy entire file
                    const lastLine = document.lineCount - 1;
                    const lastChar = document.lineAt(lastLine).text.length;
                    editor.selection = new vscode.Selection(0, 0, lastLine, lastChar);
                    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
                    // Restore selection
                    editor.selection = currentSelection;
                }

                // Restore view
                editor.revealRange(currentVisible);
                vscode.window.showInformationMessage(`Copied: ${displayPath}`);
                return;
            } catch (e) {
                console.log('Selection method failed');
                throw e;
            }

        } catch (error: any) {
            const message = error.message || 'Unknown error';
            vscode.window.showErrorMessage(`Failed to copy: ${message}`);
            console.error('Error:', error);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
