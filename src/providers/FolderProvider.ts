// FILE: src/providers/FolderProvider.ts - FIXED VERSION
// Prevents auto-collapse when selecting files

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
    private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
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

        // Setup refresh triggers
        this.setupRefreshTriggers();
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
        this.refresh(); // This is OK because we're changing modes
    }

    exitFileManagementMode(): void {
        this.fileManagementStateManager.exitFileManagementMode();
        this.refresh(); // This is OK because we're changing modes
    }

    isInFileManagementMode(): boolean {
        return this.fileManagementStateManager.isInFileManagementMode();
    }

    getFileManagementState() {
        return this.fileManagementStateManager.getState();
    }

    // CRITICAL FIX: File Selection methods - NO REFRESH TO PREVENT COLLAPSE
    toggleFileSelection(filePath: string): void {
        Logger.debug(`Toggling file selection: ${filePath}`);
        this.fileManagementStateManager.toggleFileSelection(filePath);

        // DO NOT call refresh() here - this causes the collapse issue
        // Instead, just log the change
        const selectedCount = this.getSelectedFiles().length;
        Logger.debug(`File selection updated. Total selected: ${selectedCount}`);
    }

    selectAllFiles(): void {
        Logger.debug('Selecting all files');
        this.fileManagementStateManager.selectAllFiles();

        // Use a minimal refresh approach that batches changes
        this.batchedRefresh();
    }

    deselectAllFiles(): void {
        Logger.debug('Deselecting all files');
        this.fileManagementStateManager.deselectAllFiles();

        // Use a minimal refresh approach that batches changes  
        this.batchedRefresh();
    }

    getSelectedFiles(): string[] {
        return this.fileManagementStateManager.getSelectedFiles();
    }

    selectAllFilesInFolder(folderId: string): number {
        const count = this.fileManagementStateManager.selectAllFilesInFolder(folderId);

        // Use batched refresh to prevent multiple rapid updates
        this.batchedRefresh();
        return count;
    }

    unselectAllFilesInFolder(folderId: string): number {
        const count = this.fileManagementStateManager.unselectAllFilesInFolder(folderId);

        // Use batched refresh to prevent multiple rapid updates
        this.batchedRefresh();
        return count;
    }

    // NEW: Batched refresh to prevent collapse during rapid selection changes
    private batchedRefreshTimer: NodeJS.Timeout | undefined;
    private batchedRefresh(): void {
        // Clear existing timer
        if (this.batchedRefreshTimer) {
            clearTimeout(this.batchedRefreshTimer);
        }

        // Set new timer - only refresh after 200ms of no changes
        this.batchedRefreshTimer = setTimeout(() => {
            if (this.isInFileManagementMode()) {
                Logger.debug('Executing batched refresh for file selection');

                // Clear cache but don't fire full refresh
                this.cacheManager.clearCache();

                // Only fire refresh if we absolutely must
                // In practice, we could implement more granular updates here
                this._onDidChange.fire(undefined);
            }
            this.batchedRefreshTimer = undefined;
        }, 200);
    }

    // Search methods
    getCurrentSearchTerm(): string | null {
        return this.searchManager.getCurrentSearchTerm();
    }

    setSearchFilter(searchTerm: string): { totalMatches: number; fileMatches: number; folderMatches: number } {
        const results = this.searchManager.setSearchFilter(searchTerm, this.folderTreeService, this.viewModeManager.getViewMode());
        this.refresh(); // This is OK because we're changing search filter
        return results;
    }

    hasActiveSearch(): boolean {
        return this.searchManager.hasActiveSearch();
    }

    clearSearch(): void {
        this.searchManager.clearSearch();
        this.refresh(); // This is OK because we're changing search filter
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
    private setupRefreshTriggers(): void {
        // Setup any additional refresh triggers if needed
    }

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

        if (this.cacheManager.has(cacheKey)) {
            return this.cacheManager.get(cacheKey)!;
        }

        try {
            const folder = this.folderTreeService.getFolderById(elementAny.folderId);
            const items = this.treeItemFactory.convertFileNodeToTreeItems(
                elementAny.treeNode.getChildrenArray(),
                folder,
                null, // No file management state
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

        if (this.cacheManager.has(cacheKey)) {
            return this.cacheManager.get(cacheKey)!;
        }

        try {
            const folder = this.folderTreeService.getFolderById(folderId);
            const fileTree = this.folderTreeService.buildFileTreeForFolder(folderId);
            const items = this.treeItemFactory.convertFileNodeToTreeItems(
                fileTree,
                folder,
                null, // No file management state
                this.searchManager.getCurrentSearchTerm() || undefined
            );

            this.cacheManager.set(cacheKey, items);
            return items;
        } catch (error) {
            Logger.error(`Failed to expand folder: ${folderId}`, error);
            return [];
        }
    }
}