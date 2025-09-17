import { Folder } from '../../../domain/folder/entities/Folder';
import { FolderService } from '../../../domain/folder/services/FolderService';
import { FileService } from '../../../domain/folder/services/FileService';

export interface OpenFolderFilesRequest {
    folderId: string;
    closeExistingTabs?: boolean;
    validateFiles?: boolean;
}

export interface OpenFolderFilesResponse {
    folder: Folder;
    successCount: number;
    failureCount: number;
    failedFiles: string[];
}

export class OpenFolderFilesUseCase {
    constructor(
        private readonly folderService: FolderService,
        private readonly fileService: FileService
    ) { }

    async execute(request: OpenFolderFilesRequest): Promise<OpenFolderFilesResponse> {
        const folder = this.folderService.getFolderById(request.folderId);
        const failedFiles: string[] = [];
        let successCount = 0;

        // Validate files if requested
        let filesToOpen = folder.files;
        if (request.validateFiles) {
            filesToOpen = await this.fileService.validateFileUris([...folder.files]);
        }

        // This would be implemented by the infrastructure layer
        // For now, we just track which files would succeed/fail
        for (const fileUri of filesToOpen) {
            try {
                const isValid = await this.fileService.validateFileUri(fileUri);
                if (isValid) {
                    successCount++;
                } else {
                    failedFiles.push(fileUri);
                }
            } catch (error) {
                failedFiles.push(fileUri);
            }
        }

        return {
            folder,
            successCount,
            failureCount: failedFiles.length,
            failedFiles
        };
    }
}