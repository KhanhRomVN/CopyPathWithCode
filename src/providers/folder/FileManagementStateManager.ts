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

        // FIXED: Pre-select existing files for BOTH 'add' and 'remove' modes
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

    selectAllFiles(): void {
        const allFiles = this.getAllFilesInNodes(this.currentFileTree);
        const previousCount = this.fileManagementState.selectedFiles.size;

        allFiles.forEach(filePath => {
            this.fileManagementState.selectedFiles.add(filePath);
        });

        Logger.debug(`Selected ${this.fileManagementState.selectedFiles.size - previousCount} additional files`);

        // Use null refresh for bulk operations
        if (this.selectionChangeEmitter) {
            this.selectionChangeEmitter.fire(null);
        }
    }

    deselectAllFiles(): void {
        const previousCount = this.fileManagementState.selectedFiles.size;
        this.fileManagementState.selectedFiles.clear();
        Logger.debug(`Deselected ${previousCount} files`);

        // Use null refresh for bulk operations
        if (this.selectionChangeEmitter) {
            this.selectionChangeEmitter.fire(null);
        }
    }

    getSelectedFiles(): string[] {
        return Array.from(this.fileManagementState.selectedFiles);
    }

    selectAllFilesInFolder(folderId: string): number {
        try {
            const folder = this.folderTreeService.getFolderById(folderId);
            const fileTree = this.folderTreeService.buildFileTreeForFolder(folderId);

            const allFilePaths = this.getAllFilePathsFromTree(fileTree);
            let addedCount = 0;

            allFilePaths.forEach((filePath: string) => {
                if (!this.fileManagementState.selectedFiles.has(filePath)) {
                    this.fileManagementState.selectedFiles.add(filePath);
                    addedCount++;
                }
            });

            Logger.debug(`Selected ${addedCount} files in folder ${folder.name}`);

            // Use null refresh for folder operations
            if (this.selectionChangeEmitter) {
                this.selectionChangeEmitter.fire(null);
            }

            return addedCount;
        } catch (error) {
            Logger.error('Error selecting all files in folder:', error);
            return 0;
        }
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

            // Action buttons with current selection count
            const selectedCount = this.getSelectedFiles().length;

            items.push(
                treeItemFactory.createActionButton('Select All Files', FOLDER_CONSTANTS.ICONS.CHECK_ALL, 'selectAllFiles', 'copy-path-with-code.selectAllFiles'),
                treeItemFactory.createActionButton('Deselect All Files', FOLDER_CONSTANTS.ICONS.CLOSE_ALL, 'deselectAllFiles', 'copy-path-with-code.deselectAllFiles'),
                treeItemFactory.createActionButton(
                    this.fileManagementState.mode === 'add'
                        ? `Confirm Add Selected (${selectedCount})`
                        : `Confirm Remove Selected (${selectedCount})`,
                    FOLDER_CONSTANTS.ICONS.CHECK,
                    'confirmFileManagement',
                    'copy-path-with-code.confirmFileManagement'
                ),
                treeItemFactory.createActionButton('Cancel', FOLDER_CONSTANTS.ICONS.CLOSE, 'cancelFileManagement', 'copy-path-with-code.cancelFileManagement')
            );

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

    // FIXED: Pre-select existing files for BOTH modes
    private preselectExistingFiles(folderId: string): void {
        try {
            const folder = this.folderTreeService.getFolderById(folderId);
            const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();

            if (currentWorkspace) {
                folder.files.forEach(fileUri => {
                    try {
                        const relativePath = this.getRelativePathFromUri(fileUri);
                        this.fileManagementState.selectedFiles.add(relativePath);
                    } catch (error) {
                        Logger.warn(`Invalid URI in folder: ${fileUri}`, error);
                    }
                });

                // ENHANCED: Show different messages based on mode
                if (this.fileManagementState.mode === 'add') {
                    Logger.debug(`Pre-selected ${folder.files.length} existing files for add mode (will show as already selected)`);
                } else {
                    Logger.debug(`Pre-selected ${folder.files.length} existing files for removal`);
                }
            }
        } catch (error) {
            Logger.error(`Failed to pre-select files for folder ${folderId}`, error);
        }
    }

    private getAllFilesInNodes(nodes: FileNode[]): string[] {
        const files: string[] = [];
        for (const node of nodes) {
            files.push(...node.getAllFilePaths());
        }
        return files;
    }

    private getAllFilePathsFromTree(fileNodes: FileNode[]): string[] {
        const filePaths: string[] = [];

        const traverse = (nodes: FileNode[]) => {
            for (const node of nodes) {
                if (node.isFile) {
                    filePaths.push(node.path);
                } else {
                    traverse(node.getChildrenArray());
                }
            }
        };

        traverse(fileNodes);
        return filePaths;
    }

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

    private insertFileNodeIntoTree(tree: Map<string, FileNode>, filePath: string, originalUri?: string): void {
        const parts = filePath.split('/').filter(part => part.length > 0);
        let currentLevel = tree;
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!currentLevel.has(part)) {
                let node: FileNode;
                if (isFile) {
                    const currentWorkspace = this.folderTreeService.getCurrentWorkspaceFolder();
                    const fullPath = currentWorkspace ? path.join(currentWorkspace, currentPath) : currentPath;
                    const fileUri = vscode.Uri.file(fullPath).toString();

                    node = FileNode.createFile(part, currentPath, originalUri || fileUri);
                } else {
                    node = FileNode.createDirectory(part, currentPath);
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
            const vscodeUri = vscode.Uri.parse(uri);

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const relativePath = vscode.workspace.asRelativePath(vscodeUri);
                return relativePath.replace(/\\/g, '/');
            }

            return path.basename(vscodeUri.fsPath);
        } catch (error) {
            console.warn(`Failed to get relative path from URI: ${uri}`, error);
            return path.basename(uri.replace(/^file:\/\//, ''));
        }
    }
}