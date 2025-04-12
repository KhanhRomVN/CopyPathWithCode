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
            const content = document.getText();

            // Get relative path if possible
            let displayPath = filePath;
            if (vscode.workspace.workspaceFolders) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0];
                if (workspaceFolder) {
                    displayPath = path.relative(workspaceFolder.uri.fsPath, filePath);
                }
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

                // Select all text
                const lastLine = document.lineCount - 1;
                const lastChar = document.lineAt(lastLine).text.length;
                editor.selection = new vscode.Selection(0, 0, lastLine, lastChar);

                // Copy current content
                await vscode.commands.executeCommand('editor.action.clipboardCopyAction');

                // Restore selection and view
                editor.selection = currentSelection;
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
