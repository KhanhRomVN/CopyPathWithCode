/**
 * Updated ServiceContainer with Transfer Functionality
 * REMOVED RESTORE FUNCTIONALITY, ADDED TRANSFER FUNCTIONALITY
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
import { TempStorageService, ITempStorageRepository } from '../../domain/clipboard/services/TempStorageService';

// Infrastructure Services - Folder
import { FileSystemFolderStorage } from '../folder/storage/FileSystemFolderStorage';
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
import { TempStorage } from '../clipboard/storage/TempStorage';

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
import { SaveToTempUseCase, TransferTempToSystemUseCase, ClearTempStorageUseCase } from '../../application/clipboard/usecases/TempClipboardUseCases';
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
        // Folder Infrastructure Services
        const folderStorage = new FileSystemFolderStorage(context);
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

        // Temporary Storage Infrastructure
        const tempStorage = new TempStorage(context);
        this.register<ITempStorageRepository>('ITempStorageRepository', tempStorage);
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

        // Temporary Storage Domain Service
        const tempStorageRepository = this.resolve<ITempStorageRepository>('ITempStorageRepository');
        const tempStorageService = new TempStorageService(tempStorageRepository);
        this.register('TempStorageService', tempStorageService);
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

        // Clipboard Use Cases
        const clipboardService = this.resolve<ClipboardService>('ClipboardService');
        const clipboardNotificationService = this.resolve<IClipboardNotificationService>('IClipboardNotificationService');
        const tempStorageService = this.resolve<TempStorageService>('TempStorageService');

        const copyFileContentUseCase = new CopyFileContentUseCase(clipboardService, clipboardNotificationService);
        this.register('CopyFileContentUseCase', copyFileContentUseCase);

        const clearClipboardUseCase = new ClearClipboardUseCase(clipboardService, clipboardNotificationService);
        this.register('ClearClipboardUseCase', clearClipboardUseCase);

        // Temporary Storage Use Cases (UPDATED - Removed Restore, Added Transfer)
        const saveToTempUseCase = new SaveToTempUseCase(tempStorageService, clipboardService, clipboardNotificationService);
        this.register('SaveToTempUseCase', saveToTempUseCase);

        const transferTempToSystemUseCase = new TransferTempToSystemUseCase(tempStorageService, clipboardService, clipboardNotificationService);
        this.register('TransferTempToSystemUseCase', transferTempToSystemUseCase);

        const clearTempStorageUseCase = new ClearTempStorageUseCase(tempStorageService, clipboardNotificationService);
        this.register('ClearTempStorageUseCase', clearTempStorageUseCase);
    }

    private registerClipboardServices(): void {
        // Clipboard services are already registered in registerApplicationServices
        // This method kept for consistency
    }

    private registerTreeService(): void {
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

            // Enhanced Clipboard Application Service with temp storage (UPDATED)
            const clipboardApplicationService = new ClipboardApplicationService(
                this.resolve('CopyFileContentUseCase'),
                this.resolve('ClearClipboardUseCase'),
                clipboardUIRefreshService
            );
            this.register('ClipboardApplicationService', clipboardApplicationService);

            // Register clipboard provider
            this.register('ClipboardProvider', clipboardProvider);
        }
    }

    public updateClipboardStatusBar(): void {
        const clipboardService = this.resolve<ClipboardService>('ClipboardService');
        const copiedFiles = clipboardService.getCopiedFiles();
        const tempStorageService = this.resolve<TempStorageService>('TempStorageService');
        const tempStats = tempStorageService.getTempStats();

        // Import state dynamically to avoid circular dependency
        const { state } = require('../../models/models');

        if (state.statusBarItem) {
            const systemCount = copiedFiles.length;
            const tempCount = tempStats.count;

            // FIXED: Show statusbar only if there are actually files
            if (systemCount > 0 || tempCount > 0) {
                let statusText = '';

                // Show system clipboard files if available
                if (systemCount > 0) {
                    statusText = `$(clippy) ${systemCount} system`;
                }

                // Show temp storage files if available
                if (tempCount > 0) {
                    if (statusText) {
                        statusText += ` | $(archive) ${tempCount} temp`;
                    } else {
                        statusText = `$(archive) ${tempCount} temp`;
                    }
                }

                state.statusBarItem.text = statusText;
                state.statusBarItem.show();
            } else {
                // FIXED: Hide statusbar when no files exist
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

        // Dispose temp storage if it has a dispose method
        const tempStorage = this.services.get('ITempStorageRepository');
        if (tempStorage && typeof tempStorage.cleanup === 'function') {
            tempStorage.cleanup();
        }

        this.services.clear();
        this.isInitialized = false;

    }
}