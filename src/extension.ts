import * as vscode from 'vscode';
import { state } from './models/models';
import { loadFolders } from './utils/folderUtils';
import { FolderTreeDataProvider } from './providers/folderTreeDataProvider';
import { registerAllCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
    loadFolders(context);

    // initialize status bar item for copy count
    state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    state.statusBarItem.hide();
    context.subscriptions.push(state.statusBarItem);

    // Suppress VS Code notifications globally
    // @ts-ignore
    vscode.window.showInformationMessage = () => Promise.resolve(undefined);
    // @ts-ignore
    vscode.window.showWarningMessage = () => Promise.resolve(undefined);
    // @ts-ignore
    vscode.window.showErrorMessage = () => Promise.resolve(undefined);
    const treeDataProvider = new FolderTreeDataProvider();
    vscode.window.createTreeView('folderManager', { treeDataProvider });

    // truyền instance của treeDataProvider vào đăng ký command
    registerAllCommands(context, treeDataProvider);



}

export function deactivate() {
    state.copiedFiles.length = 0;
    state.folders.length = 0;
}
