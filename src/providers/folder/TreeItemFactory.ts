import * as vscode from 'vscode';
import * as path from 'path';
import { Folder } from '../../domain/folder/entities/Folder';
import { FileNode } from '../../domain/folder/entities/FileNode';
import { FOLDER_CONSTANTS } from '../../shared/constants/FolderConstants';
import { FileManagementState } from '../../domain/folder/types/FolderTypes';
import { IFolderTreeService } from '../../infrastructure/di/ServiceContainer';

export class TreeItemFactory {
    constructor(private readonly folderTreeService: IFolderTreeService) { }

    getFolderItems(viewMode: 'workspace' | 'global', searchTerm?: string): vscode.TreeItem[] {
        const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();
        let folders = this.folderTreeService.getFoldersForWorkspace(currentWorkspace);

        // Apply search filter if active
        if (searchTerm) {
            folders = folders.filter(folder =>
                folder.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return folders.map(folder => this.createFolderTreeItem(folder, true));
    }

    getGlobalFolderItems(searchTerm?: string): vscode.TreeItem[] {
        let allFolders = this.folderTreeService.getAllFolders();

        // Apply search filter if active
        if (searchTerm) {
            allFolders = allFolders.filter(folder =>
                folder.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return allFolders.map(folder => {
            const isCurrentWorkspace = this.isFolderInCurrentWorkspace(folder);
            return this.createFolderTreeItem(folder, isCurrentWorkspace);
        });
    }

    createFolderTreeItem(folder: Folder, isCurrentWorkspace: boolean): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            folder.name,
            vscode.TreeItemCollapsibleState.Collapsed
        );

        treeItem.id = folder.id;
        (treeItem as any).folderId = folder.id;
        treeItem.contextValue = FOLDER_CONSTANTS.CONTEXT_VALUES.FOLDER;

        // Set icon based on workspace context
        treeItem.iconPath = new vscode.ThemeIcon(
            isCurrentWorkspace
                ? FOLDER_CONSTANTS.ICONS.FOLDER_OPENED
                : FOLDER_CONSTANTS.ICONS.FOLDER_LIBRARY
        );

        // Create tooltip
        const workspaceInfo = folder.workspaceFolder
            ? `Workspace: ${path.basename(folder.workspaceFolder)}`
            : 'Workspace: Unknown';

        treeItem.tooltip = new vscode.MarkdownString(
            `**${folder.name}**\n\n` +
            `Files: ${folder.fileCount}\n` +
            `${workspaceInfo}\n` +
            `${isCurrentWorkspace ? 'Current workspace' : 'Different workspace'}`
        );

        // Add description for different workspace
        if (!isCurrentWorkspace && folder.workspaceFolder) {
            treeItem.description = `(${path.basename(folder.workspaceFolder)})`;
        }

        return treeItem;
    }

    createFileManagementHeader(folder: Folder, mode: 'add' | 'remove'): vscode.TreeItem {
        const headerItem = new vscode.TreeItem(
            mode === 'add'
                ? `Add Files to "${folder.name}"`
                : `Remove Files from "${folder.name}"`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        headerItem.iconPath = new vscode.ThemeIcon(
            mode === 'add'
                ? FOLDER_CONSTANTS.ICONS.FOLDER_OPENED
                : FOLDER_CONSTANTS.ICONS.FOLDER
        );
        headerItem.contextValue = FOLDER_CONSTANTS.CONTEXT_VALUES.FILE_MANAGEMENT_HEADER;
        (headerItem as any).isFileManagementHeader = true;

        return headerItem;
    }

    createActionButton(
        label: string,
        icon: string,
        contextValue: string,
        command: string
    ): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = contextValue;
        item.command = {
            command,
            title: label,
            arguments: []
        };
        return item;
    }

    convertFileNodeToItems(
        nodes: FileNode[],
        fileManagementState?: FileManagementState | null,
        searchTerm?: string
    ): vscode.TreeItem[] {
        const items: vscode.TreeItem[] = [];
        let sortedNodes = FileNode.sortNodes(nodes);

        // Apply search filter if active
        if (searchTerm) {
            sortedNodes = this.filterNodesWithSearch(sortedNodes, searchTerm);
        }

        for (const node of sortedNodes) {
            const item = this.createFileNodeTreeItem(node, fileManagementState);
            items.push(item);
        }

        return items;
    }

    convertFileNodeToTreeItems(
        nodes: FileNode[],
        folder: Folder,
        fileManagementState?: FileManagementState | null,
        searchTerm?: string
    ): vscode.TreeItem[] {
        const items: vscode.TreeItem[] = [];
        let sortedNodes = FileNode.sortNodes(nodes);

        // Apply search filter if active
        if (searchTerm) {
            sortedNodes = this.filterNodesWithSearch(sortedNodes, searchTerm);
        }

        for (const node of sortedNodes) {
            const item = this.createFileNodeTreeItem(node, fileManagementState);
            (item as any).folderId = folder.id;
            items.push(item);
        }

        return items;
    }

    createFileNodeTreeItem(node: FileNode, fileManagementState?: FileManagementState | null): vscode.TreeItem {
        const item = new vscode.TreeItem(
            node.name,
            node.isFile
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed
        );

        item.id = `${node.path}-${Date.now()}`;
        (item as any).treeNode = node;

        if (node.isFile) {
            this.configureFileTreeItem(item, node, fileManagementState);
        } else {
            this.configureDirectoryTreeItem(item, node, fileManagementState);
        }

        return item;
    }

    private configureFileTreeItem(item: vscode.TreeItem, node: FileNode, fileManagementState?: FileManagementState | null): void {
        const isInFileManagement = fileManagementState?.mode !== 'normal';

        if (isInFileManagement && fileManagementState) {
            const isSelected = fileManagementState.selectedFiles.has(node.path);

            if (isSelected) {
                item.description = '✓ Selected';
                item.iconPath = new vscode.ThemeIcon('check',
                    new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
            } else if (node.uri) {
                item.resourceUri = vscode.Uri.parse(node.uri);
            }

            item.contextValue = FOLDER_CONSTANTS.CONTEXT_VALUES.FILE_MANAGEMENT_FILE;
            item.command = {
                command: 'copy-path-with-code.toggleFileSelection',
                title: 'Toggle Selection',
                arguments: [node.path]
            };
        } else {
            if (node.uri) {
                const uri = vscode.Uri.parse(node.uri);
                item.resourceUri = uri;
                item.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [uri]
                };
            }
            item.contextValue = FOLDER_CONSTANTS.CONTEXT_VALUES.FILE;
        }

        item.tooltip = new vscode.MarkdownString(`**${node.name}**\n\nPath: ${node.path}`);
    }

    private configureDirectoryTreeItem(item: vscode.TreeItem, node: FileNode, fileManagementState?: FileManagementState | null): void {
        const fileCount = node.getFileCount();
        const isInFileManagement = fileManagementState?.mode !== 'normal';

        item.iconPath = new vscode.ThemeIcon(
            fileCount > 0 ? FOLDER_CONSTANTS.ICONS.FOLDER_OPENED : FOLDER_CONSTANTS.ICONS.FOLDER
        );

        item.contextValue = isInFileManagement
            ? FOLDER_CONSTANTS.CONTEXT_VALUES.FILE_MANAGEMENT_DIRECTORY
            : FOLDER_CONSTANTS.CONTEXT_VALUES.DIRECTORY;

        if (fileCount > 0) {
            item.description = `${fileCount} file${fileCount > 1 ? 's' : ''}`;
        }

        item.tooltip = new vscode.MarkdownString(
            `**${node.name}/**\n\nContains: ${fileCount} file(s)`
        );
    }

    private isFolderInCurrentWorkspace(folder: Folder): boolean {
        const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();

        if (!currentWorkspace) {
            return !folder.workspaceFolder;
        }

        if (!folder.workspaceFolder) {
            return true;
        }

        return folder.workspaceFolder === currentWorkspace;
    }

    private filterNodesWithSearch(nodes: FileNode[], searchTerm: string): FileNode[] {
        const filtered: FileNode[] = [];
        const lowerSearchTerm = searchTerm.toLowerCase();

        for (const node of nodes) {
            if (node.isFile) {
                // Include file if it matches search term
                if (node.name.toLowerCase().includes(lowerSearchTerm)) {
                    filtered.push(node);
                }
            } else {
                // For directories, include if name matches or if it has matching children
                const hasMatchingName = node.name.toLowerCase().includes(lowerSearchTerm);
                const filteredChildren = this.filterNodesWithSearch(node.getChildrenArray(), searchTerm);

                if (hasMatchingName || filteredChildren.length > 0) {
                    // Create new directory node with filtered children
                    const filteredDir = FileNode.createDirectory(node.name, node.path);
                    filteredChildren.forEach(child => filteredDir.addChild(child));
                    filtered.push(filteredDir);
                }
            }
        }

        return FileNode.sortNodes(filtered);
    }
}