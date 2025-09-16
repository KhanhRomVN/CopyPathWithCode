// src/providers/treeItemConverter.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { TreeNode, FileManagementState } from './treeStructures';
import { TreeBuilder } from './treeStructures';
import { state, Folder } from '../models/models';
import { getFoldersForCurrentWorkspace } from '../utils/workspaceUtils';

/**
 * Converts TreeNode structures to VS Code TreeItem objects
 */
export class TreeItemConverter {

    /**
     * Convert tree nodes to VS Code tree items for normal folder view
     */
    static convertTreeToItems(nodes: TreeNode[], folder: Folder): vscode.TreeItem[] {
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

            item.id = `${folder.id}-${node.path}`;
            (item as any).treeNode = node;
            (item as any).folderId = folder.id;

            if (node.isFile && node.uri) {
                item.resourceUri = node.uri;
                item.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [node.uri]
                };
                item.contextValue = 'file';
                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}**\n\nPath: ${node.path}`
                );
            } else {
                const fileCount = TreeBuilder.countFilesInNode(node);
                if (fileCount > 0) {
                    item.iconPath = new vscode.ThemeIcon('folder-opened');
                    item.description = `${fileCount} file${fileCount > 1 ? 's' : ''}`;
                } else {
                    item.iconPath = new vscode.ThemeIcon('folder');
                }
                item.contextValue = 'directory';
                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}/**\n\nContains: ${fileCount} file(s)`
                );
            }

            items.push(item);
        }

        return items;
    }

    /**
     * Convert tree nodes to VS Code tree items for file management mode
     */
    static convertFileTreeToItems(nodes: TreeNode[], fileManagementState: FileManagementState): vscode.TreeItem[] {
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
                const isSelected = fileManagementState.selectedFiles.has(node.path);

                if (isSelected) {
                    item.description = '✓ Selected';
                    item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
                } else {
                    item.resourceUri = node.uri;
                }

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
                // For directories in file management mode
                item.iconPath = new vscode.ThemeIcon('folder');
                item.contextValue = 'fileManagementDirectory';

                const fileCount = TreeBuilder.countFilesInNode(node);

                if (fileCount > 0) {
                    item.description = `${fileCount} file${fileCount > 1 ? 's' : ''}`;
                }

                item.tooltip = new vscode.MarkdownString(
                    `**${node.name}/**\n\nContains: ${fileCount} file(s)\nRight-click for "Select All Files in Folder"`
                );
            }

            items.push(item);
        }

        return items;
    }

    /**
     * Get folder items for workspace view
     */
    static getFolderItems(): vscode.TreeItem[] {
        const currentWorkspaceFolders = getFoldersForCurrentWorkspace();

        return currentWorkspaceFolders.map(folder => {
            const treeItem = new vscode.TreeItem(
                folder.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );

            treeItem.id = folder.id;
            (treeItem as any).folderId = folder.id;
            treeItem.contextValue = 'folder';
            treeItem.iconPath = new vscode.ThemeIcon('folder-opened');

            treeItem.tooltip = new vscode.MarkdownString(
                `**${folder.name}**\n\n` +
                `Files: ${folder.files.length}\n` +
                `Current workspace`
            );

            return treeItem;
        });
    }

    /**
     * Get global folder items for global view
     */
    static getGlobalFolderItems(): vscode.TreeItem[] {
        return state.folders.map(folder => {
            const treeItem = new vscode.TreeItem(
                folder.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );

            treeItem.id = folder.id;
            (treeItem as any).folderId = folder.id;
            treeItem.contextValue = 'folder';

            const isCurrentWorkspace = this.isFolderInCurrentWorkspace(folder);

            if (isCurrentWorkspace) {
                treeItem.iconPath = new vscode.ThemeIcon('folder-opened');
            } else {
                treeItem.iconPath = new vscode.ThemeIcon('folder-library');
            }

            const workspaceInfo = folder.workspaceFolder ?
                `Workspace: ${path.basename(folder.workspaceFolder)}` :
                'Workspace: Unknown';

            treeItem.tooltip = new vscode.MarkdownString(
                `**${folder.name}**\n\n` +
                `Files: ${folder.files.length}\n` +
                `${workspaceInfo}\n` +
                `${isCurrentWorkspace ? 'Current workspace' : 'Different workspace'}`
            );

            if (!isCurrentWorkspace) {
                const workspaceName = folder.workspaceFolder ?
                    path.basename(folder.workspaceFolder) :
                    'Unknown';
                treeItem.description = `(${workspaceName})`;
            }

            return treeItem;
        });
    }

    /**
     * Get file management root items (header, search, action buttons)
     */
    static getFileManagementRootItems(fileManagementState: FileManagementState): vscode.TreeItem[] {
        const folder = state.folders.find(f => f.id === fileManagementState.folderId);
        if (!folder) {
            return [];
        }

        const items: vscode.TreeItem[] = [];

        // Header with folder info and actions
        const headerItem = new vscode.TreeItem(
            fileManagementState.mode === 'add'
                ? `Add Files to "${folder.name}"`
                : `Remove Files from "${folder.name}"`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        if (fileManagementState.mode === 'add') {
            headerItem.iconPath = new vscode.ThemeIcon('folder-opened');
        } else {
            headerItem.iconPath = new vscode.ThemeIcon('folder');
        }

        headerItem.contextValue = 'fileManagementHeader';
        (headerItem as any).isFileManagementHeader = true;
        items.push(headerItem);

        // Search button
        const searchItem = new vscode.TreeItem('Search Files & Folders', vscode.TreeItemCollapsibleState.None);
        searchItem.iconPath = new vscode.ThemeIcon('search');
        searchItem.contextValue = 'searchFiles';
        searchItem.command = {
            command: 'copy-path-with-code.showSearchInput',
            title: 'Search Files & Folders',
            arguments: []
        };

        // Show current search filter in description if active
        if (fileManagementState.searchFilter) {
            searchItem.description = `"${fileManagementState.searchFilter}"`;
            searchItem.tooltip = `Current filter: "${fileManagementState.searchFilter}"\nClick to change search`;
        } else {
            searchItem.tooltip = 'Click to search files and folders';
        }

        // Clear search button (only show if there's an active filter)
        const clearSearchItem = new vscode.TreeItem('Clear Search', vscode.TreeItemCollapsibleState.None);
        clearSearchItem.iconPath = new vscode.ThemeIcon('clear-all');
        clearSearchItem.contextValue = 'clearSearch';
        clearSearchItem.command = {
            command: 'copy-path-with-code.clearSearch',
            title: 'Clear Search',
            arguments: []
        };

        // Add search and clear search buttons
        items.push(searchItem);
        if (fileManagementState.searchFilter) {
            items.push(clearSearchItem);
        }

        // Select/Deselect all buttons
        const selectAllItem = new vscode.TreeItem('Select All Files', vscode.TreeItemCollapsibleState.None);
        selectAllItem.iconPath = new vscode.ThemeIcon('check-all');
        selectAllItem.contextValue = 'selectAllFiles';
        selectAllItem.command = {
            command: 'copy-path-with-code.selectAllFiles',
            title: 'Select All Files',
            arguments: []
        };

        const deselectAllItem = new vscode.TreeItem('Deselect All Files', vscode.TreeItemCollapsibleState.None);
        deselectAllItem.iconPath = new vscode.ThemeIcon('close-all');
        deselectAllItem.contextValue = 'deselectAllFiles';
        deselectAllItem.command = {
            command: 'copy-path-with-code.deselectAllFiles',
            title: 'Deselect All Files',
            arguments: []
        };

        // Action buttons
        const confirmItem = new vscode.TreeItem(
            fileManagementState.mode === 'add' ? 'Confirm Add Selected' : 'Confirm Remove Selected',
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

        items.push(selectAllItem, deselectAllItem, confirmItem, cancelItem);

        return items;
    }

    /**
     * Check if folder belongs to current workspace
     */
    private static isFolderInCurrentWorkspace(folder: Folder): boolean {
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