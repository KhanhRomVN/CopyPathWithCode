/**
 * Updated ServiceContainer with FileSystem Storage for cross-window synchronization
 * TEMP CLIPBOARD FUNCTIONALITY REMOVED
 */

import * as vscode from 'vscode';

// Domain Services - Folder
import { FolderService, IFolderRepository } from '../../domain/folder/services/FolderService';
import { FileService, IFileSystemService } from '../../domain/folder/services/FileService';
import { TreeService, IPathService } from '../../domain/folder/services/TreeService';
import { FolderValidator } from '../../domain/folder/validators/FolderValidator';

// Domain Services - Clipboard
import { ClipboardService, IClipboardRepository, IClipboardSystemService } from '../../domain/clipboard/services/ClipboardService';
import { ClipboardDetectionService } from '../../domain/clipboard/services/ClipboardDetectionService';

// Infrastructure Services - Folder (UPDATED)
import { FileSystemFolderStorage } from '../folder/storage/FileSystemFolderStorage'; // NEW
import { VSCodeFileSystemService } from '../folder/filesystem/FileSystemService';
import { VSCodeWorkspaceService, IWorkspaceService } from '../folder/workspace/WorkspaceService';
import { VSCodeNotificationService } from '../folder/ui/NotificationService';
import { VSCodeUIRefreshService } from '../folder/ui/UIRefreshService';
import { VSCodeEditorService, IEditorService } from '../folder/ui/EditorService';
import { NodePathService } from '../shared/PathService';

// Infrastructure Services - Clipboard
import { ClipboardStorage } from '../clipboard/storage/ClipboardStorage';
import { VSCodeClipboardService } from '../clipboard/system/VSCodeClipboardService';
import { VSCodeClipboardNotificationService, IClipboardNotificationService } from '../clipboard/ui/ClipboardNotificationService';

// Application Services - Folder
import { CreateFolderUseCase } from '../../application/folder/usecases/CreateFolderUseCase';
import { DeleteFolderUseCase } from '../../application/folder/usecases/DeleteFolderUseCase';
import { RenameFolderUseCase } from '../../application/folder/usecases/RenameFolderUseCase';
import { AddFileToFolderUseCase } from '../../application/folder/usecases/AddFileToFolderUseCase';
import { RemoveFileFromFolderUseCase } from '../../application/folder/usecases/RemoveFileFromFolderUseCase';
import { OpenFolderFilesUseCase } from '../../application/folder/usecases/OpenFolderFilesUseCase';
import { FolderApplicationService, INotificationService, IUIRefreshService } from '../../application/folder/service/FolderApplicationService';

// Application Services - Clipboard
import { CopyFileContentUseCase } from '../../application/clipboard/usecases/CopyFileContentUseCase';
import { ClearClipboardUseCase } from '../../application/clipboard/usecases/ClearClipboardUseCase';
import { ClipboardApplicationService, IClipboardUIRefreshService } from '../../application/clipboard/service/ClipboardApplicationService';

// Types for FolderProvider dependency
import { Folder } from '../../domain/folder/entities/Folder';
import { FileNode } from '../../domain/folder/entities/FileNode';
import { Logger } from '../../utils/common/logger';

export interface IFolderTreeService {
    getAllFolders(): Folder[];
    getFoldersForWorkspace(workspacePath?: string): Folder[];
    getFolderById(id: string): Folder;
    buildFileTreeForFolder(folderId: string): FileNode[];
    getCurrentWorkspaceFolder(): string | undefined;
}

export class ServiceContainer {
    private static instance: ServiceContainer;
    private services = new Map<string, any>();
    private isInitialized = false;

    private constructor() { }

    static getInstance(): ServiceContainer {
        if (!ServiceContainer.instance) {
            ServiceContainer.instance = new ServiceContainer();
        }
        return ServiceContainer.instance;
    }

    initialize(context: vscode.ExtensionContext): void {
        if (this.isInitialized) {
            return; // Already initialized
        }

        this.registerInfrastructureServices(context);
        this.registerDomainServices();
        this.registerApplicationServices();
        this.registerTreeService();
        this.registerClipboardServices();

        this.isInitialized = true;
    }

    private registerInfrastructureServices(context: vscode.ExtensionContext): void {
        // UPDATED: Use enhanced FileSystem storage with improved synchronization
        const folderStorage = new FileSystemFolderStorage(context); // This now uses the enhanced version
        this.register<IFolderRepository>('IFolderRepository', folderStorage);

        // File System
        const fileSystemService = new VSCodeFileSystemService();
        this.register<IFileSystemService>('IFileSystemService', fileSystemService);

        // Path Service
        const pathService = new NodePathService();
        this.register<IPathService>('IPathService', pathService);

        // Workspace Service
        const workspaceService = new VSCodeWorkspaceService();
        this.register<IWorkspaceService>('IWorkspaceService', workspaceService);

        // UI Services
        const notificationService = new VSCodeNotificationService();
        this.register<INotificationService>('INotificationService', notificationService);

        const editorService = new VSCodeEditorService();
        this.register<IEditorService>('IEditorService', editorService);

        // Clipboard Infrastructure Services
        const clipboardRepository = new ClipboardStorage();
        this.register<IClipboardRepository>('IClipboardRepository', clipboardRepository);

        const clipboardSystemService = new VSCodeClipboardService();
        this.register<IClipboardSystemService>('IClipboardSystemService', clipboardSystemService);

        const clipboardNotificationService = new VSCodeClipboardNotificationService();
        this.register<IClipboardNotificationService>('IClipboardNotificationService', clipboardNotificationService);
    }

    private registerDomainServices(): void {
        const folderRepository = this.resolve<IFolderRepository>('IFolderRepository');
        const fileSystemService = this.resolve<IFileSystemService>('IFileSystemService');
        const pathService = this.resolve<IPathService>('IPathService');

        // Folder Domain Services
        const folderValidator = new FolderValidator();
        this.register('FolderValidator', folderValidator);

        const folderService = new FolderService(folderRepository, folderValidator);
        this.register('FolderService', folderService);

        const fileService = new FileService(fileSystemService);
        this.register('FileService', fileService);

        const treeService = new TreeService(pathService);
        this.register('TreeService', treeService);

        // Clipboard Domain Services
        const clipboardRepository = this.resolve<IClipboardRepository>('IClipboardRepository');
        const clipboardSystemService = this.resolve<IClipboardSystemService>('IClipboardSystemService');

        const clipboardService = new ClipboardService(clipboardRepository, clipboardSystemService);
        this.register('ClipboardService', clipboardService);

        const clipboardDetectionService = new ClipboardDetectionService();
        this.register('ClipboardDetectionService', clipboardDetectionService);
    }

    private registerApplicationServices(): void {
        const folderService = this.resolve<FolderService>('FolderService');
        const fileService = this.resolve<FileService>('FileService');

        // Folder Use Cases
        const createFolderUseCase = new CreateFolderUseCase(folderService);
        this.register('CreateFolderUseCase', createFolderUseCase);

        const deleteFolderUseCase = new DeleteFolderUseCase(folderService);
        this.register('DeleteFolderUseCase', deleteFolderUseCase);

        const renameFolderUseCase = new RenameFolderUseCase(folderService);
        this.register('RenameFolderUseCase', renameFolderUseCase);

        const addFileToFolderUseCase = new AddFileToFolderUseCase(folderService, fileService);
        this.register('AddFileToFolderUseCase', addFileToFolderUseCase);

        const removeFileFromFolderUseCase = new RemoveFileFromFolderUseCase(folderService);
        this.register('RemoveFileFromFolderUseCase', removeFileFromFolderUseCase);

        const openFolderFilesUseCase = new OpenFolderFilesUseCase(folderService, fileService);
        this.register('OpenFolderFilesUseCase', openFolderFilesUseCase);

        // Clipboard Use Cases (Temp removed)
        const clipboardService = this.resolve<ClipboardService>('ClipboardService');
        const clipboardNotificationService = this.resolve<IClipboardNotificationService>('IClipboardNotificationService');

        const copyFileContentUseCase = new CopyFileContentUseCase(clipboardService, clipboardNotificationService);
        this.register('CopyFileContentUseCase', copyFileContentUseCase);

        const clearClipboardUseCase = new ClearClipboardUseCase(clipboardService, clipboardNotificationService);
        this.register('ClearClipboardUseCase', clearClipboardUseCase);

        // Temp use cases removed - no longer needed
    }

    private registerClipboardServices(): void {
        // Already registered in registerApplicationServices
        // This method kept for consistency and future clipboard-specific services
    }

    private registerTreeService(): void {
        // Create folder tree service adapter
        const folderTreeService = this.createFolderTreeService();
        this.register<IFolderTreeService>('IFolderTreeService', folderTreeService);
    }

    // Call this after FolderProvider is created to complete the dependency chain
    registerUIServices(treeDataProvider: any, clipboardProvider?: any): void {
        // Folder UI Refresh Service
        const uiRefreshService = new VSCodeUIRefreshService(treeDataProvider);
        this.register<IUIRefreshService>('IUIRefreshService', uiRefreshService);

        // Folder Command Handler
        const folderApplicationService = new FolderApplicationService(
            this.resolve('CreateFolderUseCase'),
            this.resolve('DeleteFolderUseCase'),
            this.resolve('RenameFolderUseCase'),
            this.resolve('AddFileToFolderUseCase'),
            this.resolve('RemoveFileFromFolderUseCase'),
            this.resolve('OpenFolderFilesUseCase'),
            this.resolve<INotificationService>('INotificationService'),
            uiRefreshService
        );
        this.register('FolderApplicationService', folderApplicationService);

        // Also register the FolderProvider instance for command access
        this.register('FolderProvider', treeDataProvider);

        // Clipboard UI Services
        if (clipboardProvider) {
            const clipboardUIRefreshService: IClipboardUIRefreshService = {
                refreshClipboardView: () => {
                    clipboardProvider.refresh();
                    // Update context for UI visibility
                    const clipboardService = this.resolve<ClipboardService>('ClipboardService');
                    const detectedFiles = clipboardService.getDetectedFiles();
                    vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', detectedFiles.length > 0);
                },
                updateStatusBar: () => this.updateClipboardStatusBar()
            };
            this.register<IClipboardUIRefreshService>('IClipboardUIRefreshService', clipboardUIRefreshService);

            // Clipboard Application Service (Temp functionality removed)
            const clipboardApplicationService = new ClipboardApplicationService(
                this.resolve('CopyFileContentUseCase'),
                this.resolve('ClearClipboardUseCase'),
                // Removed: saveToTempUseCase
                // Removed: restoreFromTempUseCase
                clipboardUIRefreshService
            );
            this.register('ClipboardApplicationService', clipboardApplicationService);

            // Register clipboard provider
            this.register('ClipboardProvider', clipboardProvider);
        }
    }

    private updateClipboardStatusBar(): void {
        const clipboardService = this.resolve<ClipboardService>('ClipboardService');
        const copiedFiles = clipboardService.getCopiedFiles();
        // Temp files removed - no longer needed

        // Import state dynamically to avoid circular dependency
        const { state } = require('../../models/models');

        if (state.statusBarItem) {
            const count = copiedFiles.length;

            if (count > 0) {
                state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''} copied`;
                state.statusBarItem.show();
            } else {
                state.statusBarItem.hide();
            }
        }
    }

    private createFolderTreeService(): IFolderTreeService {
        const folderService = this.resolve<FolderService>('FolderService');
        const treeService = this.resolve<TreeService>('TreeService');
        const workspaceService = this.resolve<IWorkspaceService>('IWorkspaceService');

        return {
            getAllFolders(): Folder[] {
                return folderService.getAllFolders();
            },

            getFoldersForWorkspace(workspacePath?: string): Folder[] {
                return folderService.getFoldersForWorkspace(workspacePath);
            },

            getFolderById(id: string): Folder {
                return folderService.getFolderById(id);
            },

            buildFileTreeForFolder(folderId: string): FileNode[] {
                const folder = folderService.getFolderById(folderId);

                // Validate file URIs before building tree
                const validFiles = folder.files.filter(fileUri => {
                    try {
                        const uri = new URL(fileUri);
                        return uri.protocol === 'file:';
                    } catch {
                        return false;
                    }
                });

                return treeService.buildFileTree(validFiles);
            },

            getCurrentWorkspaceFolder(): string | undefined {
                return workspaceService.getCurrentWorkspaceFolder();
            }
        };
    }

    register<T>(key: string, service: T): void {
        if (this.services.has(key)) {
            console.warn(`Service already registered: ${key}. Skipping duplicate registration.`);
            return;
        }
        this.services.set(key, service);
    }

    resolve<T>(key: string): T {
        const service = this.services.get(key);
        if (!service) {
            throw new Error(`Service not registered: ${key}`);
        }
        return service;
    }

    dispose(): void {
        // Dispose folder storage if it has a dispose method
        const folderStorage = this.services.get('IFolderRepository');
        if (folderStorage && typeof folderStorage.dispose === 'function') {
            folderStorage.dispose();
        }

        this.services.clear();
        this.isInitialized = false;

        Logger.debug('ServiceContainer disposed with enhanced cleanup');
    }
}