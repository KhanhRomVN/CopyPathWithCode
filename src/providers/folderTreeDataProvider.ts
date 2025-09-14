import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../models/models';

interface TreeNode {
    name: string;
    path: string;
    isFile: boolean;
    children: Map<string, TreeNode>;
    uri?: vscode.Uri;
}

export class FolderTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Root level: show all folders
            return Promise.resolve(this.getFolderItems());
        }

        // Check if this is a folder item (has folderId property)
        if ((element as any).folderId) {
            const folderId = (element as any).folderId;
            const folder = state.folders.find(f => f.id === folderId);
            if (!folder) {
                return Promise.resolve([]);
            }

            // Build hierarchical tree from folder files
            const tree = this.buildFileTree(folder.files);
            return Promise.resolve(this.convertTreeToItems(tree, folder));
        }

        // Check if this is a directory node
        if ((element as any).treeNode) {
            const treeNode = (element as any).treeNode as TreeNode;
            const folder = state.folders.find(f => f.id === (element as any).folderId);
            if (!folder) {
                return Promise.resolve([]);
            }

            return Promise.resolve(this.convertTreeToItems(Array.from(treeNode.children.values()), folder));
        }

        return Promise.resolve([]);
    }

    private getFolderItems(): vscode.TreeItem[] {
        return state.folders.map(folder => {
            const treeItem = new vscode.TreeItem(
                folder.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            treeItem.id = folder.id;
            treeItem.contextValue = 'folder';
            (treeItem as any).folderId = folder.id; // Store folder ID for reference

            // Check if folder belongs to current workspace
            const isCurrentWorkspace = this.isFolderInCurrentWorkspace(folder);

            // Set icon with different colors based on workspace
            if (isCurrentWorkspace) {
                if (folder.color) {
                    treeItem.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor(folder.color));
                } else {
                    treeItem.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('icon.foreground'));
                }
            } else {
                treeItem.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('disabledForeground'));
            }

            // Set description and tooltip
            if (folder.workspaceFolder && !isCurrentWorkspace) {
                const workspaceName = path.basename(folder.workspaceFolder);
                treeItem.description = `(${workspaceName})`;
                treeItem.tooltip = new vscode.MarkdownString(
                    `**${folder.name}**\n\n` +
                    `Files: ${folder.files.length}\n` +
                    `Workspace: ${workspaceName}\n` +
                    `*From different workspace*`
                );
            } else {
                treeItem.tooltip = new vscode.MarkdownString(
                    `**${folder.name}**\n\n` +
                    `Files: ${folder.files.length}\n` +
                    `Current workspace`
                );
            }

            return treeItem;
        });
    }

    private buildFileTree(fileUris: string[]): TreeNode[] {
        const root = new Map<string, TreeNode>();

        // Find common base path
        const commonBasePath = this.findCommonBasePath(fileUris);

        for (const uriStr of fileUris) {
            try {
                const uri = vscode.Uri.parse(uriStr);
                let relativePath: string;

                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    relativePath = vscode.workspace.asRelativePath(uri);
                } else {
                    // Remove common base path
                    relativePath = path.relative(commonBasePath, uri.fsPath);
                }

                // Normalize path separators
                relativePath = relativePath.replace(/\\/g, '/');

                this.insertIntoTree(root, relativePath, uri);
            } catch (error) {
                console.error('Error processing file URI:', uriStr, error);
            }
        }

        return Array.from(root.values());
    }

    private findCommonBasePath(fileUris: string[]): string {
        if (fileUris.length === 0) return '';
        if (fileUris.length === 1) {
            return path.dirname(vscode.Uri.parse(fileUris[0]).fsPath);
        }

        const paths = fileUris.map(uri => vscode.Uri.parse(uri).fsPath);
        let commonPath = path.dirname(paths[0]);

        for (let i = 1; i < paths.length; i++) {
            while (!paths[i].startsWith(commonPath + path.sep) && commonPath !== path.dirname(commonPath)) {
                commonPath = path.dirname(commonPath);
            }
        }

        return commonPath;
    }

    private insertIntoTree(tree: Map<string, TreeNode>, filePath: string, uri: vscode.Uri) {
        const parts = filePath.split('/').filter(part => part.length > 0);
        let currentLevel = tree;
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!currentLevel.has(part)) {
                const node: TreeNode = {
                    name: part,
                    path: currentPath,
                    isFile,
                    children: new Map(),
                    uri: isFile ? uri : undefined
                };
                currentLevel.set(part, node);
            }

            if (!isFile) {
                currentLevel = currentLevel.get(part)!.children;
            }
        }
    }

    private convertTreeToItems(nodes: TreeNode[], folder: any): vscode.TreeItem[] {
        const items: vscode.TreeItem[] = [];

        // Sort: directories first, then files, both alphabetically
        const sortedNodes = nodes.sort((a, b) => {
            if (a.isFile !== b.isFile) {
                return a.isFile ? 1 : -1; // Directories first
            }
            return a.name.localeCompare(b.name);
        });

        for (const node of sortedNodes) {
            const item = new vscode.TreeItem(
                node.name,
                node.isFile
                    ? vscode.TreeItemCollapsibleState.None
                    : vscode.TreeItemCollapsibleState.Collapsed
            );

            // Store references for navigation
            (item as any).treeNode = node;
            (item as any).folderId = folder.id;

            if (node.isFile && node.uri) {
                // File item
                item.resourceUri = node.uri;
                item.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [node.uri]
                };
                item.contextValue = 'file';

                // Check workspace and set styling
                const isCurrentWorkspace = this.isFolderInCurrentWorkspace(folder);
                if (!isCurrentWorkspace) {
                    item.description = '(other workspace)';
                    item.iconPath = new vscode.ThemeIcon('file', new vscode.ThemeColor('disabledForeground'));
                }

                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}**\n\nPath: ${node.path}`
                );
            } else {
                // Directory item
                item.iconPath = new vscode.ThemeIcon('folder');
                item.contextValue = 'directory';

                const fileCount = this.countFilesInNode(node);
                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}/**\n\nContains: ${fileCount} file(s)`
                );

                // Show file count in description
                if (fileCount > 0) {
                    item.description = `${fileCount} file${fileCount > 1 ? 's' : ''}`;
                }
            }

            items.push(item);
        }

        return items;
    }

    private countFilesInNode(node: TreeNode): number {
        let count = 0;
        for (const child of node.children.values()) {
            if (child.isFile) {
                count++;
            } else {
                count += this.countFilesInNode(child);
            }
        }
        return count;
    }

    private isFolderInCurrentWorkspace(folder: any): boolean {
        const currentWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!currentWorkspaceFolder) {
            return !folder.workspaceFolder;
        }

        if (!folder.workspaceFolder) {
            return true;
        }

        return folder.workspaceFolder === currentWorkspaceFolder.uri.fsPath;
    }
}