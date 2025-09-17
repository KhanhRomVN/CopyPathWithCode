import { Folder } from '../../../domain/folder/entities/Folder';
import { FolderService } from '../../../domain/folder/services/FolderService';

export interface CreateFolderRequest {
    name: string;
    workspaceFolder?: string;
    includeOpenFiles?: boolean;
    openFileUris?: string[];
}

export interface CreateFolderResponse {
    folder: Folder;
    addedFilesCount: number;
}

export class CreateFolderUseCase {
    constructor(private readonly folderService: FolderService) { }

    async execute(request: CreateFolderRequest): Promise<CreateFolderResponse> {
        // Create the folder
        const folder = this.folderService.createFolder(request.name, request.workspaceFolder);

        let addedFilesCount = 0;

        // Add open files if requested
        if (request.includeOpenFiles && request.openFileUris && request.openFileUris.length > 0) {
            addedFilesCount = this.folderService.addFilesToFolder(folder.id, request.openFileUris);
        }

        return {
            folder,
            addedFilesCount
        };
    }
}