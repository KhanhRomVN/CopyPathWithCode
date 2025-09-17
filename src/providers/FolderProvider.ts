// FILE: src/providers/FolderProvider.ts - NULL REFRESH SOLUTION
// Uses null refresh to update TreeItem icons without collapsing tree structure

import * as vscode from 'vscode';
import { IFolderTreeService } from '../infrastructure/di/ServiceContainer';
import { TreeItemFactory } from './folder/TreeItemFactory';
import { SearchManager } from './folder/SearchManager';
import { ExpansionStateManager } from './folder/ExpansionStateManager';
import { FileManagementStateManager } from './folder/FileManagementStateManager';
import { CacheManager } from './folder/CacheManager';
import { ViewModeManager } from './folder/ViewModeManager';
import { Logger } from '../utils/common/logger';

export class FolderProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    // Managers
    private readonly treeItemFactory: TreeItemFactory;
    private readonly searchManager: SearchManager;
    private readonly expansionStateManager: ExpansionStateManager;
    private readonly fileManagementStateManager: FileManagementStateManager;
    private readonly cacheManager: CacheManager;
    private readonly viewModeManager: ViewModeManager;

    // Prevent refresh loops
    private isRefreshing = false;

    constructor(private readonly folderTreeService: IFolderTreeService) {
        // Initialize managers
        this.treeItemFactory = new TreeItemFactory(folderTreeService);
        this.searchManager = new SearchManager();
        this.expansionStateManager = new ExpansionStateManager();
        this.fileManagementStateManager = new FileManagementStateManager(folderTreeService);
        this.cacheManager = new CacheManager();
        this.viewModeManager = new ViewModeManager();

        // SOLUTION: Connect FileManagementStateManager to use null refresh
        this.fileManagementStateManager.setSelectionChangeEmitter(this._onDidChange);

        Logger.debug('FolderProvider initialized with null refresh solution');
    }

    // Set tree view reference for expansion management
    setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
        this.expansionStateManager.setTreeView(treeView);
    }

    // Public API methods
    switchViewMode(mode: 'workspace' | 'global'): void {
        this.viewModeManager.setViewMode(mode);
        this.refresh();
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.viewMode', mode);
    }

    getViewMode(): 'workspace' | 'global' {
        return this.viewModeManager.getViewMode();
    }

    refresh(): void {
        if (this.isRefreshing) return; // Prevent refresh loops

        this.isRefreshing = true;
        this.cacheManager.clearCache();
        this._onDidChange.fire(undefined);

        setTimeout(() => {
            this.expansionStateManager.restoreExpansionState();
            this.isRefreshing = false;
        }, 150);
    }

    // File Management Mode methods
    enterFileManagementMode(folderId: string, mode: 'add' | 'remove'): void {
        this.fileManagementStateManager.enterFileManagementMode(folderId, mode);
        this.refresh(); // Full refresh when changing modes
    }

    exitFileManagementMode(): void {
        this.fileManagementStateManager.exitFileManagementMode();
        this.refresh(); // Full refresh when changing modes
    }

    isInFileManagementMode(): boolean {
        return this.fileManagementStateManager.isInFileManagementMode();
    }

    getFileManagementState() {
        return this.fileManagementStateManager.getState();
    }

    // SOLUTION: File Selection methods using null refresh
    toggleFileSelection(filePath: string): void {
        Logger.debug(`FolderProvider.toggleFileSelection: ${filePath}`);

        // The FileManagementStateManager handles the state change and triggers null refresh
        this.fileManagementStateManager.toggleFileSelection(filePath);

        // No additional refresh needed - null refresh from FileManagementStateManager handles it
    }

    selectAllFiles(): void {
        Logger.debug('FolderProvider.selectAllFiles');
        this.fileManagementStateManager.selectAllFiles();
        // FileManagementStateManager handles null refresh
    }

    deselectAllFiles(): void {
        Logger.debug('FolderProvider.deselectAllFiles');
        this.fileManagementStateManager.deselectAllFiles();
        // FileManagementStateManager handles null refresh
    }

    getSelectedFiles(): string[] {
        return this.fileManagementStateManager.getSelectedFiles();
    }

    selectAllFilesInFolder(folderId: string): number {
        const result = this.fileManagementStateManager.selectAllFilesInFolder(folderId);
        // FileManagementStateManager handles null refresh
        return result;
    }

    unselectAllFilesInFolder(folderId: string): number {
        const result = this.fileManagementStateManager.unselectAllFilesInFolder(folderId);
        // FileManagementStateManager handles null refresh
        return result;
    }

    // Search methods
    getCurrentSearchTerm(): string | null {
        return this.searchManager.getCurrentSearchTerm();
    }

    setSearchFilter(searchTerm: string): { totalMatches: number; fileMatches: number; folderMatches: number } {
        const results = this.searchManager.setSearchFilter(searchTerm, this.folderTreeService, this.viewModeManager.getViewMode());
        this.refresh(); // Full refresh for search changes
        return results;
    }

    hasActiveSearch(): boolean {
        return this.searchManager.hasActiveSearch();
    }

    clearSearch(): void {
        this.searchManager.clearSearch();
        this.refresh(); // Full refresh for search changes
    }

    // Cache methods
    clearCache(): void {
        this.cacheManager.clearCache();
    }

    // Statistics
    getFolderCount(): number {
        try {
            const folders = this.viewModeManager.getViewMode() === 'workspace'
                ? this.folderTreeService.getFoldersForWorkspace(this.folderTreeService.getCurrentWorkspaceFolder())
                : this.folderTreeService.getAllFolders();
            return folders.length;
        } catch (error) {
            Logger.error('Error getting folder count:', error);
            return 0;
        }
    }

    // TreeDataProvider implementation
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (this.viewModeManager.getViewMode() === 'global') {
            return this.getGlobalChildren(element);
        }
        return this.getWorkspaceChildren(element);
    }

    // Private methods
    private async getWorkspaceChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        Logger.debug('getWorkspaceChildren called', { element: element?.label });

        if (!element) {
            return this.isInFileManagementMode()
                ? this.fileManagementStateManager.getFileManagementRootItems(this.treeItemFactory)
                : this.treeItemFactory.getFolderItems(
                    this.viewModeManager.getViewMode(),
                    this.searchManager.getCurrentSearchTerm() || undefined
                );
        }

        return this.handleElementExpansion(element);
    }

    private async getGlobalChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        Logger.debug('getGlobalChildren called', { element: element?.label });

        if (!element) {
            return this.isInFileManagementMode()
                ? this.fileManagementStateManager.getFileManagementRootItems(this.treeItemFactory)
                : this.treeItemFactory.getGlobalFolderItems(this.searchManager.getCurrentSearchTerm() || undefined);
        }

        return this.handleElementExpansion(element);
    }

    private async handleElementExpansion(element: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        const elementAny = element as any;

        // File management mode navigation
        if (this.isInFileManagementMode()) {
            if (elementAny.isFileManagementHeader) {
                return this.fileManagementStateManager.getFileManagementFiles(this.treeItemFactory);
            }
            if (elementAny.treeNode) {
                return this.treeItemFactory.convertFileNodeToItems(
                    elementAny.treeNode.getChildrenArray(),
                    this.fileManagementStateManager.getState(),
                    this.searchManager.getCurrentSearchTerm() || undefined
                );
            }
            return [];
        }

        // Directory expansion
        if (elementAny.treeNode && elementAny.folderId) {
            return this.expandDirectory(elementAny);
        }

        // Folder root expansion
        const folderId = elementAny.folderId || elementAny.id;
        if (folderId) {
            return this.expandFolder(folderId);
        }

        return [];
    }

    private async expandDirectory(elementAny: any): Promise<vscode.TreeItem[]> {
        const cacheKey = `${this.viewModeManager.getViewMode()}-${elementAny.folderId}-${elementAny.treeNode.path}`;

        // SOLUTION: Don't use cache during file management to ensure fresh TreeItems with correct selection state
        if (this.isInFileManagementMode()) {
            try {
                const folder = this.folderTreeService.getFolderById(elementAny.folderId);
                return this.treeItemFactory.convertFileNodeToTreeItems(
                    elementAny.treeNode.getChildrenArray(),
                    folder,
                    this.fileManagementStateManager.getState(),
                    this.searchManager.getCurrentSearchTerm() || undefined
                );
            } catch (error) {
                Logger.error(`Failed to expand directory: ${elementAny.treeNode.path}`, error);
                return [];
            }
        }

        // Use cache only in normal mode
        if (this.cacheManager.has(cacheKey)) {
            return this.cacheManager.get(cacheKey)!;
        }

        try {
            const folder = this.folderTreeService.getFolderById(elementAny.folderId);
            const items = this.treeItemFactory.convertFileNodeToTreeItems(
                elementAny.treeNode.getChildrenArray(),
                folder,
                null, // No file management state in normal mode
                this.searchManager.getCurrentSearchTerm() || undefined
            );
            this.cacheManager.set(cacheKey, items);
            return items;
        } catch (error) {
            Logger.error(`Failed to expand directory: ${elementAny.treeNode.path}`, error);
            return [];
        }
    }

    private async expandFolder(folderId: string): Promise<vscode.TreeItem[]> {
        const cacheKey = `${this.viewModeManager.getViewMode()}-${folderId}-root`;

        // SOLUTION: Don't use cache during file management
        if (this.isInFileManagementMode()) {
            try {
                const folder = this.folderTreeService.getFolderById(folderId);
                const fileTree = this.folderTreeService.buildFileTreeForFolder(folderId);
                return this.treeItemFactory.convertFileNodeToTreeItems(
                    fileTree,
                    folder,
                    this.fileManagementStateManager.getState(),
                    this.searchManager.getCurrentSearchTerm() || undefined
                );
            } catch (error) {
                Logger.error(`Failed to expand folder: ${folderId}`, error);
                return [];
            }
        }

        // Use cache only in normal mode
        if (this.cacheManager.has(cacheKey)) {
            return this.cacheManager.get(cacheKey)!;
        }

        try {
            const folder = this.folderTreeService.getFolderById(folderId);
            const fileTree = this.folderTreeService.buildFileTreeForFolder(folderId);
            const items = this.treeItemFactory.convertFileNodeToTreeItems(
                fileTree,
                folder,
                null, // No file management state in normal mode
                this.searchManager.getCurrentSearchTerm() || undefined
            );

            this.cacheManager.set(cacheKey, items);
            return items;
        } catch (error) {
            Logger.error(`Failed to expand folder: ${folderId}`, error);
            return [];
        }
    }

    // Cleanup
    dispose(): void {
        this.fileManagementStateManager.dispose();
        this.cacheManager.clearCache();
    }
}