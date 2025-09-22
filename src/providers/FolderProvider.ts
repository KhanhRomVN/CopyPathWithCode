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

    // SOLUTION: Store tree structure for getParent implementation
    private treeItemParentMap = new Map<string, vscode.TreeItem>();

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

        Logger.debug('FolderProvider initialized with getParent support');
    }

    // CRITICAL FIX: Implement getParent method for reveal functionality
    getParent(element: vscode.TreeItem): vscode.TreeItem | undefined {
        if (!element.id) {
            Logger.debug('getParent: element has no ID');
            return undefined;
        }

        const parent = this.treeItemParentMap.get(element.id);
        Logger.debug(`getParent: element ${element.label} -> parent ${parent?.label || 'none'}`);
        return parent;
    }

    // Helper method to track parent-child relationships
    private trackParentChild(parent: vscode.TreeItem | undefined, child: vscode.TreeItem): void {
        if (child.id && parent?.id) {
            this.treeItemParentMap.set(child.id, parent);
            Logger.debug(`Tracked parent relationship: ${child.label} -> ${parent.label}`);
        }
    }

    // Set tree view reference for expansion management
    setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
        this.expansionStateManager.setTreeView(treeView);
    }

    // Public API methods
    switchViewMode(mode: 'workspace' | 'global'): void {
        this.viewModeManager.setViewMode(mode);
        this.clearParentMap(); // Clear parent map when switching modes
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
        this.clearParentMap(); // Clear parent map on refresh
        this._onDidChange.fire(undefined);

        setTimeout(() => {
            this.expansionStateManager.restoreExpansionState();
            this.isRefreshing = false;
        }, 150);
    }

    // Clear parent mapping
    private clearParentMap(): void {
        this.treeItemParentMap.clear();
        Logger.debug('Parent mapping cleared');
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

    // File Selection methods using null refresh
    toggleFileSelection(filePath: string): void {
        Logger.debug(`FolderProvider.toggleFileSelection: ${filePath}`);
        this.fileManagementStateManager.toggleFileSelection(filePath);
    }

    async selectAllFiles(): Promise<void> {
        Logger.debug('FolderProvider.selectAllFiles');
        await this.fileManagementStateManager.selectAllFiles();
    }

    deselectAllFiles(): void {
        Logger.debug('FolderProvider.deselectAllFiles');
        this.fileManagementStateManager.deselectAllFiles();
    }

    getSelectedFiles(): string[] {
        return this.fileManagementStateManager.getSelectedFiles();
    }

    selectAllFilesInFolder(folderId: string, directoryPath?: string): number {
        const result = this.fileManagementStateManager.selectAllFilesInFolder(folderId, directoryPath);
        return result;
    }

    unselectAllFilesInFolder(folderId: string): number {
        const result = this.fileManagementStateManager.unselectAllFilesInFolder(folderId);
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

    // Private methods - UPDATED to track parent relationships
    private async getWorkspaceChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        Logger.debug('getWorkspaceChildren called', { element: element?.label });

        if (!element) {
            const items = this.isInFileManagementMode()
                ? await this.fileManagementStateManager.getFileManagementRootItems(this.treeItemFactory)
                : this.treeItemFactory.getFolderItems(
                    this.viewModeManager.getViewMode(),
                    this.searchManager.getCurrentSearchTerm() || undefined
                );

            // Track root items (no parent)
            items.forEach(item => {
                if (item.id) {
                    // Root items have no parent
                    Logger.debug(`Root item: ${item.label} (${item.id})`);
                }
            });

            return items;
        }

        return this.handleElementExpansion(element);
    }

    private async getGlobalChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        Logger.debug('getGlobalChildren called', { element: element?.label });

        if (!element) {
            const items = this.isInFileManagementMode()
                ? await this.fileManagementStateManager.getFileManagementRootItems(this.treeItemFactory)
                : this.treeItemFactory.getGlobalFolderItems(this.searchManager.getCurrentSearchTerm() || undefined);

            // Track root items
            items.forEach(item => {
                if (item.id) {
                    Logger.debug(`Global root item: ${item.label} (${item.id})`);
                }
            });

            return items;
        }

        return this.handleElementExpansion(element);
    }

    private async handleElementExpansion(element: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        const elementAny = element as any;

        // File management mode navigation
        if (this.isInFileManagementMode()) {
            if (elementAny.isFileManagementHeader) {
                const items = await this.fileManagementStateManager.getFileManagementFiles(this.treeItemFactory);
                // Track parent relationships for file management items
                items.forEach(item => this.trackParentChild(element, item));
                return items;
            }
            if (elementAny.treeNode) {
                const items = this.treeItemFactory.convertFileNodeToItems(
                    elementAny.treeNode.getChildrenArray(),
                    this.fileManagementStateManager.getState(),
                    this.searchManager.getCurrentSearchTerm() || undefined
                );
                // Track parent relationships
                items.forEach(item => this.trackParentChild(element, item));
                return items;
            }
            return [];
        }

        // Directory expansion
        if (elementAny.treeNode && elementAny.folderId) {
            const items = await this.expandDirectory(elementAny);
            // Track parent relationships for directory items
            items.forEach(item => this.trackParentChild(element, item));
            return items;
        }

        // Folder root expansion
        const folderId = elementAny.folderId || elementAny.id;
        if (folderId) {
            const items = await this.expandFolder(folderId);
            // Track parent relationships for folder items
            items.forEach(item => this.trackParentChild(element, item));
            return items;
        }

        return [];
    }

    private async expandDirectory(elementAny: any): Promise<vscode.TreeItem[]> {
        const cacheKey = `${this.viewModeManager.getViewMode()}-${elementAny.folderId}-${elementAny.treeNode.path}`;

        // Don't use cache during file management to ensure fresh TreeItems with correct selection state
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

        // Don't use cache during file management
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
        this.clearParentMap();
    }
}