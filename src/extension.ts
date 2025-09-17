import * as vscode from 'vscode';
import { state } from './models/models';
import { ServiceContainer, IFolderTreeService } from './infrastructure/di/ServiceContainer';
import { FolderProvider } from './providers/FolderProvider';
import { registerAllCommands } from './commands';
import { ClipboardDetector } from './utils/clipboard/clipboardDetector';
import { ClipboardProvider } from './providers/ClipboardProvider';
import { Logger } from './utils/common/logger';
import { checkClipboardIntegrity } from './utils/clipboard/clipboardUtils';
import { FileWatcher } from './utils/folder/fileWatcher';

let clipboardMonitoringInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize logger
        Logger.initialize();
        Logger.info('Extension activated');

        // Initialize service container with clean architecture
        const container = ServiceContainer.getInstance();
        container.initialize(context);

        // Initialize file watcher for tracking deleted files
        const fileWatcher = FileWatcher.init(context);

        // Initialize status bar item
        state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        state.statusBarItem.hide();
        context.subscriptions.push(state.statusBarItem);

        // Create folder tree view using clean architecture with proper type casting
        const folderTreeService = container.resolve<IFolderTreeService>('IFolderTreeService');
        const treeDataProvider = new FolderProvider(folderTreeService);

        // Create tree view and set reference in provider
        const treeView = vscode.window.createTreeView('folderManager', {
            treeDataProvider,
            showCollapseAll: true,
            canSelectMany: false // This helps with selection behavior
        });

        // Set tree view reference in provider to manage expansion state
        treeDataProvider.setTreeView(treeView);

        Logger.debug('Folder tree view created with expansion state management');

        // Complete the dependency injection chain
        container.registerUIServices(treeDataProvider);

        // Set initial context
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.viewMode', 'workspace');

        // Initialize clipboard detection
        const clipboardDetector = ClipboardDetector.init(context);
        Logger.info('Clipboard detector initialized');

        // Register clipboard tree view
        const clipboardProvider = new ClipboardProvider();
        const clipboardTreeView = vscode.window.createTreeView('clipboard-detection', {
            treeDataProvider: clipboardProvider,
            showCollapseAll: false
        });
        Logger.debug('Clipboard tree view created');

        // Register ONLY the essential commands that are used immediately
        // All other commands will be registered through registerAllCommands
        context.subscriptions.push(
            vscode.commands.registerCommand('copy-path-with-code.refreshClipboardView', () => {
                clipboardProvider.refresh();
                vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', state.clipboardFiles.length > 0);
                Logger.debug('Clipboard view refreshed');
            })
        );

        // Initial context update
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', state.clipboardFiles.length > 0);

        // Start clipboard integrity monitoring
        startClipboardMonitoring();

        // Register ALL commands through the centralized system
        registerAllCommands(context, treeDataProvider, clipboardProvider);
        Logger.info('All commands registered with clean architecture');

        // Add tree view to subscriptions for proper cleanup
        context.subscriptions.push(treeView);
        context.subscriptions.push(clipboardTreeView);

        // Cleanup
        context.subscriptions.push({
            dispose: () => {
                clipboardDetector.dispose();
                fileWatcher.dispose();
                container.dispose();
                if (clipboardMonitoringInterval) {
                    clearInterval(clipboardMonitoringInterval);
                    clipboardMonitoringInterval = undefined;
                }
                Logger.info('Extension deactivated');
            }
        });

        Logger.info('Extension activation completed successfully');
    } catch (error) {
        Logger.error('Failed to activate extension', error);
        vscode.window.showErrorMessage(`Failed to activate Copy Path with Code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    try {
        // Clear state arrays
        state.copiedFiles.length = 0;
        state.clipboardFiles.length = 0;
        state.tempClipboard.length = 0;

        // Clear clipboard monitoring interval
        if (clipboardMonitoringInterval) {
            clearInterval(clipboardMonitoringInterval);
            clipboardMonitoringInterval = undefined;
        }

        // Hide status bar item
        if (state.statusBarItem) {
            state.statusBarItem.hide();
            state.statusBarItem.dispose();
            state.statusBarItem = undefined;
        }

        // Clean up service container
        const container = ServiceContainer.getInstance();
        container.dispose();

        // Dispose logger
        Logger.dispose();

        Logger.info('Extension deactivated successfully');
    } catch (error) {
        console.error('Error during extension deactivation:', error);
    }
}