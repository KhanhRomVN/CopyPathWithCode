import { Folder } from '../../../domain/folder/entities/Folder';
import { FolderService } from '../../../domain/folder/services/FolderService';

export interface RenameFolderRequest {
    folderId: string;
    newName: string;
}

export interface RenameFolderResponse {
    folder: Folder;
    oldName: string;
}

export class RenameFolderUseCase {
    constructor(private readonly folderService: FolderService) { }

    async execute(request: RenameFolderRequest): Promise<RenameFolderResponse> {
        const folder = this.folderService.getFolderById(request.folderId);
        const oldName = folder.name;

        const updatedFolder = this.folderService.renameFolder(request.folderId, request.newName);

        return {
            folder: updatedFolder,
            oldName
        };
    }
}