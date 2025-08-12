import * as vscode from 'vscode';
import { state } from './models/models';
import { loadFolders } from './utils/folderUtils';
import { FolderTreeDataProvider } from './providers/folderTreeDataProvider';
import { registerAllCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
    loadFolders(context);

    const treeDataProvider = new FolderTreeDataProvider();
    vscode.window.createTreeView('folderManager', { treeDataProvider });

    // truyền instance của treeDataProvider vào đăng ký command
    registerAllCommands(context, treeDataProvider);



}

export function deactivate() {
    state.copiedFiles.length = 0;
    state.folders.length = 0;
}
