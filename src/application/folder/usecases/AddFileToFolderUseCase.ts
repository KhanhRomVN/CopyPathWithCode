import { Folder } from '../../../domain/folder/entities/Folder';
import { FolderService } from '../../../domain/folder/services/FolderService';
import { FileService } from '../../../domain/folder/services/FileService';

export interface AddFileToFolderRequest {
    folderId: string;
    fileUris: string[];
    validateFiles?: boolean;
}

export interface AddFileToFolderResponse {
    folder: Folder;
    addedCount: number;
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
        let fileUrisToAdd = request.fileUris;
        const invalidFiles: string[] = [];

        // Validate files if requested
        if (request.validateFiles) {
            const validUris = await this.fileService.validateFileUris(request.fileUris);
            invalidFiles.push(...request.fileUris.filter(uri => !validUris.includes(uri)));
            fileUrisToAdd = validUris;
        }

        const initialCount = folder.fileCount;
        const addedCount = this.folderService.addFilesToFolder(request.folderId, fileUrisToAdd);
        const skippedCount = fileUrisToAdd.length - addedCount;

        return {
            folder: this.folderService.getFolderById(request.folderId), // Get updated folder
            addedCount,
            skippedCount,
            invalidFiles
        };
    }
}