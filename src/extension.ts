import * as vscode from 'vscode';
import { state } from './models/models';
import { loadFolders } from './utils/folderUtils';
import { FolderTreeDataProvider } from './providers/folderTreeDataProvider';
import { GlobalFolderTreeDataProvider } from './providers/globalFolderTreeDataProvider';
import { registerAllCommands } from './commands';
import { ClipboardDetector } from './utils/clipboardDetector';
import { ClipboardTreeDataProvider } from './providers/clipboardTreeDataProvider';
import { Logger } from './utils/logger';
import { checkClipboardIntegrity } from './utils/clipboardUtils';
import { FileWatcher } from './utils/fileWatcher';

let clipboardMonitoringInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    Logger.initialize();
    Logger.info('Extension activated');

    loadFolders(context);
    Logger.debug(`Loaded ${state.folders.length} folders from storage`);

    // Initialize file watcher for tracking deleted files
    const fileWatcher = FileWatcher.init(context);

    // Initialize status bar item
    state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    state.statusBarItem.hide();
    context.subscriptions.push(state.statusBarItem);

    // Suppress VS Code notifications
    // @ts-ignore
    vscode.window.showInformationMessage = () => Promise.resolve(undefined);
    // @ts-ignore
    vscode.window.showWarningMessage = () => Promise.resolve(undefined);
    // @ts-ignore
    vscode.window.showErrorMessage = () => Promise.resolve(undefined);

    // Create folder tree view (current workspace only)
    const treeDataProvider = new FolderTreeDataProvider();
    vscode.window.createTreeView('folderManager', { treeDataProvider });
    Logger.debug('Folder tree view created');

    // Create global folder tree view (all workspaces)
    const globalTreeDataProvider = new GlobalFolderTreeDataProvider();
    vscode.window.createTreeView('globalFolderManager', {
        treeDataProvider: globalTreeDataProvider,
        showCollapseAll: true
    });
    Logger.debug('Global folder tree view created');

    // Initialize clipboard detection
    const clipboardDetector = ClipboardDetector.init(context);
    Logger.info('Clipboard detector initialized');

    // Register clipboard tree view
    const clipboardTreeDataProvider = new ClipboardTreeDataProvider();
    const clipboardTreeView = vscode.window.createTreeView('clipboard-detection', {
        treeDataProvider: clipboardTreeDataProvider,
        showCollapseAll: false
    });
    Logger.debug('Clipboard tree view created');

    // Register refresh commands
    context.subscriptions.push(
        vscode.commands.registerCommand('copy-path-with-code.refreshClipboardView', () => {
            clipboardTreeDataProvider.refresh();
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', state.clipboardFiles.length > 0);
            Logger.debug('Clipboard view refreshed');
        }),
        vscode.commands.registerCommand('copy-path-with-code.refreshFolderView', () => {
            treeDataProvider.refresh();
            Logger.debug('Folder view refreshed');
        }),
        vscode.commands.registerCommand('copy-path-with-code.refreshGlobalFolderView', () => {
            globalTreeDataProvider.refresh();
            Logger.debug('Global folder view refreshed');
        }),
        vscode.commands.registerCommand('copy-path-with-code.openGlobalFolderManager', () => {
            vscode.commands.executeCommand('workbench.view.extension.global-folder-manager');
            Logger.debug('Global folder manager opened');
        })
    );

    // Initial context update
    vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', state.clipboardFiles.length > 0);

    // Start clipboard integrity monitoring
    startClipboardMonitoring();

    // Register all commands with both tree providers
    registerAllCommands(context, treeDataProvider, clipboardTreeDataProvider);
    Logger.info('All commands registered');

    // Cleanup
    context.subscriptions.push({
        dispose: () => {
            clipboardDetector.dispose();
            fileWatcher.dispose();
            if (clipboardMonitoringInterval) {
                clearInterval(clipboardMonitoringInterval);
                clipboardMonitoringInterval = undefined;
            }
            Logger.info('Extension deactivated');
        }
    });
}

function startClipboardMonitoring() {
    // Monitor clipboard integrity every 2 seconds
    clipboardMonitoringInterval = setInterval(async () => {
        if (state.copiedFiles.length > 0) {
            try {
                await checkClipboardIntegrity();
            } catch (error) {
                Logger.error('Error during clipboard monitoring', error);
            }
        }
    }, 2000);

    Logger.debug('Clipboard monitoring started');
}

export function deactivate() {
    state.copiedFiles.length = 0;
    state.folders.length = 0;
    state.clipboardFiles.length = 0;
    state.tempClipboard.length = 0;

    if (clipboardMonitoringInterval) {
        clearInterval(clipboardMonitoringInterval);
        clipboardMonitoringInterval = undefined;
    }

    Logger.dispose();
}