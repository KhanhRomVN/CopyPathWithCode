import * as vscode from 'vscode';
import { state } from '../models/models';

export const folderStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

export function updateActiveFolderStatus() {
    if (state.activeFolderId) {
        const f = state.folders.find(x => x.id === state.activeFolderId);
        folderStatusBarItem.text = `Active Folder: ${f?.name ?? ''}`;
        folderStatusBarItem.color = f?.color ? new vscode.ThemeColor(f.color) : undefined;
    } else {
        folderStatusBarItem.text = 'No Active Folder';
        folderStatusBarItem.color = undefined;
    }
}

export function updateTabDecorations(editor: vscode.TextEditor | undefined) {
    const tabDecorator = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground'),
        border: '1px solid'
    });

    if (!editor || !state.activeFolderId) {
        return;
    }
    const folder = state.folders.find(f => f.id === state.activeFolderId);
    if (!folder) { return; }
    const uri = editor.document.uri.toString();
    if (folder.files.includes(uri)) {
        const range = new vscode.Range(0, 0, 0, 0);
        editor.setDecorations(tabDecorator, [{ range, hoverMessage: `Part of folder: ${folder.name}` }]);
    } else {
        editor.setDecorations(tabDecorator, []);
    }
}
