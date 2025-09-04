import * as vscode from 'vscode';
import { state } from '../models/models';
import { Logger } from '../utils/logger';
import { canSaveToTemp, checkClipboardIntegrity, TRACKING_SIGNATURE } from '../utils/clipboardUtils';

export async function saveClipboardToTemp() {
    // Check if we have valid content to save
    if (!canSaveToTemp()) {
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
}

export async function restoreClipboardFromTemp() {
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

export function registerTempClipboardCommands(context: vscode.ExtensionContext) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.saveClipboardToTemp', saveClipboardToTemp),
        vscode.commands.registerCommand('copy-path-with-code.restoreClipboardFromTemp', restoreClipboardFromTemp)
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}