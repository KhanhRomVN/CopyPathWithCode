import { Folder } from '../../../domain/folder/entities/Folder';
import { FolderService } from '../../../domain/folder/services/FolderService';
import { FileService } from '../../../domain/folder/services/FileService';

export interface AddFileToFolderRequest {
    folderId: string;
    fileUris: string[];
    validateFiles?: boolean;
    // NEW: Add mode to distinguish between pure add vs. sync operation
    mode?: 'add' | 'sync';
}

export interface AddFileToFolderResponse {
    folder: Folder;
    addedCount: number;
    removedCount: number; // NEW: Track removed files
    skippedCount: number;
    invalidFiles: string[];
}

export class AddFileToFolderUseCase {
    constructor(
        private readonly folderService: FolderService,
        private readonly fileService: FileService
    ) { }

    async execute(request: AddFileToFolderRequest): Promise<AddFileToFolderResponse> {
        const folder = this.folderService.getFolderById(request.folderId);
        let fileUrisToProcess = request.fileUris;
        const invalidFiles: string[] = [];

        // Validate files if requested
        if (request.validateFiles) {
            const validUris = await this.fileService.validateFileUris(request.fileUris);
            invalidFiles.push(...request.fileUris.filter(uri => !validUris.includes(uri)));
            fileUrisToProcess = validUris;
        }

        let addedCount = 0;
        let removedCount = 0;
        let skippedCount = 0;

        // ENHANCED: Handle sync mode for "Add Files to Folder" operation
        if (request.mode === 'sync') {
            // In sync mode, we need to:
            // 1. Add new selected files
            // 2. Remove previously existing files that are now unselected

            const currentFiles = new Set(folder.files);
            const selectedFiles = new Set(fileUrisToProcess);

            // Files to add: selected files that aren't currently in folder
            const filesToAdd = fileUrisToProcess.filter(uri => !currentFiles.has(uri));

            // Files to remove: current files that are no longer selected
            const filesToRemove = Array.from(currentFiles).filter(uri => !selectedFiles.has(uri));

            // Add new files
            addedCount = this.folderService.addFilesToFolder(request.folderId, filesToAdd);

            // Remove unselected files
            removedCount = this.folderService.removeFilesFromFolder(request.folderId, filesToRemove);

            // Count skipped (files that were already in folder and still selected)
            skippedCount = fileUrisToProcess.length - filesToAdd.length;

        } else {
            // Original add-only mode
            const initialCount = folder.fileCount;
            addedCount = this.folderService.addFilesToFolder(request.folderId, fileUrisToProcess);
            skippedCount = fileUrisToProcess.length - addedCount;
        }

        return {
            folder: this.folderService.getFolderById(request.folderId), // Get updated folder
            addedCount,
            removedCount,
            skippedCount,
            invalidFiles
        };
    }
}