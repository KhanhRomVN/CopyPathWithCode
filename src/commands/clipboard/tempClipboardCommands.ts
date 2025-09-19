/**
 * FILE: src/commands/clipboard/tempClipboardCommands.ts
 * 
 * TEMP CLIPBOARD COMMANDS - Simplified implementation
 * Fixed to prevent "An object could not be cloned" error
 */

import * as vscode from 'vscode';
import { state } from '../../models/models';
import { Logger } from '../../utils/common/logger';

// Tracking signature
const TRACKING_SIGNATURE = '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';

export function registerTempClipboardCommands(context: vscode.ExtensionContext) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.saveClipboardToTemp', saveClipboardToTemp),
        vscode.commands.registerCommand('copy-path-with-code.restoreClipboardFromTemp', restoreClipboardFromTemp)
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

async function saveClipboardToTemp() {
    try {
        // Check if we have valid content to save
        if (state.copiedFiles.length === 0) {
            Logger.debug('No valid content in clipboard to save to temp');
            vscode.window.showWarningMessage('No files copied to save to temporary storage');
            return;
        }

        // Verify clipboard integrity before saving
        const hasValidContent = await checkClipboardIntegrity();
        if (!hasValidContent) {
            Logger.warn('Cannot save to temp: clipboard content was modified externally');
            vscode.window.showWarningMessage('Cannot save to temporary storage: clipboard content was modified');
            return;
        }

        // Save current clipboard to temp
        state.tempClipboard = [...state.copiedFiles];

        // Clear current clipboard
        state.copiedFiles = [];
        await vscode.env.clipboard.writeText('');

        Logger.info(`Saved ${state.tempClipboard.length} files to temporary storage`);
        vscode.window.showInformationMessage(`Saved ${state.tempClipboard.length} files to temporary storage`);

        // Update status bar to show temp storage
        updateStatusBar();
    } catch (error) {
        Logger.error('Failed to save clipboard to temp', error);
        vscode.window.showErrorMessage(`Failed to save to temporary storage: ${error}`);
    }
}

async function restoreClipboardFromTemp() {
    try {
        if (state.tempClipboard.length === 0) {
            Logger.debug('No content in temporary storage to restore');
            vscode.window.showWarningMessage('No files in temporary storage to restore');
            return;
        }

        // Clear current clipboard first
        state.copiedFiles = [];

        // Restore from temp
        state.copiedFiles = [...state.tempClipboard];

        // Update actual clipboard with signature
        const combined = state.copiedFiles
            .map(f => f.content)
            .join('\n\n---\n\n');

        const finalContent = combined + '\n' + TRACKING_SIGNATURE;
        await vscode.env.clipboard.writeText(finalContent);

        Logger.info(`Restored ${state.copiedFiles.length} files from temporary storage`);
        vscode.window.showInformationMessage(`Restored ${state.copiedFiles.length} files from temporary storage`);

        // Update status bar
        updateStatusBar();
    } catch (error) {
        Logger.error('Failed to restore clipboard from temp', error);
        vscode.window.showErrorMessage(`Failed to restore from temporary storage: ${error}`);
    }
}

async function checkClipboardIntegrity(): Promise<boolean> {
    try {
        const clipboardText = await vscode.env.clipboard.readText();
        const hasSignature = clipboardText.endsWith(TRACKING_SIGNATURE);

        if (!hasSignature && state.copiedFiles.length > 0) {
            // Content was modified externally, clear our tracking
            Logger.info('Clipboard content modified externally, clearing file tracking');
            state.copiedFiles = [];
            updateStatusBar();
            return false;
        }

        return hasSignature;
    } catch (error) {
        Logger.error('Failed to check clipboard integrity', error);
        return false;
    }
}

function updateStatusBar() {
    if (!state.statusBarItem) {
        return;
    }

    const currentCount = state.copiedFiles.length;
    const tempCount = state.tempClipboard.length;

    if (currentCount > 0 && tempCount > 0) {
        // Both current and temp have files
        state.statusBarItem.text = `$(clippy) ${currentCount} file${currentCount > 1 ? 's' : ''} | Temp: ${tempCount}`;
        state.statusBarItem.show();
    } else if (currentCount > 0) {
        // Only current has files
        state.statusBarItem.text = `$(clippy) ${currentCount} file${currentCount > 1 ? 's' : ''} copied`;
        state.statusBarItem.show();
    } else if (tempCount > 0) {
        // Only temp has files
        state.statusBarItem.text = `$(archive) Temp: ${tempCount} file${tempCount > 1 ? 's' : ''}`;
        state.statusBarItem.show();
    } else {
        // Nothing to show
        state.statusBarItem.hide();
    }
}