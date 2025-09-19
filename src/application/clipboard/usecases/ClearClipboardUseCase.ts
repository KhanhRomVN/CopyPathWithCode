import { ClipboardService } from '../../../domain/clipboard/services/ClipboardService';
import { IClipboardNotificationService } from '../../../infrastructure/clipboard/ui/ClipboardNotificationService';

export class ClearClipboardUseCase {
    constructor(
        private readonly clipboardService: ClipboardService,
        private readonly notificationService: IClipboardNotificationService
    ) { }

    async execute(): Promise<void> {
        try {
            // Clear both copied and detected files
            await this.clipboardService.clearCopiedFiles();
            await this.clipboardService.clearDetectedFiles();

            this.notificationService.showInfo('Clipboard cleared');
        } catch (error) {
            this.notificationService.showError(
                `Failed to clear clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}