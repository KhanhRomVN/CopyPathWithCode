import * as vscode from 'vscode';
import { state } from './models/models';
import { loadFolders } from './utils/folderUtils';
import { FolderTreeDataProvider } from './providers/folderTreeDataProvider';
import { registerAllCommands } from './commands';
import { ClipboardDetector } from './utils/clipboardDetector';
import { ClipboardTreeDataProvider } from './providers/clipboardTreeDataProvider';
import { Logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    Logger.initialize();
    Logger.info('Extension activated');

    loadFolders(context);
    Logger.debug(`Loaded ${state.folders.length} folders from storage`);

    // initialize status bar item for copy count
    state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    state.statusBarItem.hide();
    context.subscriptions.push(state.statusBarItem);

    // Suppress VS Code notifications globally
    // @ts-ignore
    vscode.window.showInformationMessage = () => Promise.resolve(undefined);
    // @ts-ignore
    vscode.window.showWarningMessage = () => Promise.resolve(undefined);
    // @ts-ignore
    vscode.window.showErrorMessage = () => Promise.resolve(undefined);

    const treeDataProvider = new FolderTreeDataProvider();
    vscode.window.createTreeView('folderManager', { treeDataProvider });
    Logger.debug('Folder tree view created');

    // Initialize clipboard detection
    const clipboardDetector = ClipboardDetector.init(context);
    Logger.info('Clipboard detector initialized');

    // Register clipboard tree view - fix the view ID
    const clipboardTreeDataProvider = new ClipboardTreeDataProvider();
    const clipboardTreeView = vscode.window.createTreeView('clipboard-detection', {
        treeDataProvider: clipboardTreeDataProvider,
        showCollapseAll: false
    });
    Logger.debug('Clipboard tree view created');

    // Register refresh command for clipboard view
    context.subscriptions.push(
        vscode.commands.registerCommand('copy-path-with-code.refreshClipboardView', () => {
            clipboardTreeDataProvider.refresh();
            // Update context for when clause
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', state.clipboardFiles.length > 0);
            Logger.debug('Clipboard view refreshed');
        })
    );

    // Initial context update
    vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', state.clipboardFiles.length > 0);

    // Pass instance of treeDataProvider to register commands
    registerAllCommands(context, treeDataProvider, clipboardTreeDataProvider);
    Logger.info('All commands registered');

    // Cleanup
    context.subscriptions.push({
        dispose: () => {
            clipboardDetector.dispose();
            Logger.info('Extension deactivated');
        }
    });
}

export function deactivate() {
    state.copiedFiles.length = 0;
    state.folders.length = 0;
    state.clipboardFiles.length = 0;
    Logger.dispose();
}