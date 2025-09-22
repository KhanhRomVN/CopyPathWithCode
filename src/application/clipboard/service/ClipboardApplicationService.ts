import { CopyFileContentUseCase } from '../usecases/CopyFileContentUseCase';
import { ClearClipboardUseCase } from '../usecases/ClearClipboardUseCase';

export interface IClipboardUIRefreshService {
    refreshClipboardView(): void;
    updateStatusBar(): void;
}

export class ClipboardApplicationService {
    constructor(
        private readonly copyFileContentUseCase: CopyFileContentUseCase,
        private readonly clearClipboardUseCase: ClearClipboardUseCase,
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
}