import { Folder } from '../entities/Folder';
import { FolderValidator } from '../validators/FolderValidator';

export interface IFolderRepository {
    findAll(): Folder[];
    findById(id: string): Folder | undefined;
    findByName(name: string): Folder | undefined;
    findByWorkspace(workspacePath: string): Folder[];
    save(folder: Folder): void;
    delete(id: string): boolean;
    exists(id: string): boolean;
}

export class FolderService {
    constructor(
        private readonly folderRepository: IFolderRepository,
        private readonly validator: FolderValidator
    ) { }

    createFolder(name: string, workspaceFolder?: string): Folder {
        // Validate input
        this.validator.validateFolderName(name);

        // Check if folder with same name already exists in workspace
        const existingFolder = this.findFolderByNameInWorkspace(name, workspaceFolder);
        if (existingFolder) {
            throw new Error(`Folder "${name}" already exists in this workspace`);
        }

        // Create and save folder
        const folder = Folder.create(name, workspaceFolder);
        this.folderRepository.save(folder);

        return folder;
    }

    renameFolder(folderId: string, newName: string): Folder {
        // Validate input
        this.validator.validateFolderName(newName);

        // Find folder
        const folder = this.folderRepository.findById(folderId);
        if (!folder) {
            throw new Error(`Folder not found: ${folderId}`);
        }

        // Check for name conflicts in same workspace
        const conflictingFolder = this.findFolderByNameInWorkspace(newName, folder.workspaceFolder);
        if (conflictingFolder && conflictingFolder.id !== folderId) {
            throw new Error(`Folder "${newName}" already exists in this workspace`);
        }

        // Rename and save
        folder.rename(newName);
        this.folderRepository.save(folder);

        return folder;
    }

    deleteFolder(folderId: string): boolean {
        // Check if folder exists
        if (!this.folderRepository.exists(folderId)) {
            throw new Error(`Folder not found: ${folderId}`);
        }

        return this.folderRepository.delete(folderId);
    }

    getAllFolders(): Folder[] {
        return this.folderRepository.findAll();
    }

    getFolderById(folderId: string): Folder {
        const folder = this.folderRepository.findById(folderId);
        if (!folder) {
            throw new Error(`Folder not found: ${folderId}`);
        }
        return folder;
    }

    getFoldersForWorkspace(workspacePath?: string): Folder[] {
        if (!workspacePath) {
            // Return folders without workspace (legacy folders)
            return this.folderRepository.findAll().filter(f => !f.workspaceFolder);
        }

        return this.folderRepository.findByWorkspace(workspacePath);
    }

    addFileToFolder(folderId: string, fileUri: string): void {
        const folder = this.getFolderById(folderId);

        // Validate file URI
        this.validator.validateFileUri(fileUri);

        const added = folder.addFile(fileUri);
        if (added) {
            this.folderRepository.save(folder);
        }
    }

    addFilesToFolder(folderId: string, fileUris: string[]): number {
        const folder = this.getFolderById(folderId);

        // Validate all file URIs
        fileUris.forEach(uri => this.validator.validateFileUri(uri));

        const addedCount = folder.addFiles(fileUris);
        if (addedCount > 0) {
            this.folderRepository.save(folder);
        }

        return addedCount;
    }

    removeFileFromFolder(folderId: string, fileUri: string): boolean {
        const folder = this.getFolderById(folderId);

        const removed = folder.removeFile(fileUri);
        if (removed) {
            this.folderRepository.save(folder);
        }

        return removed;
    }

    removeFilesFromFolder(folderId: string, fileUris: string[]): number {
        const folder = this.getFolderById(folderId);

        const removedCount = folder.removeFiles(fileUris);
        if (removedCount > 0) {
            this.folderRepository.save(folder);
        }

        return removedCount;
    }

    removeDeletedFilesFromAllFolders(deletedFileUris: string[]): number {
        let totalRemoved = 0;
        const folders = this.folderRepository.findAll();

        for (const folder of folders) {
            const removedCount = folder.removeFiles(deletedFileUris);
            if (removedCount > 0) {
                this.folderRepository.save(folder);
                totalRemoved += removedCount;
            }
        }

        return totalRemoved;
    }

    private findFolderByNameInWorkspace(name: string, workspacePath?: string): Folder | undefined {
        const workspaceFolders = this.getFoldersForWorkspace(workspacePath);
        return workspaceFolders.find(f => f.name === name);
    }
}