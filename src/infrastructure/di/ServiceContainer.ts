/**
 * Updated ServiceContainer with proper FolderProvider integration and fixed registrations
 */

import * as vscode from 'vscode';

// Domain Services
import { FolderService, IFolderRepository } from '../../domain/folder/services/FolderService';
import { FileService, IFileSystemService } from '../../domain/folder/services/FileService';
import { TreeService, IPathService } from '../../domain/folder/services/TreeService';
import { FolderValidator } from '../../domain/folder/validators/FolderValidator';

// Infrastructure Services
import { FolderStorage } from '../folder/storage/FolderStorage';
import { VSCodeFileSystemService } from '../folder/filesystem/FileSystemService';
import { VSCodeWorkspaceService, IWorkspaceService } from '../folder/workspace/WorkspaceService';
import { VSCodeNotificationService } from '../folder/ui/NotificationService';
import { VSCodeUIRefreshService } from '../folder/ui/UIRefreshService';
import { VSCodeEditorService, IEditorService } from '../folder/ui/EditorService';
import { NodePathService } from '../shared/PathService';

// Application Services
import { CreateFolderUseCase } from '../../application/folder/usecases/CreateFolderUseCase';
import { DeleteFolderUseCase } from '../../application/folder/usecases/DeleteFolderUseCase';
import { RenameFolderUseCase } from '../../application/folder/usecases/RenameFolderUseCase';
import { AddFileToFolderUseCase } from '../../application/folder/usecases/AddFileToFolderUseCase';
import { RemoveFileFromFolderUseCase } from '../../application/folder/usecases/RemoveFileFromFolderUseCase';
import { OpenFolderFilesUseCase } from '../../application/folder/usecases/OpenFolderFilesUseCase';
import { FolderApplicationService, INotificationService, IUIRefreshService } from '../../application/folder/service/FolderApplicationService';

// Types for FolderProvider dependency
import { Folder } from '../../domain/folder/entities/Folder';
import { FileNode } from '../../domain/folder/entities/FileNode';

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

        this.isInitialized = true;
    }

    private registerInfrastructureServices(context: vscode.ExtensionContext): void {
        // Storage
        const folderStorage = new FolderStorage(context);
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
    }

    private registerDomainServices(): void {
        const folderRepository = this.resolve<IFolderRepository>('IFolderRepository');
        const fileSystemService = this.resolve<IFileSystemService>('IFileSystemService');
        const pathService = this.resolve<IPathService>('IPathService');

        // Validator
        const folderValidator = new FolderValidator();
        this.register('FolderValidator', folderValidator);

        // Domain Services
        const folderService = new FolderService(folderRepository, folderValidator);
        this.register('FolderService', folderService);

        const fileService = new FileService(fileSystemService);
        this.register('FileService', fileService);

        const treeService = new TreeService(pathService);
        this.register('TreeService', treeService);
    }

    private registerApplicationServices(): void {
        const folderService = this.resolve<FolderService>('FolderService');
        const fileService = this.resolve<FileService>('FileService');

        // Use Cases
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
    }

    private registerTreeService(): void {
        // Create folder tree service adapter
        const folderTreeService = this.createFolderTreeService();
        this.register<IFolderTreeService>('IFolderTreeService', folderTreeService);
    }

    // Call this after FolderProvider is created to complete the dependency chain
    registerUIServices(treeDataProvider: any): void {
        // UI Refresh Service (needs tree data provider)
        const uiRefreshService = new VSCodeUIRefreshService(treeDataProvider);
        this.register<IUIRefreshService>('IUIRefreshService', uiRefreshService);

        // Command Handler
        const commandHandler = new FolderApplicationService(
            this.resolve('CreateFolderUseCase'),
            this.resolve('DeleteFolderUseCase'),
            this.resolve('RenameFolderUseCase'),
            this.resolve('AddFileToFolderUseCase'),
            this.resolve('RemoveFileFromFolderUseCase'),
            this.resolve('OpenFolderFilesUseCase'),
            this.resolve<INotificationService>('INotificationService'),
            uiRefreshService
        );
        this.register('FolderApplicationService', commandHandler);

        // Also register the FolderProvider instance for command access
        this.register('FolderProvider', treeDataProvider);
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
        this.services.clear();
        this.isInitialized = false;
    }
}