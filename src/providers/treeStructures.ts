// src/providers/treeStructures.ts
import * as vscode from 'vscode';

export interface TreeNode {
    name: string;
    path: string;
    isFile: boolean;
    children: Map<string, TreeNode>;
    uri?: vscode.Uri;
}

export interface FileManagementState {
    mode: 'normal' | 'add' | 'remove';
    folderId: string | null;
    selectedFiles: Set<string>;
    selectedFolders: Set<string>;
    searchFilter: string;
}

export type ViewMode = 'workspace' | 'global';

export interface SearchState {
    filter: string;
    caseSensitive: boolean;
    includeExtensions: boolean;
}

/**
 * Helper class for building and managing tree structures
 */
export class TreeBuilder {
    /**
     * Build a tree structure from file URIs
     */
    static buildFileTree(fileUris: string[]): TreeNode[] {
        if (!fileUris || fileUris.length === 0) {
            return [];
        }

        const root = new Map<string, TreeNode>();
        const processedPaths = new Set<string>();

        for (const uriStr of fileUris) {
            try {
                const uri = vscode.Uri.parse(uriStr);
                if (uri.scheme !== 'file') {
                    continue;
                }

                let relativePath: string;
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    relativePath = vscode.workspace.asRelativePath(uri);
                } else {
                    relativePath = require('path').basename(uri.fsPath);
                }

                relativePath = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

                if (!relativePath || relativePath === '.' || processedPaths.has(relativePath)) {
                    continue;
                }

                processedPaths.add(relativePath);
                this.insertIntoTree(root, relativePath, uri);
            } catch (error) {
                console.error(`Error processing file URI: ${uriStr}`, error);
            }
        }

        return Array.from(root.values());
    }

    /**
     * Build tree structure from file paths
     */
    static buildFileTreeFromPaths(filePaths: string[]): TreeNode[] {
        const root = new Map<string, TreeNode>();

        for (const filePath of filePaths) {
            let relativePath: string;

            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                relativePath = vscode.workspace.asRelativePath(filePath);
            } else {
                relativePath = require('path').basename(filePath);
            }

            relativePath = relativePath.replace(/\\/g, '/');
            this.insertIntoFileTree(root, relativePath, vscode.Uri.file(filePath));
        }

        return Array.from(root.values());
    }

    /**
     * Insert a file path into the tree structure
     */
    private static insertIntoTree(tree: Map<string, TreeNode>, filePath: string, uri: vscode.Uri) {
        const parts = filePath.split('/').filter(part => part.length > 0);
        let currentLevel = tree;
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!currentLevel.has(part)) {
                const node: TreeNode = {
                    name: part,
                    path: currentPath,
                    isFile,
                    children: new Map(),
                    uri: isFile ? uri : undefined
                };
                currentLevel.set(part, node);
            }

            if (!isFile) {
                currentLevel = currentLevel.get(part)!.children;
            }
        }
    }

    /**
     * Insert a file path into the file tree
     */
    private static insertIntoFileTree(tree: Map<string, TreeNode>, filePath: string, uri: vscode.Uri) {
        const parts = filePath.split('/').filter(part => part.length > 0);
        let currentLevel = tree;
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!currentLevel.has(part)) {
                const node: TreeNode = {
                    name: part,
                    path: currentPath,
                    isFile,
                    children: new Map(),
                    uri: isFile ? uri : undefined
                };
                currentLevel.set(part, node);
            }

            if (!isFile) {
                currentLevel = currentLevel.get(part)!.children;
            }
        }
    }

    /**
     * Count files in a tree node recursively
     */
    static countFilesInNode(node: TreeNode): number {
        let count = 0;
        for (const child of node.children.values()) {
            if (child.isFile) {
                count++;
            } else {
                count += this.countFilesInNode(child);
            }
        }
        return count;
    }

    /**
     * Find a node in the tree by path
     */
    static findNodeInTree(nodes: TreeNode[], targetPath: string): TreeNode | null {
        for (const node of nodes) {
            if (node.path === targetPath) {
                return node;
            }
            if (!node.isFile && node.children.size > 0) {
                const found = this.findNodeInTree(Array.from(node.children.values()), targetPath);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    /**
     * Get all files in a single node recursively
     */
    static getAllFilesInNode(node: TreeNode): string[] {
        const files: string[] = [];

        if (node.isFile) {
            files.push(node.path);
        } else {
            for (const child of node.children.values()) {
                files.push(...this.getAllFilesInNode(child));
            }
        }

        return files;
    }

    /**
     * Get all files from multiple nodes
     */
    static getAllFilesInNodes(nodes: TreeNode[]): string[] {
        const files: string[] = [];
        for (const node of nodes) {
            files.push(...this.getAllFilesInNode(node));
        }
        return files;
    }
}