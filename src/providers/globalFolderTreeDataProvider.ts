import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder } from '../models/models';
import { getAllWorkspaceFolders, getWorkspaceDisplayName, getCurrentWorkspaceFolder } from '../utils/workspaceUtils';
import { Logger } from '../utils/logger';

export class GlobalFolderTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Root level - show workspaces
            return Promise.resolve(this.getWorkspaceItems());
        }

        const elementAny = element as any;

        if (elementAny.workspacePath !== undefined) {
            // Expanding a workspace - show its folders
            return Promise.resolve(this.getFoldersForWorkspace(elementAny.workspacePath));
        }

        if (elementAny.folderId) {
            // Expanding a folder - show its files (similar to existing implementation)
            const folder = state.folders.find(f => f.id === elementAny.folderId);
            if (folder) {
                return Promise.resolve(this.getFilesForFolder(folder));
            }
        }

        return Promise.resolve([]);
    }

    private getWorkspaceItems(): vscode.TreeItem[] {
        const workspaceGroups = getAllWorkspaceFolders();
        const currentWorkspace = getCurrentWorkspaceFolder();

        return workspaceGroups.map(({ workspace, folders }) => {
            const displayName = getWorkspaceDisplayName(workspace);
            const isCurrentWorkspace = workspace === currentWorkspace;

            const item = new vscode.TreeItem(
                displayName,
                vscode.TreeItemCollapsibleState.Expanded
            );

            // Set workspace path for children lookup
            (item as any).workspacePath = workspace;

            // Use different icons for current vs other workspaces
            if (isCurrentWorkspace) {
                item.iconPath = new vscode.ThemeIcon('folder-active');
                item.description = `${folders.length} folders (current)`;
            } else {
                item.iconPath = new vscode.ThemeIcon('folder-library');
                item.description = `${folders.length} folders`;
            }

            item.tooltip = new vscode.MarkdownString(
                `**${displayName}**\n\n` +
                `Folders: ${folders.length}\n` +
                `${isCurrentWorkspace ? 'Current workspace' : 'Other workspace'}\n` +
                `Path: ${workspace || 'N/A'}`
            );

            item.contextValue = 'globalWorkspace';

            return item;
        });
    }

    private getFoldersForWorkspace(workspacePath: string | null): vscode.TreeItem[] {
        const folders = state.folders.filter(f =>
            (f.workspaceFolder || null) === workspacePath
        );

        return folders.map(folder => {
            const item = new vscode.TreeItem(
                folder.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );

            item.id = `global-${folder.id}`;
            (item as any).folderId = folder.id;

            // Use folder-opened icon for all folders in global view
            item.iconPath = new vscode.ThemeIcon('folder-opened');
            item.description = `${folder.files.length} files`;

            item.tooltip = new vscode.MarkdownString(
                `**${folder.name}**\n\n` +
                `Files: ${folder.files.length}\n` +
                `Workspace: ${getWorkspaceDisplayName(workspacePath)}`
            );

            item.contextValue = 'globalFolder';

            return item;
        });
    }

    private getFilesForFolder(folder: Folder): vscode.TreeItem[] {
        return folder.files.map((fileUri, index) => {
            try {
                const uri = vscode.Uri.parse(fileUri);
                const fileName = path.basename(uri.fsPath);

                const item = new vscode.TreeItem(
                    fileName,
                    vscode.TreeItemCollapsibleState.None
                );

                item.resourceUri = uri;
                item.description = vscode.workspace.asRelativePath(uri);

                item.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [uri]
                };

                item.contextValue = 'globalFile';

                return item;
            } catch (error) {
                Logger.error(`Failed to create tree item for file: ${fileUri}`, error);

                // Return error item
                const item = new vscode.TreeItem(
                    'Invalid file path',
                    vscode.TreeItemCollapsibleState.None
                );
                item.iconPath = new vscode.ThemeIcon('error');
                item.description = fileUri;
                item.contextValue = 'globalFileError';
                return item;
            }
        });
    }
}