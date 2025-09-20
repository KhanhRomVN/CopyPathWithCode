/**
 * FILE: src/application/clipboard/usecases/TempClipboardUseCases.ts
 * 
 * TEMPORARY CLIPBOARD USE CASES - UPDATED WITH TRANSFER FUNCTIONALITY
 * 
 * Application layer use cases for managing workspace-specific temporary clipboard storage.
 * Added TransferTempToSystemUseCase to replace the restore functionality.
 */

import { TempStorageService } from '../../../domain/clipboard/services/TempStorageService';
import { ClipboardService } from '../../../domain/clipboard/services/ClipboardService';
import { IClipboardNotificationService } from '../../../infrastructure/clipboard/ui/ClipboardNotificationService';

export class SaveToTempUseCase {
    constructor(
        private readonly tempStorageService: TempStorageService,
        private readonly clipboardService: ClipboardService,
        private readonly notificationService: IClipboardNotificationService
    ) { }

    async execute(): Promise<void> {
        try {
            const copiedFiles = this.clipboardService.getCopiedFiles();

            if (copiedFiles.length === 0) {
                this.notificationService.showWarning('No files to save to temporary storage');
                return;
            }

            await this.tempStorageService.saveToTempStorage(copiedFiles);

            const stats = this.tempStorageService.getTempStats();
            this.notificationService.showInfo(
                `Saved ${stats.count} file${stats.count > 1 ? 's' : ''} to workspace temporary storage`
            );
        } catch (error) {
            this.notificationService.showError(
                `Failed to save to temporary storage: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}

// NEW: Transfer temp storage to system clipboard instead of restoring
export class TransferTempToSystemUseCase {
    constructor(
        private readonly tempStorageService: TempStorageService,
        private readonly clipboardService: ClipboardService,
        private readonly notificationService: IClipboardNotificationService
    ) { }

    async execute(): Promise<void> {
        try {
            const tempFiles = this.tempStorageService.getTempFiles();

            if (tempFiles.length === 0) {
                this.notificationService.showWarning('No files in workspace temporary storage to transfer');
                return;
            }

            // Convert TempClipboardFile to CopiedFile format
            const copiedFiles = tempFiles.map(tempFile => ({
                displayPath: tempFile.displayPath,
                basePath: tempFile.basePath,
                content: tempFile.content,
                format: tempFile.format
            }));

            // Set the copied files and update system clipboard
            await this.clipboardService.setCopiedFiles(copiedFiles);

            // FIXED: Clear temp storage after successful transfer
            await this.tempStorageService.clearTempStorage();

            this.notificationService.showInfo(
                `Transferred ${tempFiles.length} file${tempFiles.length > 1 ? 's' : ''} from temp storage to system clipboard`
            );
        } catch (error) {
            this.notificationService.showError(
                `Failed to transfer from temporary storage: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}

export class ClearTempStorageUseCase {
    constructor(
        private readonly tempStorageService: TempStorageService,
        private readonly notificationService: IClipboardNotificationService
    ) { }

    async execute(): Promise<void> {
        try {
            const stats = this.tempStorageService.getTempStats();

            if (stats.count === 0) {
                this.notificationService.showInfo('Workspace temporary storage is already empty');
                return;
            }

            await this.tempStorageService.clearTempStorage();

            this.notificationService.showInfo(
                `Cleared ${stats.count} file${stats.count > 1 ? 's' : ''} from workspace temporary storage`
            );
        } catch (error) {
            this.notificationService.showError(
                `Failed to clear temporary storage: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}