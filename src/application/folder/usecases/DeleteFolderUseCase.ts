import { FolderService } from '../../../domain/folder/services/FolderService';

export interface DeleteFolderRequest {
    folderId: string;
    confirmDelete: boolean;
}

export interface DeleteFolderResponse {
    success: boolean;
    deletedFolderName: string;
}

export class DeleteFolderUseCase {
    constructor(private readonly folderService: FolderService) { }

    async execute(request: DeleteFolderRequest): Promise<DeleteFolderResponse> {
        if (!request.confirmDelete) {
            throw new Error('Delete operation must be confirmed');
        }

        const folder = this.folderService.getFolderById(request.folderId);
        const folderName = folder.name;

        const success = this.folderService.deleteFolder(request.folderId);

        return {
            success,
            deletedFolderName: folderName
        };
    }
}