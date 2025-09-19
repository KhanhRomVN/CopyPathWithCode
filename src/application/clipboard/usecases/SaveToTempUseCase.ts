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

            const success = this.clipboardService.saveToTemp();
            if (success) {
                await this.clipboardService.updateSystemClipboard();
                this.notificationService.showInfo(`Saved ${copiedFiles.length} files to temporary storage`);
            }
        } catch (error) {
            this.notificationService.showError(
                `Failed to save to temp: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}