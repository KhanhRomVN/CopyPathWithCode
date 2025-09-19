import { CopyFileContentUseCase } from '../usecases/CopyFileContentUseCase';
import { ClearClipboardUseCase } from '../usecases/ClearClipboardUseCase';
import { SaveToTempUseCase } from '../usecases/SaveToTempUseCase';
import { RestoreFromTempUseCase } from '../usecases/RestoreFromTempUseCase';

export interface IClipboardUIRefreshService {
    refreshClipboardView(): void;
    updateStatusBar(): void;
}

export class ClipboardApplicationService {
    constructor(
        private readonly copyFileContentUseCase: CopyFileContentUseCase,
        private readonly clearClipboardUseCase: ClearClipboardUseCase,
        private readonly saveToTempUseCase: SaveToTempUseCase,
        private readonly restoreFromTempUseCase: RestoreFromTempUseCase,
        private readonly uiRefreshService: IClipboardUIRefreshService
    ) { }

    async copyPathWithContent(): Promise<void> {
        await this.copyFileContentUseCase.execute(false);
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    async copyPathWithContentAndError(): Promise<void> {
        await this.copyFileContentUseCase.execute(true);
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    async clearClipboard(): Promise<void> {
        await this.clearClipboardUseCase.execute();
        this.uiRefreshService.updateStatusBar();
        this.uiRefreshService.refreshClipboardView();
    }

    async saveClipboardToTemp(): Promise<void> {
        await this.saveToTempUseCase.execute();
        this.uiRefreshService.updateStatusBar();
    }

    async restoreClipboardFromTemp(): Promise<void> {
        await this.restoreFromTempUseCase.execute();
        this.uiRefreshService.updateStatusBar();
    }
}