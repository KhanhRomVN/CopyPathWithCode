/**
 * FILE: src/utils/folder/fileWatcher.ts
 * Updated to use Clean Architecture
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

        Logger.info('File watcher initialized');
    }

    private handleFileDeleted(deletedUri: vscode.Uri) {
        const deletedUriString = deletedUri.toString();
        Logger.info(`File deleted: ${deletedUriString}`);

        try {
            // Use clean architecture to remove deleted files
            const removedCount = this.folderService.removeDeletedFilesFromAllFolders([deletedUriString]);

            if (removedCount > 0) {
                // Refresh folder tree view
                vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');

                vscode.window.showInformationMessage(
                    `Removed ${removedCount} deleted file(s) from folders automatically`
                );
            }
        } catch (error) {
            Logger.error('Failed to handle deleted file', error);
        }
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        Logger.info('File watcher disposed');
    }
}