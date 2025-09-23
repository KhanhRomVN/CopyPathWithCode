import * as vscode from 'vscode';
import * as path from 'path';
import { state, CopiedFile, ErrorInfo } from '../../models/models';
import { Logger } from '../../utils/common/logger';
import { CommandRegistry } from '../../utils/common/CommandRegistry';

// Signature for tracking extension content
const TRACKING_SIGNATURE = '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';

export function registerCoreCommands(context: vscode.ExtensionContext) {
    // Copy commands
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContent',
        async () => {
            await copyPathWithContent();
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContentAndError',
        async () => {
            await copyPathWithContentAndError();
        }
    );

    // Clear system clipboard (Ctrl+Alt+Z)
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearClipboard',
        clearClipboard
    );

    // Refresh command remains the same
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.refreshClipboardView',
        () => {
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles',
                state.clipboardFiles.length > 0);
        }
    );
}

async function copyPathWithContent() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            Logger.warn('No active text editor found');
            vscode.window.showWarningMessage('No active text editor found');
            return;
        }

        const document = editor.document;
        const filePath = document.uri.fsPath;

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
        }

        let content: string;
        const sel = editor.selection;
        if (!sel.isEmpty) {
            content = document.getText(sel);
            const startLine = sel.start.line + 1;
            const endLine = sel.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
        } else {
            content = document.getText();
        }

        // Format content for normal copy
        const formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;

        // Remove any existing file with same basePath (regardless of format)
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        const afterCount = state.copiedFiles.length;

        const copiedFile: CopiedFile = {
            displayPath,
            basePath,
            content: formattedContent,
            format: 'normal'
        };

        // Save to system clipboard
        state.copiedFiles.push(copiedFile);
        await updateClipboardWithSignature();

        const count = state.copiedFiles.length;
        vscode.window.showInformationMessage(`Copied ${count} file${count > 1 ? 's' : ''} to clipboard`);

        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to copy content', err);
        vscode.window.showErrorMessage(`Failed to copy: ${msg}`);
    }
}

async function copyPathWithContentAndError() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            Logger.warn('No active text editor found for error copy');
            vscode.window.showWarningMessage('No active text editor found');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const filePath = document.uri.fsPath;

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
        }

        let content: string;
        if (!selection.isEmpty) {
            content = document.getText(selection);
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
        } else {
            content = document.getText();
        }

        // Get errors and warnings from Problems panel for this document
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errors: ErrorInfo[] = [];
        let errorCounter = 1;

        diagnostics.forEach(diagnostic => {
            if (diagnostic.severity <= 1) {
                if (selection.isEmpty || diagnostic.range.intersection(selection)) {
                    const line = diagnostic.range.start.line;
                    errors.push({
                        message: diagnostic.message,
                        line: line + 1,
                        content: document.lineAt(line).text.trim(),
                        severity: diagnostic.severity,
                        index: errorCounter++
                    });
                }
            }
        });


        let formattedContent: string;
        if (errors.length > 0) {
            const errorString = errors.map(err =>
                `${err.index}. ${err.message} | ${err.line} | ${err.content}`
            ).join('\n');

            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\n${errorString}\n\`\`\``;
        } else {
            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
        }

        // Remove any existing file with same basePath
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        const afterCount = state.copiedFiles.length;

        const copiedFile: CopiedFile = {
            displayPath,
            basePath,
            content: formattedContent,
            format: 'error'
        };

        // Save to system clipboard
        state.copiedFiles.push(copiedFile);
        await updateClipboardWithSignature();

        const count = state.copiedFiles.length;
        const errorCount = errors.length;

        vscode.window.showInformationMessage(
            `Copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`
        );

        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to copy with error info', err);
        vscode.window.showErrorMessage(`Failed to copy with error info: ${msg}`);
    }
}

// Clear system clipboard (Ctrl+Alt+Z)
async function clearClipboard() {
    try {
        const beforeCount = state.copiedFiles.length;

        // Clear system clipboard
        state.copiedFiles.length = 0;
        state.clipboardFiles = [];
        await vscode.env.clipboard.writeText('');

        vscode.window.showInformationMessage('Cleared system clipboard');

        // Force statusbar hide after clearing
        if (state.statusBarItem) {
            state.statusBarItem.hide();
        }

        // Refresh the clipboard view
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');

        // Force update status bar to reflect cleared state
        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to clear clipboard', err);
        vscode.window.showErrorMessage(`Failed to clear clipboard: ${msg}`);
    }
}

async function updateClipboardWithSignature() {
    const combined = state.copiedFiles
        .map(f => f.content)
        .join('\n\n---\n\n');

    const finalContent = combined + '\n' + TRACKING_SIGNATURE;
    await vscode.env.clipboard.writeText(finalContent);
}

function updateStatusBar() {
    if (state.statusBarItem) {
        const copiedCount = state.copiedFiles.length;

        // Only show statusbar if there are actually files
        if (copiedCount > 0) {
            state.statusBarItem.text = `$(clippy) ${copiedCount} file${copiedCount > 1 ? 's' : ''}`;
            state.statusBarItem.show();
        } else {
            // Hide statusbar when no files exist
            state.statusBarItem.hide();
        }
    }
}