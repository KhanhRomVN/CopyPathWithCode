import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Folder } from '../../../domain/folder/entities/Folder';
import { IFolderRepository } from '../../../domain/folder/services/FolderService';
import { Logger } from '../../../utils/common/logger';

export class FileSystemFolderStorage implements IFolderRepository {
    private folders: Folder[] = [];
    private readonly storageFilePath: string;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private lastSaveTimestamp: number = 0;
    private refreshDebounceTimer: NodeJS.Timeout | undefined;
    private isInternalUpdate: boolean = false; // Flag to prevent circular updates

    constructor(private readonly context: vscode.ExtensionContext) {
        // Use a global storage path that's shared between VS Code instances
        const globalStoragePath = context.globalStorageUri.fsPath;

        // Ensure the directory exists
        if (!fs.existsSync(globalStoragePath)) {
            fs.mkdirSync(globalStoragePath, { recursive: true });
        }

        this.storageFilePath = path.join(globalStoragePath, 'folders.json');

        this.loadFromFileSystem();
        this.setupFileWatcher();
    }

    findAll(): Folder[] {
        this.loadFromFileSystemIfNeeded();
        return [...this.folders];
    }

    findById(id: string): Folder | undefined {
        this.loadFromFileSystemIfNeeded();
        return this.folders.find(f => f.id === id);
    }

    findByName(name: string): Folder | undefined {
        this.loadFromFileSystemIfNeeded();
        return this.folders.find(f => f.name === name);
    }

    findByWorkspace(workspacePath: string): Folder[] {
        this.loadFromFileSystemIfNeeded();
        return this.folders.filter(f => f.workspaceFolder === workspacePath);
    }

    save(folder: Folder): void {
        this.loadFromFileSystemIfNeeded(); // Load latest data first

        const index = this.folders.findIndex(f => f.id === folder.id);

        if (index >= 0) {
            this.folders[index] = folder;
        } else {
            this.folders.push(folder);
        }

        this.saveToFileSystem();
    }

    delete(id: string): boolean {
        this.loadFromFileSystemIfNeeded(); // Load latest data first

        const index = this.folders.findIndex(f => f.id === id);

        if (index >= 0) {
            this.folders.splice(index, 1);
            this.saveToFileSystem();
            return true;
        }

        return false;
    }

    exists(id: string): boolean {
        this.loadFromFileSystemIfNeeded();
        return this.folders.some(f => f.id === id);
    }

    // Batch operations for performance
    saveAll(folders: Folder[]): void {
        this.folders = [...folders];
        this.saveToFileSystem();
    }

    clear(): void {
        this.folders = [];
        this.saveToFileSystem();
    }

    // File system operations - ENHANCED
    private loadFromFileSystem(): void {
        try {
            if (fs.existsSync(this.storageFilePath)) {
                const fileContent = fs.readFileSync(this.storageFilePath, 'utf8');
                const storedData = JSON.parse(fileContent);

                if (Array.isArray(storedData)) {
                    this.folders = storedData.map(data => Folder.fromData(data));
                    Logger.debug(`Loaded ${this.folders.length} folders from file system`);
                } else {
                    this.folders = [];
                }
            } else {
                this.folders = [];
            }
        } catch (error) {
            Logger.error('Failed to load folders from file system', error);
            this.folders = [];

            // Try to recover by using the old globalState method once
            this.migrateFromGlobalState();
        }
    }

    // NEW: Only load if file has been modified by another instance
    private loadFromFileSystemIfNeeded(): void {
        try {
            if (fs.existsSync(this.storageFilePath)) {
                const stats = fs.statSync(this.storageFilePath);
                const fileTimestamp = stats.mtime.getTime();

                // Only reload if file was modified after our last save
                if (fileTimestamp > this.lastSaveTimestamp) {
                    Logger.debug('File modified by another instance, reloading...');
                    this.loadFromFileSystem();
                }
            }
        } catch (error) {
            Logger.warn('Failed to check file timestamp, forcing reload', error);
            this.loadFromFileSystem();
        }
    }

    private saveToFileSystem(): void {
        try {
            this.isInternalUpdate = true; // Mark as internal update
            const data = this.folders.map(f => f.toData());
            fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8');
            this.lastSaveTimestamp = Date.now();
            Logger.debug(`Saved ${this.folders.length} folders to file system`);
        } catch (error) {
            Logger.error('Failed to save folders to file system', error);
        } finally {
            // Reset flag after a short delay to allow file watcher to ignore this change
            setTimeout(() => {
                this.isInternalUpdate = false;
            }, 100);
        }
    }

    // ENHANCED: Better file watching with debouncing
    private setupFileWatcher(): void {
        try {
            // Watch for changes to the storage file from other VS Code instances
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(this.storageFilePath);

            this.fileWatcher.onDidChange(() => {
                // Ignore changes made by this instance
                if (this.isInternalUpdate) {
                    Logger.debug('Ignoring self-triggered file change');
                    return;
                }

                Logger.debug('Folders file changed by another VS Code instance');
                this.debouncedRefresh();
            });

            this.fileWatcher.onDidCreate(() => {
                if (this.isInternalUpdate) return;

                Logger.debug('Folders file created by another VS Code instance');
                this.debouncedRefresh();
            });

            this.fileWatcher.onDidDelete(() => {
                if (this.isInternalUpdate) return;

                Logger.debug('Folders file deleted by another VS Code instance');
                this.folders = [];
                this.debouncedRefresh();
            });

            Logger.debug('File watcher setup completed');
        } catch (error) {
            Logger.error('Failed to setup file watcher', error);
        }
    }

    // NEW: Debounced refresh to prevent excessive updates
    private debouncedRefresh(): void {
        // Clear existing timer
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        // Set new timer
        this.refreshDebounceTimer = setTimeout(() => {
            try {
                // Load fresh data from file
                this.loadFromFileSystem();

                // Refresh the folder view
                vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');

                Logger.debug('Debounced refresh completed');
            } catch (error) {
                Logger.error('Failed during debounced refresh', error);
            }
        }, 300); // 300ms debounce
    }

    private migrateFromGlobalState(): void {
        try {
            // Try to get data from old globalState method
            const stored = this.context.globalState.get<any[]>('folders', []);

            if (stored.length > 0) {
                Logger.info(`Migrating ${stored.length} folders from globalState to file system`);
                this.folders = stored.map(data => Folder.fromData(data));
                this.saveToFileSystem();

                // Clear the old globalState data after successful migration
                this.context.globalState.update('folders', undefined);
            }
        } catch (error) {
            Logger.error('Failed to migrate from globalState', error);
        }
    }

    dispose(): void {
        // Clear debounce timer
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        // Dispose file watcher
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        Logger.debug('FileSystemFolderStorage disposed');
    }
}

// =============================================
// BACKUP STRATEGY - Multiple storage locations
// =============================================

export class RedundantFileSystemFolderStorage extends FileSystemFolderStorage {
    private readonly backupStoragePath: string;

    constructor(context: vscode.ExtensionContext) {
        super(context);

        // Create backup in user's home directory
        const os = require('os');
        const backupDir = path.join(os.homedir(), '.vscode-copy-path-with-code');

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        this.backupStoragePath = path.join(backupDir, 'folders-backup.json');
    }

    save(folder: Folder): void {
        super.save(folder);
        this.createBackup();
    }

    delete(id: string): boolean {
        const result = super.delete(id);
        this.createBackup();
        return result;
    }

    saveAll(folders: Folder[]): void {
        super.saveAll(folders);
        this.createBackup();
    }

    clear(): void {
        super.clear();
        this.createBackup();
    }

    private createBackup(): void {
        try {
            const data = this.findAll().map(f => f.toData());
            fs.writeFileSync(this.backupStoragePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            Logger.warn('Failed to create backup', error);
        }
    }
}