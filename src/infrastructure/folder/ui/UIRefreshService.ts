import * as vscode from 'vscode';
import { IUIRefreshService } from '../../../application/folder/service/FolderApplicationService';

export class VSCodeUIRefreshService implements IUIRefreshService {
    constructor(private readonly treeDataProvider: any) { }

    refreshFolderTree(): void {
        this.treeDataProvider.refresh();
    }

    exitFileManagementMode(): void {
        if (this.treeDataProvider.isInFileManagementMode()) {
            this.treeDataProvider.exitFileManagementMode();
        }
    }

    refreshClipboard(): void {
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
    }

    refreshStatusBar(): void {
        // Implementation depends on your status bar setup
        vscode.commands.executeCommand('copy-path-with-code.updateStatusBar');
    }
}