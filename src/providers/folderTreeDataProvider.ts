import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../models/models';

export class FolderTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
        return item; // Không chỉnh sửa ở đây, icon menu sẽ tự hiện từ package.json
    }

    getChildren(item?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!item) {
            // Root-level: list all folders
            const folderItems = state.folders.map(folder => {
                const treeItem = new vscode.TreeItem(
                    folder.name,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                treeItem.id = folder.id;
                treeItem.contextValue = 'folder'; // Quan trọng để menu hiển thị
                if (folder.color) {
                    treeItem.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor(folder.color));
                }
                return treeItem;
            });
            return Promise.resolve(folderItems);
        }

        // Folder node: list its files
        const folder = state.folders.find(f => f.id === item.id);
        if (!folder) {
            return Promise.resolve([]);
        }
        const fileItems = folder.files.map(uriStr => {
            const uri = vscode.Uri.parse(uriStr);
            const fileName = path.basename(uri.fsPath);
            const fileItem = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.None);
            fileItem.resourceUri = uri;
            fileItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [uri]
            };
            fileItem.contextValue = 'file';
            return fileItem;
        });
        return Promise.resolve(fileItems);
    }
}
