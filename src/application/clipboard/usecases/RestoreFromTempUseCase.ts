import { ClipboardService } from '../../../domain/clipboard/services/ClipboardService';
import { IClipboardNotificationService } from '../../../infrastructure/clipboard/ui/ClipboardNotificationService';

export class RestoreFromTempUseCase {
    constructor(
        private readonly clipboardService: ClipboardService,
        private readonly notificationService: IClipboardNotificationService
    ) { }

    async execute(): Promise<void> {
        try {
            const tempFiles = this.clipboardService.getTempFiles();

            if (tempFiles.length === 0) {
                this.notificationService.showWarning('No files in temporary storage to restore');
                return;
            }

            const success = this.clipboardService.restoreFromTemp();
            if (success) {
                await this.clipboardService.updateSystemClipboard();
                this.notificationService.showInfo(`Restored ${tempFiles.length} files from temporary storage`);
            }
        } catch (error) {
            this.notificationService.showError(
                `Failed to restore from temp: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}