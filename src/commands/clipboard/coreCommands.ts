import * as vscode from 'vscode';
import * as path from 'path';
import { state, CopiedFile, ErrorInfo } from '../../models/models';
import { Logger } from '../../utils/common/logger';
import { CommandRegistry } from '../../utils/common/CommandRegistry';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { TempStorageService } from '../../domain/clipboard/services/TempStorageService';
import { ClearTempStorageUseCase } from '../../application/clipboard/usecases/TempClipboardUseCases';
import { TransferTempToSystemUseCase } from '../../application/clipboard/usecases/TempClipboardUseCases';

// Signature for tracking extension content
const TRACKING_SIGNATURE = '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';

export function registerCoreCommands(context: vscode.ExtensionContext) {
    // Copy commands - these save to BOTH system clipboard AND temp storage
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContent',
        async () => {
            await copyPathWithContent(); // This function now handles both system and temp storage
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContentAndError',
        async () => {
            await copyPathWithContentAndError(); // This function now handles both system and temp storage
        }
    );

    // Transfer temp storage to system clipboard (Ctrl+Alt+Q)
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.transferTempToSystem',
        transferTempToSystem
    );

    // Clear only temporary storage (Ctrl+Alt+Z)
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearTempStorage',
        clearTempStorage
    );

    // Clear everything (both system clipboard and temp storage)
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearAllClipboard',
        clearAllClipboard
    );

    // Refresh command remains the same
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.refreshClipboardView',
        () => {
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

        // 1. Save to system clipboard (state.copiedFiles)
        state.copiedFiles.push(copiedFile);
        await updateClipboardWithSignature();

        // 2. Save to temp storage
        await saveToTempStorage();

        const count = state.copiedFiles.length;
        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} to BOTH system clipboard and temp storage`);
        vscode.window.showInformationMessage(`Copied ${count} file${count > 1 ? 's' : ''} to system clipboard and temp storage`);

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

        // 1. Save to system clipboard (state.copiedFiles)
        state.copiedFiles.push(copiedFile);
        await updateClipboardWithSignature();

        // 2. Save to temp storage
        await saveToTempStorage();

        const count = state.copiedFiles.length;
        const errorCount = errors.length;

        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to BOTH system clipboard and temp storage`);
        vscode.window.showInformationMessage(
            `Copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to system clipboard and temp storage`
        );

        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to copy with error info', err);
        vscode.window.showErrorMessage(`Failed to copy with error info: ${msg}`);
    }
}

// Save current clipboard to temporary storage
async function saveToTempStorage() {
    try {
        const container = ServiceContainer.getInstance();
        const tempStorageService = container.resolve<TempStorageService>('TempStorageService');
        await tempStorageService.saveToTempStorage(state.copiedFiles);
        Logger.debug('Saved to temporary storage');
    } catch (err: any) {
        Logger.error('Failed to save to temporary storage', err);
        // Don't show error to user as this is automatic
    }
}

// NEW: Transfer temp storage to system clipboard (Ctrl+Alt+Q)
async function transferTempToSystem() {
    try {
        const container = ServiceContainer.getInstance();
        const transferTempToSystemUseCase = container.resolve<TransferTempToSystemUseCase>('TransferTempToSystemUseCase');
        await transferTempToSystemUseCase.execute();

        updateStatusBar();

        Logger.info('Transferred temp storage to system clipboard');
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to transfer temp storage to system clipboard', err);
        vscode.window.showErrorMessage(`Failed to transfer temp storage: ${msg}`);
    }
}

async function clearTempStorage() {
    try {
        const container = ServiceContainer.getInstance();
        const clearTempStorageUseCase = container.resolve<ClearTempStorageUseCase>('ClearTempStorageUseCase');
        await clearTempStorageUseCase.execute();

        // Update status bar after clearing temp storage
        updateStatusBar();

        Logger.info('Successfully cleared temporary storage');
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to clear temporary storage', err);
        vscode.window.showErrorMessage(`Failed to clear temporary storage: ${msg}`);
    }
}

// Clear everything (both system clipboard and temp storage)
async function clearAllClipboard() {
    try {
        const beforeCount = state.copiedFiles.length;
        Logger.debug(`Clearing all clipboard with ${beforeCount} files`);

        // Clear system clipboard
        state.copiedFiles.length = 0;
        state.clipboardFiles = [];
        await vscode.env.clipboard.writeText('');

        // Clear temporary storage
        const container = ServiceContainer.getInstance();
        const clearTempStorageUseCase = container.resolve<ClearTempStorageUseCase>('ClearTempStorageUseCase');
        await clearTempStorageUseCase.execute();

        Logger.info('Successfully cleared all clipboard data');
        vscode.window.showInformationMessage('Cleared all clipboard data (system and temporary storage)');

        // FIXED: Force statusbar hide after clearing everything
        if (state.statusBarItem) {
            state.statusBarItem.hide();
            Logger.debug('Status bar hidden after clear all');
        }

        // Refresh the clipboard view
        Logger.debug('Refreshing clipboard view');
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');

        // FIXED: Force update status bar to reflect cleared state
        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to clear all clipboard', err);
        vscode.window.showErrorMessage(`Failed to clear all clipboard: ${msg}`);
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

        try {
            const container = ServiceContainer.getInstance();
            const tempStorageService = container.resolve<TempStorageService>('TempStorageService');
            const tempStats = tempStorageService.getTempStats();

            // FIXED: Only show statusbar if there are actually files
            if (copiedCount > 0 || tempStats.count > 0) {
                let statusText = '';

                // Show system clipboard files if available
                if (copiedCount > 0) {
                    statusText = `$(clippy) ${copiedCount} system`;
                }

                // Show temp storage files if available
                if (tempStats.count > 0) {
                    if (statusText) {
                        statusText += ` | $(archive) ${tempStats.count} temp`;
                    } else {
                        statusText = `$(archive) ${tempStats.count} temp`;
                    }
                }

                state.statusBarItem.text = statusText;
                state.statusBarItem.show();
            } else {
                // FIXED: Hide statusbar when no files exist
                state.statusBarItem.hide();
            }
        } catch (error) {
            // Fallback: only show system clipboard files if temp service fails
            if (copiedCount > 0) {
                state.statusBarItem.text = `$(clippy) ${copiedCount} system`;
                state.statusBarItem.show();
            } else {
                // FIXED: Hide statusbar on error if no files
                state.statusBarItem.hide();
            }
        }
    }
}