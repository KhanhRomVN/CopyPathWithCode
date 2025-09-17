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
        this.cacheManager.clearCache();
        this._onDidChange.fire(undefined);

        setTimeout(() => {
            this.expansionStateManager.restoreExpansionState();
        }, 100);
    }

    refreshSelection(): void {
        this._onDidChange.fire(undefined);
    }

    // File Management Mode methods
    enterFileManagementMode(folderId: string, mode: 'add' | 'remove'): void {
        this.fileManagementStateManager.enterFileManagementMode(folderId, mode);
        this.refresh();
    }

    exitFileManagementMode(): void {
        this.fileManagementStateManager.exitFileManagementMode();
        this.refresh();
    }

    isInFileManagementMode(): boolean {
        return this.fileManagementStateManager.isInFileManagementMode();
    }

    getFileManagementState() {
        return this.fileManagementStateManager.getState();
    }

    // File Selection methods
    toggleFileSelection(filePath: string): void {
        this.fileManagementStateManager.toggleFileSelection(filePath);
        this.refreshSelection();
    }

    selectAllFiles(): void {
        this.fileManagementStateManager.selectAllFiles();
        this.refreshSelection();
    }

    deselectAllFiles(): void {
        this.fileManagementStateManager.deselectAllFiles();
        this.refreshSelection();
    }

    getSelectedFiles(): string[] {
        return this.fileManagementStateManager.getSelectedFiles();
    }

    selectAllFilesInFolder(folderId: string): number {
        const count = this.fileManagementStateManager.selectAllFilesInFolder(folderId);
        this.refreshSelection();
        return count;
    }

    unselectAllFilesInFolder(folderId: string): number {
        const count = this.fileManagementStateManager.unselectAllFilesInFolder(folderId);
        this.refreshSelection();
        return count;
    }

    // Search methods
    getCurrentSearchTerm(): string | null {
        return this.searchManager.getCurrentSearchTerm();
    }

    setSearchFilter(searchTerm: string): { totalMatches: number; fileMatches: number; folderMatches: number } {
        const results = this.searchManager.setSearchFilter(searchTerm, this.folderTreeService, this.viewModeManager.getViewMode());
        this.refresh();
        return results;
    }

    hasActiveSearch(): boolean {
        return this.searchManager.hasActiveSearch();
    }

    clearSearch(): void {
        this.searchManager.clearSearch();
        this.refresh();
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