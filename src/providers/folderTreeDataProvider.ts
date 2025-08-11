import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder } from '../models/models';

/**
 * Provides folder and file items for the Code Folders tree view.
 */
export class FolderTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    /**
     * Signal the tree view to refresh.
     */
    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    /**
     * Customize each TreeItem before it is rendered.
     * For folder items, append an ellipsis icon as description and attach a click command.
     */
    getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
        if (item.contextValue === 'folder') {
            // Always-visible ellipsis in description for folder actions
            item.description = '$(ellipsis)';
            // Clicking the ellipsis triggers the folder menu
            item.command = {
                command: 'copy-path-with-code.showFolderMenu',
                title: 'Folder Actions',
                arguments: [item]
            };
        }
        return item;
    }

    /**
     * Provide the children of a given TreeItem.
     * If no item is passed, return all root folders.
     * Otherwise return the files inside the folder.
     */
    getChildren(item?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!item) {
            // Root-level: list all folders
            const folderItems = state.folders.map(folder => {
                const treeItem = new vscode.TreeItem(
                    folder.name,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                treeItem.id = folder.id;
                treeItem.contextValue = 'folder';
                // Apply custom icon color if provided
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
