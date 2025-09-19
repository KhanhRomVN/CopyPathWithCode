import { ClipboardService } from '../../../domain/clipboard/services/ClipboardService';
import { IClipboardNotificationService } from '../../../infrastructure/clipboard/ui/ClipboardNotificationService';

export class SaveToTempUseCase {
    constructor(
        private readonly clipboardService: ClipboardService,
        private readonly notificationService: IClipboardNotificationService
    ) { }

    async execute(): Promise<void> {
        try {
            const copiedFiles = this.clipboardService.getCopiedFiles();

            if (copiedFiles.length === 0) {
                this.notificationService.showWarning('No files copied to save to temporary storage');
                return;
            }

            const hasValidContent = await this.clipboardService.checkClipboardIntegrity();
            if (!hasValidContent) {
                this.notificationService.showWarning('Cannot save to temporary storage: clipboard content was modified');
                return;
            }

            // Save to temp storage
            await this.clipboardService.saveToTemp();

            // Clear current clipboard after saving to temp
            await this.clipboardService.clearCopiedFiles();

            this.notificationService.showInfo(`Saved ${copiedFiles.length} files to temporary storage`);
        } catch (error) {
            this.notificationService.showError(
                `Failed to save to temp: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}