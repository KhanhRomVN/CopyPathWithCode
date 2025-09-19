import * as vscode from 'vscode';
import { state } from './models/models';
import { ServiceContainer, IFolderTreeService } from './infrastructure/di/ServiceContainer';
import { FolderProvider } from './providers/FolderProvider';
import { registerAllCommands } from './commands';
import { ClipboardProvider } from './providers/ClipboardProvider';
import { Logger } from './utils/common/logger';
import { FileWatcher } from './utils/folder/fileWatcher';

// Import clipboard services
import { ClipboardService } from './domain/clipboard/services/ClipboardService';
import { ClipboardDetectionService } from './domain/clipboard/services/ClipboardDetectionService';
import { CommandRegistry } from './utils/common/CommandRegistry';

let clipboardMonitoringInterval: NodeJS.Timeout | undefined;
let clipboardDetector: any;

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

        // Create folder tree view using clean architecture
        const folderTreeService = container.resolve<IFolderTreeService>('IFolderTreeService');
        const treeDataProvider = new FolderProvider(folderTreeService);

        // Create tree view and set reference in provider
        const treeView = vscode.window.createTreeView('folderManager', {
            treeDataProvider,
            showCollapseAll: true,
            canSelectMany: false
        });

        // Set tree view reference in provider to manage expansion state
        treeDataProvider.setTreeView(treeView);
        Logger.debug('Folder tree view created with expansion state management');

        // Create clipboard provider
        const clipboardProvider = new ClipboardProvider();
        const clipboardTreeView = vscode.window.createTreeView('clipboard-detection', {
            treeDataProvider: clipboardProvider,
            showCollapseAll: false
        });
        Logger.debug('Clipboard tree view created');

        // Complete the dependency injection chain (pass both providers)
        container.registerUIServices(treeDataProvider, clipboardProvider);

        // Set initial context
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.viewMode', 'workspace');
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', state.clipboardFiles.length > 0);

        // Initialize clipboard detection with clean architecture
        clipboardDetector = initializeClipboardDetector(context, container, clipboardProvider);

        // Start clipboard integrity monitoring
        startClipboardMonitoring(container);

        // Register ALL commands through the centralized system
        registerAllCommands(context, treeDataProvider, clipboardProvider);
        Logger.info('All commands registered with clean architecture');

        // Add tree views to subscriptions for proper cleanup
        context.subscriptions.push(treeView);
        context.subscriptions.push(clipboardTreeView);

        // Cleanup
        context.subscriptions.push({
            dispose: () => {
                if (clipboardDetector) {
                    clipboardDetector.dispose();
                }
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

function initializeClipboardDetector(
    context: vscode.ExtensionContext,
    container: ServiceContainer,
    clipboardProvider: ClipboardProvider
): any {
    const clipboardService = container.resolve<ClipboardService>('ClipboardService');
    const detectionService = container.resolve<ClipboardDetectionService>('ClipboardDetectionService');

    // Create a simple clipboard detector that uses the clean architecture services
    const detector = {
        updateInterval: null as NodeJS.Timeout | null,
        lastClipboardContent: '',
        isDetectionEnabled: true,

        async checkClipboard() {
            if (!this.isDetectionEnabled) {
                return;
            }

            try {
                const clipboardText = await vscode.env.clipboard.readText();

                if (clipboardText !== this.lastClipboardContent) {
                    this.lastClipboardContent = clipboardText;
                    Logger.debug('Clipboard content changed, parsing...');
                    this.parseClipboardContent(clipboardText);
                }
            } catch (error) {
                Logger.debug('Failed to read clipboard content', error);
            }
        },

        parseClipboardContent(text: string) {
            if (!text || text.trim().length === 0) {
                Logger.debug('Empty clipboard content, clearing detected files');
                const currentFiles = clipboardService.getDetectedFiles();
                if (currentFiles.length > 0) {
                    clipboardService.clearDetectedFiles();
                    this.refreshClipboardView();
                }
                return;
            }

            Logger.debug('Parsing clipboard content:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));

            const detectedFiles = detectionService.parseClipboardContent(text);

            if (detectedFiles.length > 0) {
                clipboardService.clearDetectedFiles();
                detectedFiles.forEach(file => {
                    clipboardService.addDetectedFile(file);
                });

                Logger.info(`Detected ${detectedFiles.length} file(s) in clipboard:`, detectedFiles.map(f => f.filePath));
            } else {
                const currentFiles = clipboardService.getDetectedFiles();
                if (currentFiles.length > 0) {
                    clipboardService.clearDetectedFiles();
                }
            }

            this.refreshClipboardView();
        },

        refreshClipboardView() {
            vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
        },

        startDetection() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }

            this.updateInterval = setInterval(() => {
                this.checkClipboard();
            }, 1000);

            Logger.debug('Clipboard detection started');
            this.checkClipboard();
        },

        stopDetection() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
                Logger.debug('Clipboard detection stopped');
            }
        },

        toggleDetection(enabled: boolean) {
            this.isDetectionEnabled = enabled;
            if (enabled) {
                this.startDetection();
            } else {
                this.stopDetection();
            }
            Logger.info(`Clipboard detection ${enabled ? 'enabled' : 'disabled'}`);
        },

        clearQueue() {
            const count = clipboardService.getDetectedFiles().length;
            clipboardService.clearDetectedFiles();
            this.lastClipboardContent = '';
            Logger.info(`Cleared ${count} file(s) from clipboard queue`);
            this.refreshClipboardView();
        },

        dispose() {
            this.stopDetection();
            Logger.info('Clipboard detector disposed');
        }
    };

    // Start detection
    detector.startDetection();
    Logger.info('Clipboard detector initialized with clean architecture');

    return detector;
}

function startClipboardMonitoring(container: ServiceContainer) {
    // Monitor clipboard integrity every 2 seconds
    clipboardMonitoringInterval = setInterval(async () => {
        try {
            const clipboardService = container.resolve<ClipboardService>('ClipboardService');
            const copiedFiles = clipboardService.getCopiedFiles();

            if (copiedFiles.length > 0) {
                await clipboardService.checkClipboardIntegrity();
            }
        } catch (error) {
            Logger.error('Error during clipboard monitoring', error);
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

        // Dispose clipboard detector
        if (clipboardDetector) {
            clipboardDetector.dispose();
            clipboardDetector = undefined;
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