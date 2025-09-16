// src/providers/searchFilter.ts
import * as vscode from 'vscode';
import { TreeNode, SearchState } from './treeStructures';
import { Logger } from '../utils/logger';

/**
 * Handles search and filter functionality for the tree view
 */
export class SearchFilter {
    private searchState: SearchState = {
        filter: '',
        caseSensitive: false,
        includeExtensions: true
    };

    /**
     * Update the search filter
     */
    updateFilter(filter: string): void {
        this.searchState.filter = filter.trim();
        Logger.debug(`Search filter updated: "${this.searchState.filter}"`);
    }

    /**
     * Get current search filter
     */
    getFilter(): string {
        return this.searchState.filter;
    }

    /**
     * Check if search is active
     */
    hasActiveFilter(): boolean {
        return this.searchState.filter.length > 0;
    }

    /**
     * Clear the search filter
     */
    clearFilter(): void {
        this.searchState.filter = '';
        Logger.debug('Search filter cleared');
    }

    /**
     * Filter tree nodes based on current search term
     */
    filterTreeNodes(nodes: TreeNode[]): TreeNode[] {
        if (!this.hasActiveFilter()) {
            return nodes;
        }

        const searchTerm = this.searchState.caseSensitive
            ? this.searchState.filter
            : this.searchState.filter.toLowerCase();

        return this.filterNodesRecursively(nodes, searchTerm);
    }

    /**
     * Recursively filter nodes based on search term
     */
    private filterNodesRecursively(nodes: TreeNode[], searchTerm: string): TreeNode[] {
        const filteredNodes: TreeNode[] = [];

        for (const node of nodes) {
            // Prepare node name for comparison
            let nodeName = node.name;
            let nodePath = node.path;

            if (!this.searchState.caseSensitive) {
                nodeName = nodeName.toLowerCase();
                nodePath = nodePath.toLowerCase();
            }

            // Check if current node matches search
            const nodeMatches = this.nodeMatchesSearch(nodeName, nodePath, searchTerm);

            // Recursively filter children
            const filteredChildren = this.filterNodesRecursively(
                Array.from(node.children.values()),
                searchTerm
            );

            // Include node if it matches or has matching children
            if (nodeMatches || filteredChildren.length > 0) {
                const filteredNode: TreeNode = {
                    name: node.name,
                    path: node.path,
                    isFile: node.isFile,
                    children: new Map(),
                    uri: node.uri
                };

                // Add filtered children
                filteredChildren.forEach(child => {
                    filteredNode.children.set(child.name, child);
                });

                // If node matches but has no matching children, include all children
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
     * Check if a node matches the search criteria
     */
    private nodeMatchesSearch(nodeName: string, nodePath: string, searchTerm: string): boolean {
        // Basic name and path matching
        if (nodeName.includes(searchTerm) || nodePath.includes(searchTerm)) {
            return true;
        }

        // If not including extensions, also try matching without extension
        if (!this.searchState.includeExtensions && nodeName.includes('.')) {
            const nameWithoutExt = nodeName.substring(0, nodeName.lastIndexOf('.'));
            if (nameWithoutExt.includes(searchTerm)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Show search input dialog
     */
    async showSearchInput(): Promise<string | undefined> {
        const searchTerm = await vscode.window.showInputBox({
            prompt: 'Search files and folders (leave empty to show all)',
            placeHolder: 'Type to filter files and folders...',
            value: this.searchState.filter,
            title: 'File & Folder Search'
        });

        if (searchTerm !== undefined) {
            this.updateFilter(searchTerm);

            if (searchTerm.trim()) {
                vscode.window.showInformationMessage(`Searching for: "${searchTerm}"`);
            } else {
                vscode.window.showInformationMessage('Search cleared - showing all files');
            }
        }

        return searchTerm;
    }

    /**
     * Show advanced search options
     */
    async showAdvancedSearchOptions(): Promise<void> {
        const items = [
            {
                label: `Case Sensitive: ${this.searchState.caseSensitive ? 'On' : 'Off'}`,
                description: 'Toggle case sensitive search',
                action: 'toggleCaseSensitive'
            },
            {
                label: `Include Extensions: ${this.searchState.includeExtensions ? 'On' : 'Off'}`,
                description: 'Include file extensions in search',
                action: 'toggleIncludeExtensions'
            }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Search Options',
            title: 'Advanced Search Settings'
        });

        if (selection) {
            switch (selection.action) {
                case 'toggleCaseSensitive':
                    this.searchState.caseSensitive = !this.searchState.caseSensitive;
                    break;
                case 'toggleIncludeExtensions':
                    this.searchState.includeExtensions = !this.searchState.includeExtensions;
                    break;
            }
        }
    }

    /**
     * Get search state for external access
     */
    getSearchState(): SearchState {
        return { ...this.searchState };
    }

    /**
     * Set search options
     */
    setSearchOptions(options: Partial<SearchState>): void {
        this.searchState = { ...this.searchState, ...options };
    }
}