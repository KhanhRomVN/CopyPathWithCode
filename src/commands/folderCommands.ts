import * as vscode from 'vscode';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { registerFolderManagementCommands } from './folderManagementCommands';
import { registerFileManagementCommands } from './fileManagementCommands';
import { registerFolderOperationsCommands } from './folderOperationsCommands';
import { registerSearchCommands } from './searchCommands';
import { ClipboardDetector } from '../utils/clipboardDetector';
import { Logger } from '../utils/logger';
import { state } from '../models/models';

export function registerFolderCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider) {

    const clipboardDetector = ClipboardDetector.init(context);

    // Register all command categories
    registerFolderManagementCommands(context, treeDataProvider);
    registerFileManagementCommands(context, treeDataProvider);
    registerFolderOperationsCommands(context, treeDataProvider);
    registerSearchCommands(context, treeDataProvider);

    // Additional commands that don't fit into categories
    const additionalCommands = [
        // Clipboard detection commands
        vscode.commands.registerCommand('copy-path-with-code.toggleClipboardDetection', () => {
            const currentlyEnabled = state.isClipboardDetectionEnabled;
            clipboardDetector.toggleDetection(!currentlyEnabled);
            vscode.window.showInformationMessage(
                `Clipboard detection ${currentlyEnabled ? 'disabled' : 'enabled'}`
            );
        }),

        vscode.commands.registerCommand('copy-path-with-code.clearClipboardQueue', () => {
            clipboardDetector.clearQueue();
            vscode.window.showInformationMessage('Clipboard queue cleared');
        }),

        vscode.commands.registerCommand('copy-path-with-code.showLogs', () => {
            Logger.show();
        }),

        // Add refresh command for folder tree
        vscode.commands.registerCommand('copy-path-with-code.refreshFolderView', () => {
            treeDataProvider.refresh();
        })
    ];

    additionalCommands.forEach(cmd => context.subscriptions.push(cmd));
}