import * as vscode from 'vscode';
import { INotificationService } from '../../../application/folder/service/FolderApplicationService';

export class VSCodeNotificationService implements INotificationService {

    showInfo(message: string): void {
        vscode.window.showInformationMessage(message);
    }

    showWarning(message: string): void {
        vscode.window.showWarningMessage(message);
    }

    showError(message: string): void {
        vscode.window.showErrorMessage(message);
    }

    showSuccess(message: string): void {
        // VS Code doesn't have a separate success notification, use info
        vscode.window.showInformationMessage(`✓ ${message}`);
    }

    async showQuickPick<T extends vscode.QuickPickItem>(items: T[], options?: vscode.QuickPickOptions): Promise<T | undefined> {
        return await vscode.window.showQuickPick(items, options);
    }

    async showInputBox(options?: vscode.InputBoxOptions): Promise<string | undefined> {
        return await vscode.window.showInputBox(options);
    }

    async showConfirmDialog(message: string, ...items: string[]): Promise<string | undefined> {
        return await vscode.window.showWarningMessage(message, { modal: true }, ...items);
    }
}