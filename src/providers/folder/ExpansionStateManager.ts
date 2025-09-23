import * as vscode from 'vscode';
import { Logger } from '../../utils/common/logger';

export class ExpansionStateManager {
    private expandedItems: Set<string> = new Set();
    private treeView: vscode.TreeView<vscode.TreeItem> | undefined;

    setTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
        this.treeView = treeView;

        // Listen to expansion/collapse events
        this.treeView.onDidExpandElement((event) => {
            const item = event.element as any;
            const itemId = this.getItemId(item);
            if (itemId) {
                this.expandedItems.add(itemId);
            }
        });

        this.treeView.onDidCollapseElement((event) => {
            const item = event.element as any;
            const itemId = this.getItemId(item);
            if (itemId) {
                this.expandedItems.delete(itemId);
            }
        });
    }

    async restoreExpansionState(): Promise<void> {
        if (!this.treeView) return;
        // Wait a bit for tree to be rendered
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    private getItemId(item: any): string | undefined {
        if (item.id) return item.id;
        if (item.folderId && item.treeNode) return `${item.folderId}-${item.treeNode.path}`;
        if (item.folderId) return item.folderId;
        if (item.treeNode) return item.treeNode.path;
        return undefined;
    }
}