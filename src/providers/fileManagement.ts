// src/providers/fileManagement.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../models/models';
import { FileManagementState, TreeNode } from './treeStructures';
import { Logger } from '../utils/logger';
import { TreeBuilder } from './treeStructures';

/**
 * Handles file management operations (add/remove files from folders)
 */
export class FileManagement {
    private fileManagementState: FileManagementState = {
        mode: 'normal',
        folderId: null,
        selectedFiles: new Set(),
        selectedFolders: new Set(),
        searchFilter: ''
    };

    // Store reference to current file tree for operations
    private currentFileTree: TreeNode[] = [];
    private unfilteredFileTree: TreeNode[] = [];

    /**
     * Enter file management mode
     */
    enterFileManagementMode(folderId: string, mode: 'add' | 'remove'): void {
        this.fileManagementState = {
            mode,
            folderId,
            selectedFiles: new Set(),
            selectedFolders: new Set(),
            searchFilter: ''
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

        Logger.info(`Entered ${mode} mode for folder: ${folderId}`);
    }

    /**
     * Exit file management mode
     */
    exitFileManagementMode(): void {
        this.fileManagementState = {
            mode: 'normal',
            folderId: null,
            selectedFiles: new Set(),
            selectedFolders: new Set(),
            searchFilter: ''
        };
        this.currentFileTree = [];
        this.unfilteredFileTree = [];
        Logger.info('Exited file management mode');
    }

    /**
     * Toggle file selection
     */
    toggleFileSelection(filePath: string): void {
        if (this.fileManagementState.selectedFiles.has(filePath)) {
            this.fileManagementState.selectedFiles.delete(filePath);
            Logger.debug(`Deselected file: ${filePath}`);
        } else {
            this.fileManagementState.selectedFiles.add(filePath);
            Logger.debug(`Selected file: ${filePath}`);
        }
    }

    /**
     * Toggle folder selection
     */
    toggleFolderSelection(folderPath: string): void {
        if (this.fileManagementState.selectedFolders.has(folderPath)) {
            this.fileManagementState.selectedFolders.delete(folderPath);
        } else {
            this.fileManagementState.selectedFolders.add(folderPath);
        }
    }

    /**
     * Select all files in a specific folder
     */
    selectAllFilesInFolder(folderPath: string): void {
        Logger.debug(`Selecting all files in folder: ${folderPath}`);

        const folderNode = TreeBuilder.findNodeInTree(this.currentFileTree, folderPath);
        if (!folderNode) {
            Logger.warn(`Folder node not found: ${folderPath}`);
            return;
        }

        const allFiles = TreeBuilder.getAllFilesInNode(folderNode);
        Logger.debug(`Found ${allFiles.length} files in folder ${folderPath}`);

        allFiles.forEach(filePath => {
            this.fileManagementState.selectedFiles.add(filePath);
        });
    }

    /**
     * Deselect all files in a specific folder
     */
    deselectAllFilesInFolder(folderPath: string): void {
        Logger.debug(`Deselecting all files in folder: ${folderPath}`);

        const folderNode = TreeBuilder.findNodeInTree(this.currentFileTree, folderPath);
        if (!folderNode) {
            Logger.warn(`Folder node not found: ${folderPath}`);
            return;
        }

        const allFiles = TreeBuilder.getAllFilesInNode(folderNode);
        allFiles.forEach(filePath => {
            this.fileManagementState.selectedFiles.delete(filePath);
        });
    }

    /**
     * Select all files in the current workspace
     */
    selectAllFiles(): void {
        Logger.debug('Selecting all files in workspace');

        const allFiles = TreeBuilder.getAllFilesInNodes(this.currentFileTree);
        Logger.debug(`Found ${allFiles.length} total files`);

        allFiles.forEach(filePath => {
            this.fileManagementState.selectedFiles.add(filePath);
        });
    }

    /**
     * Deselect all files
     */
    deselectAllFiles(): void {
        Logger.debug('Deselecting all files');
        this.fileManagementState.selectedFiles.clear();
    }

    /**
     * Update search filter and rebuild filtered tree
     */
    updateSearchFilter(filter: string): void {
        this.fileManagementState.searchFilter = filter.toLowerCase().trim();
        Logger.debug(`File management search filter updated: "${this.fileManagementState.searchFilter}"`);

        // Update filtered tree based on search
        if (this.fileManagementState.searchFilter) {
            this.currentFileTree = this.filterTreeNodes(this.unfilteredFileTree, this.fileManagementState.searchFilter);
        } else {
            this.currentFileTree = this.unfilteredFileTree;
        }
    }

    /**
     * Filter tree nodes based on search term
     */
    private filterTreeNodes(nodes: TreeNode[], searchTerm: string): TreeNode[] {
        const filteredNodes: TreeNode[] = [];

        for (const node of nodes) {
            const nodeMatches = node.name.toLowerCase().includes(searchTerm) ||
                node.path.toLowerCase().includes(searchTerm);

            const filteredChildren = this.filterTreeNodes(Array.from(node.children.values()), searchTerm);

            if (nodeMatches || filteredChildren.length > 0) {
                const filteredNode: TreeNode = {
                    name: node.name,
                    path: node.path,
                    isFile: node.isFile,
                    children: new Map(),
                    uri: node.uri
                };

                filteredChildren.forEach(child => {
                    filteredNode.children.set(child.name, child);
                });

                if (nodeMatches && filteredChildren.length === 0 && !node.isFile) {
                    node.children.forEach((child, key) => {
                        filteredNode.children.set(key, child);
                    });
                }

                filteredNodes.push(filteredNode);
            }
        }

        return filteredNodes;
    }

    /**
     * Get files for file management based on mode
     */
    async getFileManagementFiles(): Promise<TreeNode[]> {
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

        // Build unfiltered tree first
        this.unfilteredFileTree = TreeBuilder.buildFileTreeFromPaths(files);

        // Apply search filter if active
        if (this.fileManagementState.searchFilter) {
            this.currentFileTree = this.filterTreeNodes(this.unfilteredFileTree, this.fileManagementState.searchFilter);
        } else {
            this.currentFileTree = this.unfilteredFileTree;
        }

        return this.currentFileTree;
    }

    /**
     * Show search input for file management
     */
    async showSearchInput(): Promise<void> {
        const searchTerm = await vscode.window.showInputBox({
            prompt: 'Search files and folders (leave empty to show all)',
            placeHolder: 'Type to filter files and folders...',
            value: this.fileManagementState.searchFilter,
            title: 'File & Folder Search'
        });

        if (searchTerm !== undefined) {
            this.updateSearchFilter(searchTerm);

            if (searchTerm.trim()) {
                vscode.window.showInformationMessage(`Searching for: "${searchTerm}"`);
            } else {
                vscode.window.showInformationMessage('Search cleared - showing all files');
            }
        }
    }

    /**
     * Clear search filter
     */
    clearSearch(): void {
        this.updateSearchFilter('');
        vscode.window.showInformationMessage('Search filter cleared');
    }

    /**
     * Get current file management state
     */
    getFileManagementState(): FileManagementState {
        return this.fileManagementState;
    }

    /**
     * Get selected files
     */
    getSelectedFiles(): string[] {
        return Array.from(this.fileManagementState.selectedFiles);
    }

    /**
     * Check if in file management mode
     */
    isInFileManagementMode(): boolean {
        return this.fileManagementState.mode !== 'normal';
    }

    /**
     * Get current file tree
     */
    getCurrentFileTree(): TreeNode[] {
        return this.currentFileTree;
    }

    /**
     * Set current file tree (used by external components)
     */
    setCurrentFileTree(tree: TreeNode[]): void {
        this.currentFileTree = tree;
    }

    /**
     * Get unfiltered file tree
     */
    getUnfilteredFileTree(): TreeNode[] {
        return this.unfilteredFileTree;
    }

    /**
     * Set unfiltered file tree (used by external components)
     */
    setUnfilteredFileTree(tree: TreeNode[]): void {
        this.unfilteredFileTree = tree;
    }
}