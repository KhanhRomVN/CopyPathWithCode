import * as vscode from 'vscode';
import * as path from 'path';
import { FOLDER_CONSTANTS } from '../../shared/constants/FolderConstants';
import { FileManagementState } from '../../domain/folder/types/FolderTypes';
import { FileNode } from '../../domain/folder/entities/FileNode';
import { IFolderTreeService } from '../../infrastructure/di/ServiceContainer';
import { TreeItemFactory } from '../../providers/folder/TreeItemFactory';
import { Logger } from '../../utils/common/logger';

export class FileManagementStateManager {
    private fileManagementState: FileManagementState = {
        mode: FOLDER_CONSTANTS.FILE_MANAGEMENT_MODES.NORMAL,
        folderId: null,
        selectedFiles: new Set(),
        selectedFolders: new Set()
    };

    private currentFileTree: FileNode[] = [];

    // SOLUTION: Use targeted refresh emitter instead of full tree refresh
    private selectionChangeEmitter: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> | undefined;

    constructor(private readonly folderTreeService: IFolderTreeService) { }

    // Set the emitter from FolderProvider
    setSelectionChangeEmitter(emitter: vscode.EventEmitter<vscode.TreeItem | undefined | null | void>): void {
        this.selectionChangeEmitter = emitter;
    }

    getState(): FileManagementState {
        return this.fileManagementState;
    }

    isInFileManagementMode(): boolean {
        return this.fileManagementState.mode !== FOLDER_CONSTANTS.FILE_MANAGEMENT_MODES.NORMAL;
    }

    enterFileManagementMode(folderId: string, mode: 'add' | 'remove'): void {
        this.fileManagementState = {
            mode,
            folderId,
            selectedFiles: new Set(),
            selectedFolders: new Set()
        };

        this.preselectExistingFiles(folderId);
    }

    exitFileManagementMode(): void {
        this.fileManagementState = {
            mode: FOLDER_CONSTANTS.FILE_MANAGEMENT_MODES.NORMAL,
            folderId: null,
            selectedFiles: new Set(),
            selectedFolders: new Set()
        };
        this.currentFileTree = [];
    }

    // SOLUTION: Use null refresh to trigger TreeItem recreation without tree collapse
    toggleFileSelection(filePath: string): void {
        const wasSelected = this.fileManagementState.selectedFiles.has(filePath);

        if (wasSelected) {
            this.fileManagementState.selectedFiles.delete(filePath);
            Logger.debug(`Deselected file: ${filePath}`);
        } else {
            this.fileManagementState.selectedFiles.add(filePath);
            Logger.debug(`Selected file: ${filePath}`);
        }

        // CRITICAL FIX: Use null refresh to update TreeItems without collapsing
        if (this.selectionChangeEmitter) {
            this.selectionChangeEmitter.fire(null);
        }

        // Update status bar feedback
        this.showSelectionFeedback(filePath, !wasSelected);

        // Update VS Code context for conditional commands
        const selectedCount = this.getSelectedFiles().length;
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasSelectedFiles', selectedCount > 0);

        Logger.debug(`Selection updated. Total selected: ${selectedCount}`);
    }

    // Provide immediate visual feedback
    private showSelectionFeedback(filePath: string, isSelected: boolean): void {
        const fileName = path.basename(filePath);
        const selectedCount = this.getSelectedFiles().length;

        // Show subtle status bar message
        vscode.window.setStatusBarMessage(
            `${isSelected ? 'Selected' : 'Deselected'} ${fileName} (${selectedCount} files selected)`,
            1500 // Show for 1.5 seconds
        );
    }

    async selectAllFiles(): Promise<void> {
        if (!this.fileManagementState.folderId) {
            Logger.error('No folder ID in file management state for selectAllFiles');
            return;
        }

        try {
            const folder = this.folderTreeService.getFolderById(this.fileManagementState.folderId);
            Logger.debug(`selectAllFiles: Processing folder "${folder.name}" with ${folder.fileCount} files`);

            let allFilePaths: string[] = [];
            const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();

            if (!currentWorkspace) {
                Logger.warn('No workspace folder found');
                return;
            }

            // FIXED: Use consistent logic with selectAllFilesInFolder
            if (this.fileManagementState.mode === 'add') {
                // For ADD mode: Get all workspace files
                Logger.debug('ADD mode: Getting all workspace files for selection');
                const allUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');

                allFilePaths = allUris.map(uri => {
                    const relativePath = vscode.workspace.asRelativePath(uri, false);
                    return relativePath.replace(/\\/g, '/');
                });

                Logger.debug(`Found ${allFilePaths.length} workspace files for ADD mode`);

            } else if (this.fileManagementState.mode === 'remove') {
                // For REMOVE mode: Use file tree structure for consistency
                Logger.debug('REMOVE mode: Getting files from folder tree');
                const fileTree = this.folderTreeService.buildFileTreeForFolder(this.fileManagementState.folderId);

                const extractFilePaths = (nodes: any[]): string[] => {
                    const paths: string[] = [];
                    for (const node of nodes) {
                        if (node.isFile) {
                            paths.push(node.path);
                        } else if (node.children && node.children.size > 0) {
                            paths.push(...extractFilePaths(Array.from(node.children.values())));
                        }
                    }
                    return paths;
                };

                allFilePaths = extractFilePaths(fileTree);
                Logger.debug(`Found ${allFilePaths.length} files in folder for REMOVE mode`);
            }

            if (allFilePaths.length === 0) {
                Logger.warn(`No files found for selectAllFiles in ${this.fileManagementState.mode} mode`);
                return;
            }

            const previousCount = this.fileManagementState.selectedFiles.size;

            // Add only new files to selection (skip already selected)
            let addedCount = 0;
            allFilePaths.forEach(filePath => {
                if (filePath && !this.fileManagementState.selectedFiles.has(filePath)) {
                    this.fileManagementState.selectedFiles.add(filePath);
                    addedCount++;
                }
            });

            Logger.debug(`Selected ${addedCount} additional files (total: ${this.fileManagementState.selectedFiles.size})`);

            // Use null refresh for bulk operations
            if (this.selectionChangeEmitter) {
                this.selectionChangeEmitter.fire(null);
            }

            // Update VS Code context for conditional commands
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasSelectedFiles', this.fileManagementState.selectedFiles.size > 0);

        } catch (error) {
            Logger.error('Error in selectAllFiles:', error);
        }
    }

    deselectAllFiles(): void {
        const previousCount = this.fileManagementState.selectedFiles.size;

        // Clear all selected files
        this.fileManagementState.selectedFiles.clear();

        Logger.debug(`Deselected ${previousCount} files`);

        // Use null refresh for bulk operations to update UI
        if (this.selectionChangeEmitter) {
            this.selectionChangeEmitter.fire(null);
        }

        // Update VS Code context for conditional commands
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasSelectedFiles', false);
    }

    getSelectedFiles(): string[] {
        return Array.from(this.fileManagementState.selectedFiles);
    }

    selectAllFilesInFolder(folderId: string, directoryPath?: string): number {
        try {
            const folder = this.folderTreeService.getFolderById(folderId);
            Logger.debug(`selectAllFilesInFolder: Processing folder "${folder.name}" with ${folder.fileCount} files`);

            if (directoryPath) {
                Logger.debug(`Filtering files by directory path: ${directoryPath}`);
            }

            const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();

            if (!currentWorkspace) {
                Logger.warn('No workspace folder found');
                return 0;
            }

            // CRITICAL FIX: In ADD mode, we should get files from WORKSPACE, not just from folder storage
            let allFilePaths: string[] = [];

            if (this.fileManagementState.mode === 'add') {
                Logger.debug('ADD MODE: Getting files from workspace scan');

                // Strategy: Get ALL files from workspace that match the directory filter
                try {
                    // Use VS Code's findFiles to get all files in the specified directory
                    const targetGlob = directoryPath ? `${directoryPath}/**/*` : '**/*';
                    Logger.debug(`Searching workspace with glob: ${targetGlob}`);

                    // Since findFiles is async, we need to make this method async or use a different approach
                    // For now, let's use the file tree which represents the workspace structure
                    const allWorkspaceFiles = this.getAllWorkspaceFilesFromTree();
                    Logger.debug(`Found ${allWorkspaceFiles.length} files in workspace tree`);

                    // Filter by directory if specified
                    if (directoryPath) {
                        allFilePaths = allWorkspaceFiles.filter(filePath => {
                            const isInDirectory = filePath.startsWith(directoryPath + '/') || filePath === directoryPath;
                            Logger.debug(`Workspace file "${filePath}": isInDirectory=${isInDirectory}`);
                            return isInDirectory;
                        });
                    } else {
                        allFilePaths = allWorkspaceFiles;
                    }

                    Logger.debug(`After directory filtering: ${allFilePaths.length} files to select`);

                } catch (error) {
                    Logger.error('Failed to get workspace files', error);
                    return 0;
                }

            } else {
                // REMOVE MODE: Only use files already in the folder
                Logger.debug('REMOVE MODE: Getting files from folder storage only');

                const folderFiles = folder.files;
                Logger.debug(`Found ${folderFiles.length} files in folder storage`);

                folderFiles.forEach((fileUri, index) => {
                    try {
                        const relativePath = this.getRelativePathFromUri(fileUri);
                        if (relativePath) {
                            // Filter by directory if specified
                            if (!directoryPath || relativePath.startsWith(directoryPath + '/') || relativePath === directoryPath) {
                                allFilePaths.push(relativePath);
                            }
                        }
                    } catch (error) {
                        Logger.warn(`Failed to convert URI to relative path: ${fileUri}`, error);
                    }
                });
            }

            if (allFilePaths.length === 0) {
                Logger.warn(`No files found for selection in folder ${folderId}${directoryPath ? ` and directory ${directoryPath}` : ''}`);

                if (directoryPath && this.fileManagementState.mode === 'add') {
                    Logger.info('HINT: In ADD mode, make sure the directory contains actual files in the workspace');
                }

                return 0;
            }

            // Log final files to be selected
            Logger.debug('Final files to be selected:');
            allFilePaths.forEach((filePath, index) => {
                Logger.debug(`  ${index + 1}. ${filePath}`);
            });

            const previousCount = this.fileManagementState.selectedFiles.size;

            // Add all files to selection (skip already selected files)
            let addedCount = 0;
            allFilePaths.forEach(filePath => {
                if (filePath) {
                    const normalizedPath = this.normalizePath(filePath);
                    const normalizedSelectedFiles = new Set<string>();
                    this.fileManagementState.selectedFiles.forEach(path => {
                        normalizedSelectedFiles.add(this.normalizePath(path));
                    });

                    if (!normalizedSelectedFiles.has(normalizedPath)) {
                        this.fileManagementState.selectedFiles.add(filePath);
                        addedCount++;
                        Logger.debug(`✓ Selected file: ${filePath}`);
                    } else {
                        Logger.debug(`- Already selected: ${filePath}`);
                    }
                }
            });

            Logger.debug(`Selected ${addedCount} additional files (total: ${this.fileManagementState.selectedFiles.size})`);

            // Use null refresh for bulk operations
            if (this.selectionChangeEmitter) {
                this.selectionChangeEmitter.fire(null);
            }

            // Update VS Code context for conditional commands
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasSelectedFiles', this.fileManagementState.selectedFiles.size > 0);

            return addedCount;
        } catch (error) {
            Logger.error('Error selecting all files in folder:', error);
            return 0;
        }
    }

    private getAllWorkspaceFilesFromTree(): string[] {
        try {
            // Get the current file tree that represents ALL workspace files
            const fileManagementState = this.fileManagementState;
            if (!fileManagementState.folderId) {
                return [];
            }

            // Build file tree for the entire workspace (not just folder files)
            const allWorkspaceFiles: string[] = [];

            // Use VS Code's workspace API to find all files
            // Since this is synchronous, we'll use the file tree we already have
            const fileTree = this.currentFileTree; // This should contain all workspace files

            if (fileTree && fileTree.length > 0) {
                const extractPaths = (nodes: any[]): string[] => {
                    const paths: string[] = [];
                    for (const node of nodes) {
                        if (node.isFile && node.path) {
                            paths.push(node.path);
                        }
                        if (node.children && node.children.size > 0) {
                            paths.push(...extractPaths(Array.from(node.children.values())));
                        }
                    }
                    return paths;
                };

                allWorkspaceFiles.push(...extractPaths(fileTree));
            }

            Logger.debug(`getAllWorkspaceFilesFromTree: Found ${allWorkspaceFiles.length} files`);
            return allWorkspaceFiles;

        } catch (error) {
            Logger.error('Error getting workspace files from tree', error);
            return [];
        }
    }


    // NEW: Helper method to normalize paths for consistent comparison
    private normalizePath(path: string): string {
        if (!path) return path;

        // Convert to lowercase and replace backslashes with forward slashes
        return path.toLowerCase().replace(/\\/g, '/').trim();
    }

    unselectAllFilesInFolder(folderId: string): number {
        try {
            const folder = this.folderTreeService.getFolderById(folderId);
            const fileTree = this.folderTreeService.buildFileTreeForFolder(folderId);

            const allFilePaths = this.getAllFilePathsFromTree(fileTree);
            let removedCount = 0;

            allFilePaths.forEach((filePath: string) => {
                if (this.fileManagementState.selectedFiles.has(filePath)) {
                    this.fileManagementState.selectedFiles.delete(filePath);
                    removedCount++;
                }
            });

            Logger.debug(`Unselected ${removedCount} files in folder ${folder.name}`);

            // Use null refresh for folder operations
            if (this.selectionChangeEmitter) {
                this.selectionChangeEmitter.fire(null);
            }

            return removedCount;
        } catch (error) {
            Logger.error('Error unselecting all files in folder:', error);
            return 0;
        }
    }

    async getFileManagementRootItems(treeItemFactory: TreeItemFactory): Promise<vscode.TreeItem[]> {
        try {
            const folder = this.folderTreeService.getFolderById(this.fileManagementState.folderId!);
            const items: vscode.TreeItem[] = [];

            // Header - always expanded
            const headerItem = treeItemFactory.createFileManagementHeader(folder, this.fileManagementState.mode as 'add' | 'remove');
            items.push(headerItem);

            // UPDATED: Action buttons with mode-specific labels and behavior
            const selectedCount = this.getSelectedFiles().length;

            if (this.fileManagementState.mode === 'add') {
                items.push(
                    treeItemFactory.createActionButton('Select All Files', FOLDER_CONSTANTS.ICONS.CHECK_ALL, 'selectAllFiles', 'copy-path-with-code.selectAllFiles'),
                    treeItemFactory.createActionButton('Deselect All Files', FOLDER_CONSTANTS.ICONS.CLOSE_ALL, 'deselectAllFiles', 'copy-path-with-code.deselectAllFiles'),
                    treeItemFactory.createActionButton(
                        `Confirm Add/Remove (${selectedCount} selected)`,
                        FOLDER_CONSTANTS.ICONS.CHECK,
                        'confirmFileManagement',
                        'copy-path-with-code.confirmFileManagement'
                    ),
                    treeItemFactory.createActionButton('Cancel', FOLDER_CONSTANTS.ICONS.CLOSE, 'cancelFileManagement', 'copy-path-with-code.cancelFileManagement')
                );
            } else { // remove mode
                items.push(
                    treeItemFactory.createActionButton('Select All Files', FOLDER_CONSTANTS.ICONS.CHECK_ALL, 'selectAllFiles', 'copy-path-with-code.selectAllFiles'),
                    treeItemFactory.createActionButton('Deselect All Files', FOLDER_CONSTANTS.ICONS.CLOSE_ALL, 'deselectAllFiles', 'copy-path-with-code.deselectAllFiles'),
                    treeItemFactory.createActionButton(
                        `Remove Selected (${selectedCount} to remove)`,
                        FOLDER_CONSTANTS.ICONS.TRASH,
                        'confirmFileManagement',
                        'copy-path-with-code.confirmFileManagement'
                    ),
                    treeItemFactory.createActionButton('Cancel', FOLDER_CONSTANTS.ICONS.CLOSE, 'cancelFileManagement', 'copy-path-with-code.cancelFileManagement')
                );
            }

            return items;
        } catch (error) {
            Logger.error('Failed to create file management root items', error);
            return [];
        }
    }

    async getFileManagementFiles(treeItemFactory: TreeItemFactory): Promise<vscode.TreeItem[]> {
        try {
            let files: string[];

            if (this.fileManagementState.mode === 'add') {
                // Show all workspace files with relative paths
                const allUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                files = allUris.map(uri => this.getRelativePathFromUri(uri.toString()));
            } else {
                // Show only files in the folder with relative paths
                const folder = this.folderTreeService.getFolderById(this.fileManagementState.folderId!);
                files = folder.files.map(fileUri => this.getRelativePathFromUri(fileUri));
            }

            const tree = this.buildFileTreeFromPaths(files);
            this.currentFileTree = tree;

            return treeItemFactory.convertFileNodeToItems(tree, this.fileManagementState);
        } catch (error) {
            Logger.error('Failed to get file management files', error);
            return [];
        }
    }

    // Cleanup on exit
    dispose(): void {
        // No more timers to clean up
    }

    private preselectExistingFiles(folderId: string): void {
        try {
            const folder = this.folderTreeService.getFolderById(folderId);
            const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();

            if (currentWorkspace) {
                // FIXED: Only pre-select files for ADD mode, not REMOVE mode
                if (this.fileManagementState.mode === 'add') {
                    // For ADD mode: pre-select existing files so they remain in folder
                    folder.files.forEach(fileUri => {
                        try {
                            const relativePath = this.getRelativePathFromUri(fileUri);
                            this.fileManagementState.selectedFiles.add(relativePath);
                        } catch (error) {
                            Logger.warn(`Invalid URI in folder: ${fileUri}`, error);
                        }
                    });

                    Logger.debug(`ADD mode: Pre-selected ${folder.files.length} existing files (will remain in folder unless unchecked)`);
                } else if (this.fileManagementState.mode === 'remove') {
                    // For REMOVE mode: start with NO files selected
                    // User must explicitly select files they want to remove
                    this.fileManagementState.selectedFiles.clear();

                    Logger.debug(`REMOVE mode: Started with no files selected (user must select files to remove)`);
                }
            }
        } catch (error) {
            Logger.error(`Failed to handle file preselection for folder ${folderId}`, error);
        }
    }

    private getAllFilePathsFromTree(nodes: any[]): string[] {
        const paths: string[] = [];

        const traverse = (nodeList: any[]) => {
            for (const node of nodeList) {
                if (node.isFile && node.path) {
                    paths.push(node.path);
                }

                if (node.children && node.children.size > 0) {
                    traverse(Array.from(node.children.values()));
                } else if (node.getChildrenArray) {
                    traverse(node.getChildrenArray());
                }
            }
        };

        traverse(nodes);
        return paths;
    }

    // FIXED: Enhanced file tree building with proper URI generation
    private buildFileTreeFromPaths(filePaths: string[]): FileNode[] {
        const fileNodes = new Map<string, FileNode>();

        for (const filePath of filePaths) {
            try {
                this.insertFileNodeIntoTree(fileNodes, filePath);
            } catch (error) {
                Logger.warn(`Failed to process file path: ${filePath}`, error);
            }
        }

        return FileNode.sortNodes(Array.from(fileNodes.values()));
    }

    // ENHANCED: Proper URI generation for both files and directories
    private insertFileNodeIntoTree(tree: Map<string, FileNode>, filePath: string, originalUri?: string): void {
        const parts = filePath.split('/').filter(part => part.length > 0);
        let currentLevel = tree;
        let currentPath = '';

        // Get workspace path for URI generation
        const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!currentLevel.has(part)) {
                let node: FileNode;

                if (isFile) {
                    // For files
                    let fileUri = originalUri;
                    if (!fileUri && currentWorkspace) {
                        const fullPath = path.join(currentWorkspace, currentPath);
                        fileUri = vscode.Uri.file(fullPath).toString();
                    }

                    node = FileNode.createFile(part, currentPath, fileUri);
                } else {
                    // FIXED: For directories, always generate proper URI for icon display
                    let directoryUri: string | undefined;
                    if (currentWorkspace) {
                        const fullPath = path.join(currentWorkspace, currentPath);
                        directoryUri = vscode.Uri.file(fullPath).toString();
                    }

                    node = FileNode.createDirectory(part, currentPath, directoryUri);
                    Logger.debug(`Created directory node: ${part} with URI: ${directoryUri}`);
                }

                currentLevel.set(part, node);
            }

            if (!isFile) {
                const node = currentLevel.get(part)!;
                currentLevel = node.children;
            }
        }
    }

    private getRelativePathFromUri(uri: string): string {
        try {
            Logger.debug(`=== getRelativePathFromUri DEBUG ===`);
            Logger.debug(`Input URI: ${uri}`);

            const vscodeUri = vscode.Uri.parse(uri);
            Logger.debug(`Parsed URI: scheme="${vscodeUri.scheme}", fsPath="${vscodeUri.fsPath}"`);

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0];
                Logger.debug(`Workspace folder: ${workspaceFolder.uri.fsPath}`);

                const relativePath = vscode.workspace.asRelativePath(vscodeUri);
                Logger.debug(`VS Code relative path: "${relativePath}"`);

                const normalizedPath = relativePath.replace(/\\/g, '/');
                Logger.debug(`Normalized relative path: "${normalizedPath}"`);
                Logger.debug(`=== END getRelativePathFromUri DEBUG ===`);

                return normalizedPath;
            }

            const fallback = path.basename(vscodeUri.fsPath);
            Logger.debug(`No workspace, using basename: "${fallback}"`);
            Logger.debug(`=== END getRelativePathFromUri DEBUG ===`);

            return fallback;
        } catch (error) {
            Logger.warn(`Failed to get relative path from URI: ${uri}`, error);
            const fallback = path.basename(uri.replace(/^file:\/\//, ''));
            Logger.debug(`Error fallback: "${fallback}"`);
            return fallback;
        }
    }
}