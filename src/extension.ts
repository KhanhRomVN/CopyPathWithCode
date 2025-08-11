import * as vscode from 'vscode';
import { state } from './models/models';
import { loadFolders } from './utils/folderUtils';
import { updateActiveFolderStatus, folderStatusBarItem, updateTabDecorations } from './utils/uiUtils';
import { FolderTreeDataProvider } from './providers/folderTreeDataProvider';
import { registerAllCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
    loadFolders(context);

    const treeDataProvider = new FolderTreeDataProvider();
    vscode.window.createTreeView('folderManager', { treeDataProvider });

    registerAllCommands(context);

    const editListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        updateActiveFolderStatus();
        updateTabDecorations(editor);
    });

    context.subscriptions.push(
        editListener,
        folderStatusBarItem
    );

    updateActiveFolderStatus();
    folderStatusBarItem.show();
}

export function deactivate() {
    state.copiedFiles.length = 0;
    state.folders.length = 0;
    state.activeFolderId = null;
    folderStatusBarItem.dispose();
}
