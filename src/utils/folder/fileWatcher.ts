/**
 * FILE: src/utils/folder/fileWatcher.ts - ENHANCED VERSION
 * Enhanced FileWatcher with better cross-instance synchronization
 */

import * as vscode from 'vscode';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderService } from '../../domain/folder/services/FolderService';
import { Logger } from '../common/logger';

export class FileWatcher {
    private static instance: FileWatcher;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];
    private folderService: FolderService;
    private debounceTimer: NodeJS.Timeout | undefined;

    static init(context: vscode.ExtensionContext): FileWatcher {
        if (!this.instance) {
            this.instance = new FileWatcher(context);
        }
        return this.instance;
    }

    private constructor(private context: vscode.ExtensionContext) {
        // Get services from container
        const container = ServiceContainer.getInstance();
        this.folderService = container.resolve<FolderService>('FolderService');

        this.setupFileWatcher();
    }

    private setupFileWatcher() {
        // Watch for file deletions in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

        this.disposables.push(
            this.fileWatcher.onDidDelete((uri) => {
                this.handleFileDeleted(uri);
            })
        );

        // ENHANCED: Watch for file creation/modification to potentially add to folders
        this.disposables.push(
            this.fileWatcher.onDidCreate((uri) => {
                this.handleFileCreated(uri);
            })
        );

        Logger.info('Enhanced file watcher initialized');
    }

    private handleFileDeleted(deletedUri: vscode.Uri) {
        const deletedUriString = deletedUri.toString();
        Logger.info(`File deleted: ${deletedUriString}`);

        try {
            // Use clean architecture to remove deleted files
            const removedCount = this.folderService.removeDeletedFilesFromAllFolders([deletedUriString]);

            if (removedCount > 0) {
                // Debounced refresh to prevent excessive updates
                this.debouncedRefresh();

                vscode.window.showInformationMessage(
                    `Removed ${removedCount} deleted file(s) from folders automatically`
                );
            }
        } catch (error) {
            Logger.error('Failed to handle deleted file', error);
        }
    }

    // NEW: Handle file creation - could be useful for future features
    private handleFileCreated(createdUri: vscode.Uri) {
        Logger.debug(`File created: ${createdUri.toString()}`);

        // For now, just log. In future could implement:
        // - Auto-add to specific folders based on patterns
        // - Notify user about new files in monitored directories

        // Example future implementation:
        // this.checkAutoAddToFolders(createdUri);
    }

    // NEW: Debounced refresh to prevent excessive UI updates
    private debouncedRefresh(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');
            Logger.debug('Debounced folder view refresh completed');
        }, 500); // 500ms debounce
    }

    // NEW: Future feature - auto-add files to folders based on patterns
    private async checkAutoAddToFolders(fileUri: vscode.Uri): Promise<void> {
        try {
            // This could implement intelligent file categorization
            // Example: automatically add .ts files to "TypeScript" folder
            // const fileName = path.basename(fileUri.fsPath);
            // const extension = path.extname(fileName);

            // Future implementation here...
        } catch (error) {
            Logger.warn('Failed to check auto-add patterns', error);
        }
    }

    dispose() {
        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Dispose watchers and other resources
        this.disposables.forEach(d => d.dispose());

        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        Logger.info('Enhanced file watcher disposed');
    }
}