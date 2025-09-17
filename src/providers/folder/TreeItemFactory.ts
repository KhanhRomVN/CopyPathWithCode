// FILE: src/providers/folder/TreeItemFactory.ts - STABLE ID VERSION
// Creates stable TreeItem IDs to enable proper refresh without tree collapse

import * as vscode from 'vscode';
import * as path from 'path';
import { Folder } from '../../domain/folder/entities/Folder';
import { FileNode } from '../../domain/folder/entities/FileNode';
import { FOLDER_CONSTANTS } from '../../shared/constants/FolderConstants';
import { FileManagementState } from '../../domain/folder/types/FolderTypes';
import { IFolderTreeService } from '../../infrastructure/di/ServiceContainer';
import { Logger } from '../../utils/common/logger';
import * as crypto from 'crypto';

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

        // STABLE ID for header
        headerItem.id = `filemgmt-header-${folder.id}-${mode}`;

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

        // STABLE ID for action buttons
        item.id = `action-${contextValue}-${this.createHashFromString(label)}`;

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
            const item = this.createFileNodeTreeItem(node, fileManagementState, folder.id);
            (item as any).folderId = folder.id;
            items.push(item);
        }

        return items;
    }

    // SOLUTION: Create stable TreeItem with predictable ID
    createFileNodeTreeItem(
        node: FileNode,
        fileManagementState?: FileManagementState | null,
        folderId?: string
    ): vscode.TreeItem {
        const item = new vscode.TreeItem(
            node.name,
            node.isFile
                ? vscode.TreeItemCollapsibleState.None
                : vscode.TreeItemCollapsibleState.Collapsed
        );

        // CRITICAL FIX: Create stable, predictable ID based on path and context
        const idContext = folderId ? `${folderId}-` : '';
        const mgmtContext = fileManagementState?.mode !== 'normal' ? `-${fileManagementState?.mode}` : '';
        item.id = `${idContext}${this.createHashFromString(node.path)}${mgmtContext}`;

        (item as any).treeNode = node;

        if (node.isFile) {
            this.configureFileTreeItem(item, node, fileManagementState);
        } else {
            this.configureDirectoryTreeItem(item, node, fileManagementState);
        }

        return item;
    }

    // SOLUTION: Enhanced file configuration with real-time icon updates
    private configureFileTreeItem(item: vscode.TreeItem, node: FileNode, fileManagementState?: FileManagementState | null): void {
        const isInFileManagement = fileManagementState?.mode !== 'normal' && fileManagementState?.mode;

        if (isInFileManagement && fileManagementState) {
            const isSelected = fileManagementState.selectedFiles.has(node.path);

            // ENHANCED: Dynamic icon and label based on selection state
            if (isSelected) {
                // Show selected state with check icon
                item.iconPath = new vscode.ThemeIcon(
                    'check',
                    new vscode.ThemeColor('testing.iconPassed') // Green check color
                );
                item.description = '✓ Selected';

                // Optional: Modify label to show selection
                // item.label = `${node.name} ✓`;
            } else {
                // Show unselected state with normal file icon
                if (node.uri) {
                    item.resourceUri = vscode.Uri.parse(node.uri);
                    // Let VS Code determine the file icon based on extension
                } else {
                    item.iconPath = new vscode.ThemeIcon('file');
                }
                item.description = 'Click to select';
            }

            // Set context value and command for file management
            item.contextValue = FOLDER_CONSTANTS.CONTEXT_VALUES.FILE_MANAGEMENT_FILE;
            item.command = {
                command: 'copy-path-with-code.toggleFileSelection',
                title: 'Toggle Selection',
                arguments: [node.path]
            };

            // Enhanced tooltip with selection info
            item.tooltip = new vscode.MarkdownString(
                `**${node.name}**\n\nPath: ${node.path}\n\n**Selection:** ${isSelected ? 'Selected ✓' : 'Not selected'}\n\n*Click to ${isSelected ? 'deselect' : 'select'}*`
            );
        } else {
            // Normal mode - not in file management
            item.label = node.name;

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

            // Standard tooltip
            item.tooltip = new vscode.MarkdownString(
                `**${node.name}**\n\nPath: ${node.path}`
            );
        }
    }

    private configureDirectoryTreeItem(item: vscode.TreeItem, node: FileNode, fileManagementState?: FileManagementState | null): void {
        const fileCount = node.getFileCount();
        const isInFileManagement = fileManagementState?.mode !== 'normal' && fileManagementState?.mode;

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

    // SOLUTION: Helper method to create consistent hash-based IDs
    private createHashFromString(input: string): string {
        return crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
    }
}