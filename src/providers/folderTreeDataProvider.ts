import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder } from '../models/models';

export class FolderTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
        return item;
    }

    getChildren(item?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!item) {
            return Promise.resolve(state.folders.map(folder => {
                const tree = new vscode.TreeItem(folder.name, vscode.TreeItemCollapsibleState.Collapsed);
                tree.id = folder.id;
                tree.contextValue = 'folder';
                if (folder.color) {
                    tree.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor(folder.color));
                }
                return tree;
            }));
        }
        const folder = state.folders.find(f => f.id === item.id);
        if (!folder) {
            return Promise.resolve([]);
        }
        return Promise.resolve(folder.files.map(uriStr => {
            const uriObj = vscode.Uri.parse(uriStr);
            const fileName = path.basename(uriObj.fsPath);
            const fileItem = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.None);
            fileItem.resourceUri = uriObj;
            fileItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [uriObj]
            };
            fileItem.contextValue = 'file';
            return fileItem;
        }));
    }
}
