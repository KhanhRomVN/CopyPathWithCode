import { CopyFileContentUseCase } from '../usecases/CopyFileContentUseCase';
import { ClearClipboardUseCase } from '../usecases/ClearClipboardUseCase';
import { SaveToTempUseCase, TransferTempToSystemUseCase, ClearTempStorageUseCase } from '../usecases/TempClipboardUseCases';

export interface IClipboardUIRefreshService {
    refreshClipboardView(): void;
    updateStatusBar(): void;
}

export class ClipboardApplicationService {
    constructor(
        private readonly copyFileContentUseCase: CopyFileContentUseCase,
        private readonly clearClipboardUseCase: ClearClipboardUseCase,
        private readonly saveToTempUseCase: SaveToTempUseCase,
        private readonly transferTempToSystemUseCase: TransferTempToSystemUseCase, // CHANGED from restoreFromTempUseCase
        private readonly clearTempStorageUseCase: ClearTempStorageUseCase,
        private readonly uiRefreshService: IClipboardUIRefreshService
    ) { }

    async copyPathWithContent(): Promise<void> {
        await this.copyFileContentUseCase.execute(false);
        // Automatically save to temp storage after copying
        await this.saveToTempUseCase.execute();
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    async copyPathWithContentAndError(): Promise<void> {
        await this.copyFileContentUseCase.execute(true);
        // Automatically save to temp storage after copying
        await this.saveToTempUseCase.execute();
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    async clearClipboard(): Promise<void> {
        await this.clearClipboardUseCase.execute();
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    // Temporary storage operations
    async saveToTempStorage(): Promise<void> {
        await this.saveToTempUseCase.execute();
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    // NEW: Transfer temp storage to system clipboard (replaces restore)
    async transferTempToSystem(): Promise<void> {
        await this.transferTempToSystemUseCase.execute();
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    async clearTempStorage(): Promise<void> {
        await this.clearTempStorageUseCase.execute();
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }
}