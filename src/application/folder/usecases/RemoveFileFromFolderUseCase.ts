import { Folder } from '../../../domain/folder/entities/Folder';
import { FolderService } from '../../../domain/folder/services/FolderService';

export interface RemoveFileFromFolderRequest {
    folderId: string;
    fileUris: string[];
}

export interface RemoveFileFromFolderResponse {
    folder: Folder;
    removedCount: number;
    notFoundCount: number;
}

export class RemoveFileFromFolderUseCase {
    constructor(private readonly folderService: FolderService) { }

    async execute(request: RemoveFileFromFolderRequest): Promise<RemoveFileFromFolderResponse> {
        const folder = this.folderService.getFolderById(request.folderId);
        const initialCount = folder.fileCount;

        const removedCount = this.folderService.removeFilesFromFolder(request.folderId, request.fileUris);
        const notFoundCount = request.fileUris.length - removedCount;

        return {
            folder: this.folderService.getFolderById(request.folderId), // Get updated folder
            removedCount,
            notFoundCount
        };
    }
}
