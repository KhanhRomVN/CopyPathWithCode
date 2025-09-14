import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../models/models';
import { Logger } from '../utils/logger';

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

    // Thêm cache cho cây thư mục
    private treeCache: Map<string, vscode.TreeItem[]> = new Map();

    refresh(): void {
        // Clear cache khi refresh
        this.treeCache.clear();
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
        Logger.debug('=== getChildren called ===');
        Logger.debug(`Element: ${element ? JSON.stringify({
            label: element.label,
            id: (element as any).id,
            folderId: (element as any).folderId,
            contextValue: element.contextValue,
            isFileManagementHeader: (element as any).isFileManagementHeader
        }) : 'ROOT'}`);

        if (!element) {
            // Root level behavior
            Logger.debug(`File management mode: ${this.fileManagementState.mode}`);
            if (this.fileManagementState.mode !== 'normal') {
                return this.getFileManagementRootItems();
            }
            return Promise.resolve(this.getFolderItems());
        }

        const elementAny = element as any;

        // File management mode navigation
        if (this.fileManagementState.mode !== 'normal') {
            if (elementAny.isFileManagementHeader) {
                Logger.debug('Getting file management files');
                return this.getFileManagementFiles();
            }
            if (elementAny.treeNode) {
                const treeNode = elementAny.treeNode as TreeNode;
                Logger.debug(`Expanding file management tree node: ${treeNode.name}`);
                return Promise.resolve(this.convertFileTreeToItems(Array.from(treeNode.children.values())));
            }
            Logger.debug('No matching file management condition');
            return Promise.resolve([]);
        }

        // Handle directory expansion FIRST (must come before folderId check)
        if (elementAny.treeNode && elementAny.folderId) {
            const treeNode = elementAny.treeNode as TreeNode;
            const folder = state.folders.find(f => f.id === elementAny.folderId);

            if (!folder) {
                Logger.error(`Folder not found for directory expansion: ${elementAny.folderId}`);
                return Promise.resolve([]);
            }

            Logger.debug(`=== EXPANDING DIRECTORY: ${treeNode.name} ===`);
            Logger.debug(`Directory path: ${treeNode.path}`);
            Logger.debug(`Children count: ${treeNode.children.size}`);
            Logger.debug(`Children names: [${Array.from(treeNode.children.keys()).join(', ')}]`);

            const items = this.convertTreeToItems(Array.from(treeNode.children.values()), folder);
            Logger.debug(`Converted directory to ${items.length} items`);

            // Lưu vào cache
            const cacheKey = `${elementAny.folderId}-${treeNode.path}`;
            this.treeCache.set(cacheKey, items);

            return Promise.resolve(items);
        }

        // Normal mode - folder root expansion
        const folderId = elementAny.folderId || elementAny.id;
        Logger.debug(`Normal mode - folderId: ${folderId}`);

        if (folderId) {
            // Tạo key cache dựa trên folderId
            const cacheKey = `${folderId}-`;

            // Kiểm tra cache trước
            if (this.treeCache.has(cacheKey)) {
                Logger.debug(`Returning cached results for: ${cacheKey}`);
                return Promise.resolve(this.treeCache.get(cacheKey)!);
            }

            const folder = state.folders.find(f => f.id === folderId);
            if (!folder) {
                Logger.error(`Folder not found for ID: ${folderId}`);
                return Promise.resolve([]);
            }

            Logger.info(`=== EXPANDING FOLDER: ${folder.name} ===`);
            Logger.info(`Folder ID: ${folder.id}`);
            Logger.info(`Files count: ${folder.files.length}`);
            Logger.info(`Files: ${JSON.stringify(folder.files, null, 2)}`);

            // FIXED: Add validation before building tree
            const validFiles = folder.files.filter(fileUri => {
                try {
                    const uri = vscode.Uri.parse(fileUri);
                    Logger.debug(`Validating file URI: ${fileUri} -> scheme: ${uri.scheme}, fsPath: ${uri.fsPath}`);
                    return uri.scheme === 'file';
                } catch (error) {
                    Logger.warn(`Invalid file URI in folder: ${fileUri}`, error);
                    return false;
                }
            });

            if (validFiles.length !== folder.files.length) {
                Logger.info(`Filtered ${folder.files.length - validFiles.length} invalid files from folder`);
            }

            Logger.info(`=== BUILDING TREE FROM ${validFiles.length} VALID FILES ===`);
            const tree = this.buildFileTree(validFiles);
            Logger.info(`=== TREE BUILT WITH ${tree.length} ROOT NODES ===`);

            const items = this.convertTreeToItems(tree, folder);
            Logger.info(`=== CONVERTED TO ${items.length} TREE ITEMS ===`);

            // Lưu vào cache
            this.treeCache.set(cacheKey, items);

            return Promise.resolve(items);
        }

        Logger.debug('No matching condition in getChildren, returning empty array');
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
        Logger.debug(`Getting folder items for ${state.folders.length} folders`);

        return state.folders.map(folder => {
            const treeItem = new vscode.TreeItem(
                folder.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );

            // FIX: Make sure both id and folderId are set properly
            treeItem.id = folder.id;
            (treeItem as any).folderId = folder.id;
            treeItem.contextValue = 'folder';

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

            Logger.debug(`Created folder item: ${folder.name} with ID: ${folder.id}`);
            return treeItem;
        });
    }

    private buildFileTree(fileUris: string[]): TreeNode[] {
        if (!fileUris || fileUris.length === 0) {
            Logger.info('No files to build tree from');
            return [];
        }

        Logger.info(`=== BUILDING FILE TREE FROM ${fileUris.length} FILES ===`);

        const root = new Map<string, TreeNode>();
        const processedPaths = new Set<string>(); // Prevent duplicates

        for (let i = 0; i < fileUris.length; i++) {
            const uriStr = fileUris[i];
            Logger.debug(`\n--- Processing file ${i + 1}/${fileUris.length}: ${uriStr} ---`);

            try {
                // FIXED: Validate URI scheme before processing
                const uri = vscode.Uri.parse(uriStr);
                Logger.debug(`Parsed URI - scheme: ${uri.scheme}, fsPath: ${uri.fsPath}`);

                if (uri.scheme !== 'file') {
                    Logger.warn(`Skipping non-file URI: ${uriStr} (scheme: ${uri.scheme})`);
                    continue;
                }

                let relativePath: string;

                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    Logger.debug(`Workspace root: ${workspaceRoot}`);
                    Logger.debug(`File fsPath: ${uri.fsPath}`);

                    relativePath = vscode.workspace.asRelativePath(uri);
                    Logger.debug(`Calculated relative path: ${relativePath}`);
                } else {
                    relativePath = path.basename(uri.fsPath);
                    Logger.debug(`No workspace, using basename: ${relativePath}`);
                }

                // FIXED: Better path normalization
                const originalRelativePath = relativePath;
                relativePath = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
                Logger.debug(`Normalized path: ${originalRelativePath} -> ${relativePath}`);

                // FIXED: Skip duplicates and invalid paths
                if (!relativePath || relativePath === '.' || processedPaths.has(relativePath)) {
                    Logger.debug(`Skipping invalid/duplicate path: "${relativePath}"`);
                    continue;
                }

                processedPaths.add(relativePath);
                Logger.debug(`Added to processed paths. Total processed: ${processedPaths.size}`);

                Logger.debug(`BEFORE insertIntoTree - root keys: [${Array.from(root.keys()).join(', ')}]`);
                this.insertIntoTree(root, relativePath, uri);
                Logger.debug(`AFTER insertIntoTree - root keys: [${Array.from(root.keys()).join(', ')}]`);

            } catch (error) {
                Logger.error(`Error processing file URI: ${uriStr}`, error);
            }
        }

        const result = Array.from(root.values());
        Logger.info(`=== FINAL TREE STRUCTURE ===`);
        Logger.info(`Root nodes count: ${result.length}`);
        Logger.info(`Root node names: [${result.map(n => n.name).join(', ')}]`);

        // Log detailed tree structure
        result.forEach((node, index) => {
            Logger.info(`Root node ${index + 1}: ${this.debugNodeStructure(node, 0)}`);
        });

        return result;
    }

    private debugNodeStructure(node: TreeNode, depth: number): string {
        const indent = '  '.repeat(depth);
        let result = `\n${indent}${node.name} (${node.isFile ? 'FILE' : 'DIR'}) - path: "${node.path}"`;

        if (node.children.size > 0) {
            result += ` - children: ${node.children.size}`;
            for (const child of node.children.values()) {
                result += this.debugNodeStructure(child, depth + 1);
            }
        }

        return result;
    }

    private insertIntoTree(tree: Map<string, TreeNode>, filePath: string, uri: vscode.Uri) {
        Logger.debug(`\n=== INSERTING INTO TREE ===`);
        Logger.debug(`File path: ${filePath}`);
        Logger.debug(`URI: ${uri.toString()}`);

        // FIXED: Better path validation and splitting
        const originalParts = filePath.split('/');
        Logger.debug(`Original parts: [${originalParts.join(', ')}]`);

        const parts = originalParts.filter(part =>
            part.length > 0 &&
            part !== '.' &&
            part !== '..' &&
            !part.includes(':') // Exclude parts with colons (like "output:tasks")
        );

        Logger.debug(`Filtered parts: [${parts.join(', ')}]`);

        if (parts.length === 0) {
            Logger.warn(`Skipping file with no valid parts: ${filePath}`);
            return;
        }

        let currentLevel = tree;
        let currentPath = '';

        Logger.debug(`Starting tree traversal...`);

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const previousPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            Logger.debug(`\n  Step ${i + 1}/${parts.length}:`);
            Logger.debug(`    Part: "${part}"`);
            Logger.debug(`    Is file: ${isFile}`);
            Logger.debug(`    Previous path: "${previousPath}"`);
            Logger.debug(`    Current path: "${currentPath}"`);
            Logger.debug(`    Current level keys: [${Array.from(currentLevel.keys()).join(', ')}]`);
            Logger.debug(`    Has part in current level: ${currentLevel.has(part)}`);

            if (!currentLevel.has(part)) {
                const node: TreeNode = {
                    name: part,
                    path: currentPath,
                    isFile,
                    children: new Map(),
                    uri: isFile ? uri : undefined
                };
                currentLevel.set(part, node);
                Logger.debug(`    CREATED NEW NODE: ${isFile ? 'file' : 'directory'} "${part}" at path "${currentPath}"`);
            } else {
                // Handle existing nodes more carefully
                const existingNode = currentLevel.get(part)!;
                Logger.debug(`    FOUND EXISTING NODE: ${existingNode.isFile ? 'file' : 'directory'} "${part}"`);

                if (isFile) {
                    if (!existingNode.isFile) {
                        // FIXED: Don't convert directory to file - this causes issues
                        Logger.warn(`    File "${part}" conflicts with existing directory - keeping as directory`);
                    } else {
                        // Update existing file node
                        existingNode.uri = uri;
                        existingNode.path = currentPath; // Ensure path is consistent
                        Logger.debug(`    UPDATED existing file node`);
                    }
                } else {
                    // Directory case - ensure it's marked as directory
                    if (existingNode.isFile) {
                        // FIXED: More careful conversion
                        Logger.warn(`    Converting file "${part}" to directory`);
                        existingNode.isFile = false;
                        existingNode.uri = undefined;
                    } else {
                        Logger.debug(`    Existing directory node confirmed`);
                    }
                }
            }

            if (!isFile) {
                currentLevel = currentLevel.get(part)!.children;
                Logger.debug(`    MOVED TO NEXT LEVEL: children of "${part}"`);
            } else {
                Logger.debug(`    FINISHED - reached file node`);
            }
        }

        Logger.debug(`=== FINISHED INSERTING ${filePath} ===`);
    }

    private convertTreeToItems(nodes: TreeNode[], folder: any): vscode.TreeItem[] {
        Logger.debug(`\n=== CONVERTING TREE TO ITEMS ===`);
        Logger.debug(`Converting ${nodes.length} tree nodes to items for folder ${folder.name}`);
        Logger.debug(`Input nodes: [${nodes.map(n => `${n.name}(${n.isFile ? 'FILE' : 'DIR'})`).join(', ')}]`);

        const items: vscode.TreeItem[] = [];
        const sortedNodes = nodes.sort((a, b) => {
            if (a.isFile !== b.isFile) {
                return a.isFile ? 1 : -1;
            }
            return a.name.localeCompare(b.name);
        });

        Logger.debug(`Sorted nodes: [${sortedNodes.map(n => `${n.name}(${n.isFile ? 'FILE' : 'DIR'})`).join(', ')}]`);

        for (let i = 0; i < sortedNodes.length; i++) {
            const node = sortedNodes[i];
            Logger.debug(`\n  Converting node ${i + 1}/${sortedNodes.length}: "${node.name}"`);
            Logger.debug(`    Path: "${node.path}"`);
            Logger.debug(`    Is file: ${node.isFile}`);
            Logger.debug(`    Children count: ${node.children.size}`);
            Logger.debug(`    URI: ${node.uri?.toString() || 'undefined'}`);

            const item = new vscode.TreeItem(
                node.name,
                node.isFile
                    ? vscode.TreeItemCollapsibleState.None
                    : vscode.TreeItemCollapsibleState.Collapsed
            );

            // Thêm ID ổn định cho TreeItem
            item.id = `${folder.id}-${node.path}`;

            // FIX: Ensure both treeNode and folderId are set properly
            (item as any).treeNode = node;
            (item as any).folderId = folder.id;

            Logger.debug(`    Created TreeItem with label: "${item.label}"`);
            Logger.debug(`    TreeItem ID: ${item.id}`);
            Logger.debug(`    TreeItem folderId: ${(item as any).folderId}`);
            Logger.debug(`    TreeItem collapsible state: ${item.collapsibleState}`);

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
                Logger.debug(`    Configured as FILE item`);
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
                Logger.debug(`    Configured as DIRECTORY item with ${fileCount} files`);
            }

            items.push(item);
        }

        Logger.debug(`\n=== CONVERSION COMPLETE ===`);
        Logger.debug(`Created ${items.length} items:`);
        items.forEach((item, index) => {
            Logger.debug(`  Item ${index + 1}: "${item.label}" (${item.contextValue}) - collapsible: ${item.collapsibleState}, ID: ${item.id}`);
        });

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