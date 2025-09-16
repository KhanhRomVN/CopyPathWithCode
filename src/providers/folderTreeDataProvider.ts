import * as vscode from 'vscode';
import { state, Folder } from '../models/models';
import { TreeItemConverter } from './treeItemConverter';
import { TreeBuilder, TreeNode } from './treeStructures';
import { FileManagement } from './fileManagement';
import { SearchFilter } from './searchFilter';
import { ViewMode } from './treeStructures';

export class FolderTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private viewMode: ViewMode = 'workspace';
    private fileManagement = new FileManagement();
    private searchFilter = new SearchFilter();

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (this.fileManagement.isInFileManagementMode()) {
            return this.getFileManagementChildren(element);
        }

        if (!element) {
            return this.getRootItems();
        }

        return this.getFolderChildren(element);
    }

    private getRootItems(): vscode.TreeItem[] {
        if (this.viewMode === 'workspace') {
            return TreeItemConverter.getFolderItems();
        } else {
            return TreeItemConverter.getGlobalFolderItems();
        }
    }

    private async getFolderChildren(element: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        const folderId = (element as any).folderId;
        if (!folderId) return [];

        const folder = state.folders.find(f => f.id === folderId);
        if (!folder) return [];

        const treeNodes = TreeBuilder.buildFileTree(folder.files);
        return TreeItemConverter.convertTreeToItems(treeNodes, folder);
    }

    private async getFileManagementChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            return TreeItemConverter.getFileManagementRootItems(this.fileManagement.getFileManagementState());
        }

        if ((element as any).isFileManagementHeader) {
            const fileTree = await this.fileManagement.getFileManagementFiles();
            return TreeItemConverter.convertFileTreeToItems(fileTree, this.fileManagement.getFileManagementState());
        }

        // If element has a treeNode, then it's a node in the file tree
        const treeNode = (element as any).treeNode;
        if (treeNode) {
            // If it's a directory, get its children and convert to items
            if (!treeNode.isFile) {
                const children = Array.from(treeNode.children.values()) as TreeNode[];
                return TreeItemConverter.convertFileTreeToItems(children, this.fileManagement.getFileManagementState());
            }
        }

        return [];
    }

    getViewMode(): ViewMode {
        return this.viewMode;
    }

    switchViewMode(mode: ViewMode): void {
        this.viewMode = mode;
        this.refresh();
    }

    isInFileManagementMode(): boolean {
        return this.fileManagement.isInFileManagementMode();
    }

    enterFileManagementMode(folderId: string, mode: 'add' | 'remove'): void {
        this.fileManagement.enterFileManagementMode(folderId, mode);
        this.refresh();
    }

    exitFileManagementMode(): void {
        this.fileManagement.exitFileManagementMode();
        this.refresh();
    }

    toggleFileSelection(filePath: string): void {
        this.fileManagement.toggleFileSelection(filePath);
        this.refresh();
    }

    selectAllFiles(): void {
        this.fileManagement.selectAllFiles();
        this.refresh();
    }

    deselectAllFiles(): void {
        this.fileManagement.deselectAllFiles();
        this.refresh();
    }

    getSelectedFiles(): string[] {
        return this.fileManagement.getSelectedFiles();
    }

    getFileManagementState() {
        return this.fileManagement.getFileManagementState();
    }

    async showSearchInput(): Promise<void> {
        await this.fileManagement.showSearchInput();
        this.refresh();
    }

    clearSearch(): void {
        this.fileManagement.clearSearch();
        this.refresh();
    }

    updateSearchFilter(filter: string): void {
        this.fileManagement.updateSearchFilter(filter);
        this.refresh();
    }
}