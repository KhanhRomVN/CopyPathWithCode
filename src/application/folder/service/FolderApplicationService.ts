import { CreateFolderUseCase, CreateFolderRequest } from '../usecases/CreateFolderUseCase';
import { DeleteFolderUseCase, DeleteFolderRequest } from '../usecases/DeleteFolderUseCase';
import { RenameFolderUseCase, RenameFolderRequest } from '../usecases/RenameFolderUseCase';
import { AddFileToFolderUseCase, AddFileToFolderRequest } from '../usecases/AddFileToFolderUseCase';
import { RemoveFileFromFolderUseCase, RemoveFileFromFolderRequest } from '../usecases/RemoveFileFromFolderUseCase';
import { OpenFolderFilesUseCase, OpenFolderFilesRequest } from '../usecases/OpenFolderFilesUseCase';

export interface INotificationService {
    showInfo(message: string): void;
    showWarning(message: string): void;
    showError(message: string): void;
    showSuccess(message: string): void;
    showConfirmDialog(message: string, ...items: string[]): Promise<string | undefined>;
}

export interface IUIRefreshService {
    refreshFolderTree(): void;
    exitFileManagementMode(): void;
    refreshClipboard(): void;
}

export class FolderApplicationService {
    constructor(
        private readonly createFolderUseCase: CreateFolderUseCase,
        private readonly deleteFolderUseCase: DeleteFolderUseCase,
        private readonly renameFolderUseCase: RenameFolderUseCase,
        private readonly addFileToFolderUseCase: AddFileToFolderUseCase,
        private readonly removeFileFromFolderUseCase: RemoveFileFromFolderUseCase,
        private readonly openFolderFilesUseCase: OpenFolderFilesUseCase,
        private readonly notificationService: INotificationService,
        private readonly uiRefreshService: IUIRefreshService
    ) { }

    async handleCreateFolder(request: CreateFolderRequest): Promise<void> {
        try {
            const response = await this.createFolderUseCase.execute(request);

            this.uiRefreshService.refreshFolderTree();

            const fileInfo = response.addedFilesCount > 0
                ? ` with ${response.addedFilesCount} files`
                : '';

            this.notificationService.showSuccess(
                `Folder "${response.folder.name}" created${fileInfo}`
            );
        } catch (error) {
            this.notificationService.showError(
                `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async handleDeleteFolder(request: DeleteFolderRequest): Promise<void> {
        try {
            const response = await this.deleteFolderUseCase.execute(request);

            if (response.success) {
                this.uiRefreshService.refreshFolderTree();
                this.uiRefreshService.exitFileManagementMode();

                this.notificationService.showSuccess(
                    `Folder "${response.deletedFolderName}" deleted`
                );
            } else {
                this.notificationService.showWarning('Failed to delete folder');
            }
        } catch (error) {
            this.notificationService.showError(
                `Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async handleRenameFolder(request: RenameFolderRequest): Promise<void> {
        try {
            const response = await this.renameFolderUseCase.execute(request);

            this.uiRefreshService.refreshFolderTree();

            this.notificationService.showSuccess(
                `Folder renamed from "${response.oldName}" to "${response.folder.name}"`
            );
        } catch (error) {
            this.notificationService.showError(
                `Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async handleAddFilesToFolder(request: AddFileToFolderRequest): Promise<void> {
        try {
            const response = await this.addFileToFolderUseCase.execute(request);

            this.uiRefreshService.refreshFolderTree();

            // ENHANCED: Better message for sync mode
            if (request.mode === 'sync') {
                let message = `Updated folder "${response.folder.name}":`;

                const changes = [];
                if (response.addedCount > 0) {
                    changes.push(`${response.addedCount} added`);
                }
                if (response.removedCount > 0) {
                    changes.push(`${response.removedCount} removed`);
                }
                if (response.skippedCount > 0) {
                    changes.push(`${response.skippedCount} kept`);
                }

                if (changes.length > 0) {
                    message += ` ${changes.join(', ')}`;
                } else {
                    message = `No changes made to folder "${response.folder.name}"`;
                }

                if (response.invalidFiles.length > 0) {
                    message += ` (${response.invalidFiles.length} invalid files skipped)`;
                }

                this.notificationService.showSuccess(message);
            } else {
                // Original add-only message
                let message = `Added ${response.addedCount} file(s) to "${response.folder.name}"`;

                if (response.skippedCount > 0) {
                    message += ` (${response.skippedCount} already existed)`;
                }

                if (response.invalidFiles.length > 0) {
                    message += ` (${response.invalidFiles.length} invalid files skipped)`;
                }

                this.notificationService.showSuccess(message);
            }
        } catch (error) {
            this.notificationService.showError(
                `Failed to add files: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async handleRemoveFilesFromFolder(request: RemoveFileFromFolderRequest): Promise<void> {
        try {
            const response = await this.removeFileFromFolderUseCase.execute(request);

            this.uiRefreshService.refreshFolderTree();

            let message = `Removed ${response.removedCount} file(s) from "${response.folder.name}"`;

            if (response.notFoundCount > 0) {
                message += ` (${response.notFoundCount} files not found in folder)`;
            }

            this.notificationService.showSuccess(message);
        } catch (error) {
            this.notificationService.showError(
                `Failed to remove files: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async handleOpenFolderFiles(request: OpenFolderFilesRequest): Promise<void> {
        try {
            const response = await this.openFolderFilesUseCase.execute(request);

            let message = `Opened ${response.successCount} files from "${response.folder.name}"`;

            if (response.failureCount > 0) {
                message += ` (${response.failureCount} files could not be opened)`;
                this.notificationService.showWarning(message);
            } else {
                this.notificationService.showSuccess(message);
            }
        } catch (error) {
            this.notificationService.showError(
                `Failed to open folder files: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}