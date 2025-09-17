import * as vscode from 'vscode';

export interface IEditorService {
    openFile(uri: string, options?: { preview?: boolean; viewColumn?: vscode.ViewColumn }): Promise<void>;
    closeAllEditors(): Promise<void>;
    getOpenEditors(): string[];
    isFileOpen(uri: string): boolean;
}

export class VSCodeEditorService implements IEditorService {

    async openFile(uri: string, options?: { preview?: boolean; viewColumn?: vscode.ViewColumn }): Promise<void> {
        const vscodeUri = vscode.Uri.parse(uri);
        await vscode.window.showTextDocument(vscodeUri, {
            preview: options?.preview ?? false,
            viewColumn: options?.viewColumn
        });
    }

    async closeAllEditors(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }

    getOpenEditors(): string[] {
        return vscode.window.visibleTextEditors
            .filter(editor => editor.document.uri.scheme === 'file')
            .map(editor => editor.document.uri.toString());
    }

    isFileOpen(uri: string): boolean {
        const vscodeUri = vscode.Uri.parse(uri);
        return vscode.window.visibleTextEditors.some(
            editor => editor.document.uri.toString() === vscodeUri.toString()
        );
    }
}