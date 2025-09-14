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

export interface FileManagementState {
    mode: 'normal' | 'add' | 'remove';
    folderId: string | null;
    selectedFiles: Set<string>;
}

export class FolderTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    private fileManagementState: FileManagementState = {
        mode: 'normal',
        folderId: null,
        selectedFiles: new Set()
    };

    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    // New method to enter file management mode
    enterFileManagementMode(folderId: string, mode: 'add' | 'remove') {
        this.fileManagementState = {
            mode,
            folderId,
            selectedFiles: new Set()
        };

        // If in 'add' mode, pre-select existing files
        if (mode === 'add') {
            const folder = state.folders.find(f => f.id === folderId);
            if (folder) {
                folder.files.forEach(fileUri => {
                    const uri = vscode.Uri.parse(fileUri);
                    const relativePath = vscode.workspace.asRelativePath(uri).replace(/\\/g, '/');
                    this.fileManagementState.selectedFiles.add(relativePath);
                });
            }
        }

        this.refresh();
    }

    // Method to exit file management mode
    exitFileManagementMode() {
        this.fileManagementState = {
            mode: 'normal',
            folderId: null,
            selectedFiles: new Set()
        };
        this.refresh();
    }

    // Method to toggle file selection
    toggleFileSelection(filePath: string) {
        if (this.fileManagementState.selectedFiles.has(filePath)) {
            this.fileManagementState.selectedFiles.delete(filePath);
        } else {
            this.fileManagementState.selectedFiles.add(filePath);
        }
        this.refresh();
    }

    // Method to get current selection
    getSelectedFiles(): string[] {
        return Array.from(this.fileManagementState.selectedFiles);
    }

    // Method to check if in file management mode
    isInFileManagementMode(): boolean {
        return this.fileManagementState.mode !== 'normal';
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Root level behavior depends on current mode
            if (this.fileManagementState.mode !== 'normal') {
                return this.getFileManagementRootItems();
            }

            // Normal mode: show all folders
            return Promise.resolve(this.getFolderItems());
        }

        // Handle file management mode tree navigation
        if (this.fileManagementState.mode !== 'normal') {
            if ((element as any).isFileManagementHeader) {
                return this.getFileManagementFiles();
            }

            // Check if this is a directory node in file management mode
            if ((element as any).treeNode) {
                const treeNode = (element as any).treeNode as TreeNode;
                return Promise.resolve(this.convertFileTreeToItems(Array.from(treeNode.children.values())));
            }

            return Promise.resolve([]);
        }

        // Normal mode navigation
        if ((element as any).folderId) {
            const folderId = (element as any).folderId;
            const folder = state.folders.find(f => f.id === folderId);
            if (!folder) {
                return Promise.resolve([]);
            }

            const tree = this.buildFileTree(folder.files);
            return Promise.resolve(this.convertTreeToItems(tree, folder));
        }

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

    private async getFileManagementRootItems(): Promise<vscode.TreeItem[]> {
        const folder = state.folders.find(f => f.id === this.fileManagementState.folderId);
        if (!folder) {
            return [];
        }

        const items: vscode.TreeItem[] = [];

        // Header with folder info and actions
        const headerItem = new vscode.TreeItem(
            this.fileManagementState.mode === 'add'
                ? `Add Files to "${folder.name}"`
                : `Remove Files from "${folder.name}"`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        // Use built-in VS Code icons instead of emojis
        headerItem.iconPath = new vscode.ThemeIcon(
            this.fileManagementState.mode === 'add' ? 'add' : 'remove'
        );
        headerItem.contextValue = 'fileManagementHeader';
        (headerItem as any).isFileManagementHeader = true;

        items.push(headerItem);

        // Action buttons with VS Code built-in icons
        const confirmItem = new vscode.TreeItem(
            this.fileManagementState.mode === 'add' ? 'Confirm Add Selected' : 'Confirm Remove Selected',
            vscode.TreeItemCollapsibleState.None
        );
        confirmItem.iconPath = new vscode.ThemeIcon('check');
        confirmItem.contextValue = 'confirmFileManagement';
        confirmItem.command = {
            command: 'copy-path-with-code.confirmFileManagement',
            title: 'Confirm',
            arguments: []
        };

        const cancelItem = new vscode.TreeItem('Cancel', vscode.TreeItemCollapsibleState.None);
        cancelItem.iconPath = new vscode.ThemeIcon('close');
        cancelItem.contextValue = 'cancelFileManagement';
        cancelItem.command = {
            command: 'copy-path-with-code.cancelFileManagement',
            title: 'Cancel',
            arguments: []
        };

        items.push(confirmItem, cancelItem);

        return items;
    }

    private async getFileManagementFiles(): Promise<vscode.TreeItem[]> {
        let files: string[];

        if (this.fileManagementState.mode === 'add') {
            // Show all workspace files
            const allUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
            files = allUris.map(uri => uri.fsPath);
        } else {
            // Show only files in the folder
            const folder = state.folders.find(f => f.id === this.fileManagementState.folderId);
            if (!folder) return [];
            files = folder.files.map(fs => vscode.Uri.parse(fs).fsPath);
        }

        const tree = this.buildFileTreeFromPaths(files);
        return this.convertFileTreeToItems(tree);
    }

    private buildFileTreeFromPaths(filePaths: string[]): TreeNode[] {
        const root = new Map<string, TreeNode>();

        for (const filePath of filePaths) {
            let relativePath: string;

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                relativePath = vscode.workspace.asRelativePath(filePath);
            } else {
                relativePath = path.basename(filePath);
            }

            relativePath = relativePath.replace(/\\/g, '/');
            this.insertIntoFileTree(root, relativePath, vscode.Uri.file(filePath));
        }

        return Array.from(root.values());
    }

    private insertIntoFileTree(tree: Map<string, TreeNode>, filePath: string, uri: vscode.Uri) {
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

    private convertFileTreeToItems(nodes: TreeNode[]): vscode.TreeItem[] {
        const items: vscode.TreeItem[] = [];

        const sortedNodes = nodes.sort((a, b) => {
            if (a.isFile !== b.isFile) {
                return a.isFile ? 1 : -1;
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

            (item as any).treeNode = node;

            if (node.isFile && node.uri) {
                const isSelected = this.fileManagementState.selectedFiles.has(node.path);

                // Show selection status in description
                if (isSelected) {
                    item.description = '✓ Selected';
                }

                // IMPORTANT: Set resourceUri for automatic icon detection
                item.resourceUri = node.uri;

                // Don't set iconPath - let VS Code handle it automatically
                item.contextValue = 'fileManagementFile';
                item.command = {
                    command: 'copy-path-with-code.toggleFileSelection',
                    title: 'Toggle Selection',
                    arguments: [node.path]
                };

                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}**\n\nPath: ${node.path}\nClick to ${isSelected ? 'deselect' : 'select'}`
                );
            } else {
                // Use built-in folder icon for directories
                item.iconPath = new vscode.ThemeIcon('folder');
                item.contextValue = 'fileManagementDirectory';

                const fileCount = this.countFilesInNode(node);
                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}/**\n\nContains: ${fileCount} file(s)`
                );

                if (fileCount > 0) {
                    item.description = `${fileCount} file${fileCount > 1 ? 's' : ''}`;
                }
            }

            items.push(item);
        }

        return items;
    }

    private getFolderItems(): vscode.TreeItem[] {
        return state.folders.map(folder => {
            const treeItem = new vscode.TreeItem(
                folder.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            treeItem.id = folder.id;
            treeItem.contextValue = 'folder';
            (treeItem as any).folderId = folder.id;

            const isCurrentWorkspace = this.isFolderInCurrentWorkspace(folder);

            // Use built-in VS Code icons without custom colors
            if (isCurrentWorkspace) {
                treeItem.iconPath = new vscode.ThemeIcon('folder');
            } else {
                // Use a different icon for folders from other workspaces
                treeItem.iconPath = new vscode.ThemeIcon('folder-library');
            }

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
        const commonBasePath = this.findCommonBasePath(fileUris);

        for (const uriStr of fileUris) {
            try {
                const uri = vscode.Uri.parse(uriStr);
                let relativePath: string;

                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    relativePath = vscode.workspace.asRelativePath(uri);
                } else {
                    relativePath = path.relative(commonBasePath, uri.fsPath);
                }

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
        const sortedNodes = nodes.sort((a, b) => {
            if (a.isFile !== b.isFile) {
                return a.isFile ? 1 : -1;
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

            (item as any).treeNode = node;
            (item as any).folderId = folder.id;

            if (node.isFile && node.uri) {
                // IMPORTANT: Set resourceUri for automatic icon detection
                item.resourceUri = node.uri;

                item.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [node.uri]
                };
                item.contextValue = 'file';

                const isCurrentWorkspace = this.isFolderInCurrentWorkspace(folder);
                if (!isCurrentWorkspace) {
                    item.description = '(other workspace)';
                }

                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}**\n\nPath: ${node.path}`
                );
            } else {
                item.iconPath = new vscode.ThemeIcon('folder');
                item.contextValue = 'directory';

                const fileCount = this.countFilesInNode(node);
                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}/**\n\nContains: ${fileCount} file(s)`
                );

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