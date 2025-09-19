// src/commands/clipboard/coreCommands.ts - FIXED VERSION
import * as vscode from 'vscode';
import * as path from 'path';
import { state, CopiedFile, ErrorInfo } from '../../models/models';
import { Logger } from '../../utils/common/logger';
import { CommandRegistry } from '../../utils/common/CommandRegistry';

// Signature for tracking extension content
const TRACKING_SIGNATURE = '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';

export function registerCoreCommands(context: vscode.ExtensionContext) {
    // Đăng ký core commands với CommandRegistry
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContent',
        copyPathWithContent
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearClipboard',
        clearClipboard
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContentAndError',
        copyPathWithContentAndError
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.refreshClipboardView',
        () => {
            // Cập nhật context cho UI
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles',
                state.clipboardFiles.length > 0);
            Logger.debug('Clipboard view refreshed');
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
        Logger.debug(`Copying content from: ${filePath}`);

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
            Logger.debug(`Using workspace relative path: ${displayPath}`);
        }

        let content: string;
        const sel = editor.selection;
        if (!sel.isEmpty) {
            content = document.getText(sel);
            const startLine = sel.start.line + 1;
            const endLine = sel.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
            Logger.debug(`Copying selection from line ${startLine} to ${endLine}`);
        } else {
            content = document.getText();
            Logger.debug('Copying entire file content');
        }

        // Format content for normal copy
        const formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;

        // Remove any existing file with same basePath (regardless of format)
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        const afterCount = state.copiedFiles.length;

        if (beforeCount !== afterCount) {
            Logger.debug(`Removed existing file entry for ${basePath}`);
        }

        const copiedFile: CopiedFile = {
            displayPath,
            basePath,
            content: formattedContent,
            format: 'normal'
        };

        state.copiedFiles.push(copiedFile);

        await updateClipboardWithSignature();

        const count = state.copiedFiles.length;
        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} to clipboard`);
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
        Logger.debug(`Copying content with error info from: ${filePath}`);

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
            Logger.debug(`Using workspace relative path: ${displayPath}`);
        }

        let content: string;
        if (!selection.isEmpty) {
            content = document.getText(selection);
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
            Logger.debug(`Copying selection from line ${startLine} to ${endLine}`);
        } else {
            content = document.getText();
            Logger.debug('Copying entire file content');
        }

        // Get errors and warnings from Problems panel for this document
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errors: ErrorInfo[] = [];
        let errorCounter = 1;

        Logger.debug(`Found ${diagnostics.length} diagnostics for document`);

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

        Logger.debug(`Processed ${errors.length} errors/warnings for inclusion`);

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

        if (beforeCount !== afterCount) {
            Logger.debug(`Removed existing file entry for ${basePath}`);
        }

        const copiedFile: CopiedFile = {
            displayPath,
            basePath,
            content: formattedContent,
            format: 'error'
        };

        state.copiedFiles.push(copiedFile);

        await updateClipboardWithSignature();

        const count = state.copiedFiles.length;
        const errorCount = errors.length;

        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`);
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

async function clearClipboard() {
    try {
        const beforeCount = state.copiedFiles.length;
        Logger.debug(`Clearing clipboard with ${beforeCount} files`);

        state.copiedFiles.length = 0;
        // Also clear clipboard detection
        state.clipboardFiles = [];

        await vscode.env.clipboard.writeText('');
        Logger.info('Successfully cleared clipboard');
        vscode.window.showInformationMessage('Clipboard cleared');

        if (state.statusBarItem) {
            if (state.tempClipboard.length > 0) {
                const tempText = `$(archive) Temp: ${state.tempClipboard.length} file${state.tempClipboard.length > 1 ? 's' : ''}`;
                state.statusBarItem.text = tempText;
                state.statusBarItem.show();
            } else {
                state.statusBarItem.hide();
            }
            Logger.debug('Status bar updated after clear');
        }

        // Refresh the clipboard view
        Logger.debug('Refreshing clipboard view');
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
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
        const count = state.copiedFiles.length;
        const tempText = state.tempClipboard.length > 0 ? ` | Temp: ${state.tempClipboard.length}` : '';
        state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''}${tempText}`;
        state.statusBarItem.show();
    }
}