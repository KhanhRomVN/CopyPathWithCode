/**
 * FILE: src/utils/folder/fileWatcher.ts - ENHANCED VERSION
 * Enhanced FileWatcher with better cross-instance synchronization and rename tracking
 */

import * as vscode from 'vscode';
import * as path from 'path';
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
        this.setupWorkspaceWatchers();
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
    }

    // NEW: Setup workspace-level watchers for rename events
    private setupWorkspaceWatchers() {
        // Listen for file/folder renames
        this.disposables.push(
            vscode.workspace.onDidRenameFiles((event) => {
                this.handleFilesRenamed(event);
            })
        );
    }

    // NEW: Handle folder/file rename events
    private async handleFilesRenamed(event: vscode.FileRenameEvent) {
        try {
            for (const rename of event.files) {
                const oldUri = rename.oldUri;
                const newUri = rename.newUri;

                Logger.info(`File/Folder renamed: ${oldUri.fsPath} -> ${newUri.fsPath}`);

                // Check if this is a folder rename by trying to get stats
                try {
                    const stat = await vscode.workspace.fs.stat(newUri);

                    if (stat.type === vscode.FileType.Directory) {
                        // This is a folder rename
                        await this.handleFolderRenamed(oldUri, newUri);
                    } else {
                        // This is a file rename
                        await this.handleFileRenamed(oldUri, newUri);
                    }
                } catch (error) {
                    Logger.warn(`Could not determine type for renamed item: ${newUri.fsPath}`, error);
                }
            }
        } catch (error) {
            Logger.error('Failed to handle rename event', error);
        }
    }

    // NEW: Handle folder rename specifically
    private async handleFolderRenamed(oldUri: vscode.Uri, newUri: vscode.Uri) {
        try {
            const oldFolderName = path.basename(oldUri.fsPath);
            const newFolderName = path.basename(newUri.fsPath);

            if (oldFolderName === newFolderName) {
                return; // No actual name change
            }

            Logger.info(`Folder renamed: "${oldFolderName}" -> "${newFolderName}"`);

            // Get current workspace
            const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!currentWorkspace) {
                Logger.warn('No workspace found for folder rename');
                return;
            }

            // Find folders that match the old folder name in current workspace
            const allFolders = this.folderService.getAllFolders();
            let updatedCount = 0;

            for (const folder of allFolders) {
                // Check if this folder corresponds to the renamed folder
                if (folder.name === oldFolderName &&
                    folder.workspaceFolder === currentWorkspace) {

                    try {
                        // Update folder name using the service
                        this.folderService.renameFolder(folder.id, newFolderName);
                        updatedCount++;
                        Logger.info(`Updated folder "${oldFolderName}" to "${newFolderName}" in extension`);
                    } catch (error) {
                        Logger.error(`Failed to rename folder ${folder.id} in extension`, error);
                    }
                }
            }

            if (updatedCount > 0) {
                // Refresh tree view to show updated names
                this.debouncedRefresh();

                vscode.window.showInformationMessage(
                    `Updated ${updatedCount} folder(s) name from "${oldFolderName}" to "${newFolderName}"`
                );
            }

        } catch (error) {
            Logger.error('Failed to handle folder rename', error);
        }
    }

    // NEW: Handle file rename specifically  
    private async handleFileRenamed(oldUri: vscode.Uri, newUri: vscode.Uri) {
        try {
            const oldUriString = oldUri.toString();
            const newUriString = newUri.toString();

            // Update file URIs in all folders
            const allFolders = this.folderService.getAllFolders();
            let updatedFolders = 0;

            for (const folder of allFolders) {
                if (folder.files.includes(oldUriString)) {
                    // Remove old URI and add new URI
                    this.folderService.removeFileFromFolder(folder.id, oldUriString);
                    this.folderService.addFileToFolder(folder.id, newUriString);
                    updatedFolders++;
                }
            }

            if (updatedFolders > 0) {
                this.debouncedRefresh();
                Logger.info(`Updated file URI in ${updatedFolders} folder(s) after rename`);
            }

        } catch (error) {
            Logger.error('Failed to handle file rename', error);
        }
    }

    private handleFileDeleted(deletedUri: vscode.Uri) {
        const deletedUriString = deletedUri.toString();

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
    }
}