/**
 * FILE: src/infrastructure/folder/storage/FileSystemFolderStorage.ts
 * 
 * FILE SYSTEM FOLDER STORAGE - Shared between VS Code instances
 * 
 * Uses file system to store folder data, allowing sharing between multiple VS Code windows
 */

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
        this.loadFromFileSystem(); // Always load fresh data
        return [...this.folders];
    }

    findById(id: string): Folder | undefined {
        this.loadFromFileSystem();
        return this.folders.find(f => f.id === id);
    }

    findByName(name: string): Folder | undefined {
        this.loadFromFileSystem();
        return this.folders.find(f => f.name === name);
    }

    findByWorkspace(workspacePath: string): Folder[] {
        this.loadFromFileSystem();
        return this.folders.filter(f => f.workspaceFolder === workspacePath);
    }

    save(folder: Folder): void {
        this.loadFromFileSystem(); // Load latest data first

        const index = this.folders.findIndex(f => f.id === folder.id);

        if (index >= 0) {
            this.folders[index] = folder;
        } else {
            this.folders.push(folder);
        }

        this.saveToFileSystem();
    }

    delete(id: string): boolean {
        this.loadFromFileSystem(); // Load latest data first

        const index = this.folders.findIndex(f => f.id === id);

        if (index >= 0) {
            this.folders.splice(index, 1);
            this.saveToFileSystem();
            return true;
        }

        return false;
    }

    exists(id: string): boolean {
        this.loadFromFileSystem();
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

    // File system operations
    private loadFromFileSystem(): void {
        try {
            if (fs.existsSync(this.storageFilePath)) {
                const fileContent = fs.readFileSync(this.storageFilePath, 'utf8');
                const storedData = JSON.parse(fileContent);

                if (Array.isArray(storedData)) {
                    this.folders = storedData.map(data => Folder.fromData(data));
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

    private saveToFileSystem(): void {
        try {
            const data = this.folders.map(f => f.toData());
            fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8');
            Logger.debug(`Saved ${this.folders.length} folders to file system`);
        } catch (error) {
            Logger.error('Failed to save folders to file system', error);
        }
    }

    private setupFileWatcher(): void {
        try {
            // Watch for changes to the storage file from other VS Code instances
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(this.storageFilePath);

            this.fileWatcher.onDidChange(() => {
                Logger.debug('Folders file changed by another VS Code instance');
                this.loadFromFileSystem();
                // Notify the folder provider to refresh
                vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');
            });

            this.fileWatcher.onDidCreate(() => {
                Logger.debug('Folders file created by another VS Code instance');
                this.loadFromFileSystem();
                vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');
            });

            this.fileWatcher.onDidDelete(() => {
                Logger.debug('Folders file deleted by another VS Code instance');
                this.folders = [];
                vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');
            });
        } catch (error) {
            Logger.error('Failed to setup file watcher', error);
        }
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
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
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