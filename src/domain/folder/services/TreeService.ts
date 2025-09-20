/**
 * FILE: src/domain/folder/services/TreeService.ts - ENHANCED VERSION
 * 
 * ENHANCED TREE SERVICE - Improved URI and cross-workspace handling
 * 
 * Fixes:
 * 1. Better URI to relative path conversion for cross-workspace scenarios
 * 2. Improved path normalization
 * 3. Enhanced error handling for invalid URIs
 */

import { FileNode } from '../entities/FileNode';
import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../../utils/common/logger';

export interface IPathService {
    normalize(path: string): string;
    join(...paths: string[]): string;
    dirname(path: string): string;
    basename(path: string): string;
    extname(path: string): string;
    relative(from: string, to: string): string;
    isAbsolute(path: string): boolean;
}

export class TreeService {
    constructor(private readonly pathService: IPathService) { }

    buildFileTree(fileUris: string[]): FileNode[] {
        const root = new Map<string, FileNode>();

        for (const uri of fileUris) {
            try {
                this.insertFileIntoTree(root, uri);
            } catch (error) {
                // Log error but continue with other files
                Logger.warn(`Failed to process file: ${uri}`, error);
            }
        }

        return FileNode.sortNodes(Array.from(root.values()));
    }

    buildFileTreeFromPaths(filePaths: string[]): FileNode[] {
        const root = new Map<string, FileNode>();

        for (const filePath of filePaths) {
            try {
                this.insertPathIntoTree(root, filePath);
            } catch (error) {
                Logger.warn(`Failed to process path: ${filePath}`, error);
            }
        }

        return FileNode.sortNodes(Array.from(root.values()));
    }

    private insertFileIntoTree(tree: Map<string, FileNode>, fileUri: string): void {
        try {
            // Parse URI and get relative path
            const relativePath = this.getRelativePathFromUri(fileUri);
            const normalizedPath = this.pathService.normalize(relativePath);

            this.insertPathIntoTree(tree, normalizedPath, fileUri);
        } catch (error) {
            Logger.warn(`Failed to insert file into tree: ${fileUri}`, error);
            throw error;
        }
    }

    private insertPathIntoTree(tree: Map<string, FileNode>, filePath: string, uri?: string): void {
        const parts = filePath.split('/').filter(part => part.length > 0);

        if (parts.length === 0) {
            return;
        }

        let currentLevel = tree;
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!currentLevel.has(part)) {
                const node = isFile
                    ? FileNode.createFile(part, currentPath, uri)
                    : FileNode.createDirectory(part, currentPath);

                currentLevel.set(part, node);
            }

            if (!isFile) {
                const node = currentLevel.get(part)!;
                currentLevel = node.children;
            }
        }
    }

    // ENHANCED: Improved URI to relative path conversion with cross-workspace support
    private getRelativePathFromUri(uri: string): string {
        try {
            const vscodeUri = vscode.Uri.parse(uri);

            // Strategy 1: Try current workspace first
            const currentWorkspaceFolders = vscode.workspace.workspaceFolders;
            if (currentWorkspaceFolders && currentWorkspaceFolders.length > 0) {
                for (const workspaceFolder of currentWorkspaceFolders) {
                    try {
                        const relativePath = path.relative(workspaceFolder.uri.fsPath, vscodeUri.fsPath);

                        // If relative path doesn't start with '..', it's within this workspace
                        if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
                            return relativePath.replace(/\\/g, '/');
                        }
                    } catch {
                        continue;
                    }
                }

                // Strategy 2: Use VS Code's built-in method as fallback
                try {
                    const relativePath = vscode.workspace.asRelativePath(vscodeUri, false);
                    if (!path.isAbsolute(relativePath)) {
                        return relativePath.replace(/\\/g, '/');
                    }
                } catch {
                    // Continue to next strategy
                }
            }

            // Strategy 3: For files outside workspace, try to find a common parent
            if (currentWorkspaceFolders && currentWorkspaceFolders.length > 0) {
                const currentWorkspace = currentWorkspaceFolders[0].uri.fsPath;
                const filePath = vscodeUri.fsPath;

                // Find common parent directory
                const commonParent = this.findCommonParent(currentWorkspace, filePath);
                if (commonParent) {
                    const relativePath = path.relative(commonParent, filePath);
                    return relativePath.replace(/\\/g, '/');
                }
            }

            // Strategy 4: Extract from file URI directly
            const fsPath = vscodeUri.fsPath;

            // For cross-platform compatibility, always use forward slashes
            return fsPath.replace(/\\/g, '/');

        } catch (error) {
            Logger.warn(`Failed to parse URI: ${uri}`, error);
            // Fallback: remove file:// prefix and normalize
            return uri.replace(/^file:\/\//, '').replace(/\\/g, '/');
        }
    }

    // NEW: Find common parent directory between two paths
    private findCommonParent(path1: string, path2: string): string | null {
        try {
            const parts1 = path.resolve(path1).split(path.sep);
            const parts2 = path.resolve(path2).split(path.sep);

            let commonParts = [];
            const minLength = Math.min(parts1.length, parts2.length);

            for (let i = 0; i < minLength; i++) {
                if (parts1[i] === parts2[i]) {
                    commonParts.push(parts1[i]);
                } else {
                    break;
                }
            }

            // Need at least 2 parts for a meaningful common parent
            if (commonParts.length >= 2) {
                return commonParts.join(path.sep);
            }

            return null;
        } catch {
            return null;
        }
    }

    getAllFilesFromTree(nodes: FileNode[]): FileNode[] {
        const allFiles: FileNode[] = [];

        for (const node of nodes) {
            allFiles.push(...node.getAllFiles());
        }

        return allFiles;
    }

    filterTree(nodes: FileNode[], predicate: (node: FileNode) => boolean): FileNode[] {
        const filtered: FileNode[] = [];

        for (const node of nodes) {
            if (predicate(node)) {
                if (node.isFile) {
                    filtered.push(node);
                } else {
                    // For directories, include if they have matching children
                    const filteredChildren = this.filterTree(node.getChildrenArray(), predicate);
                    if (filteredChildren.length > 0) {
                        // Create new directory node with filtered children
                        const filteredDir = FileNode.createDirectory(node.name, node.path);
                        filteredChildren.forEach(child => filteredDir.addChild(child));
                        filtered.push(filteredDir);
                    }
                }
            }
        }

        return FileNode.sortNodes(filtered);
    }

    // NEW: Utility methods for path handling

    /**
     * Convert absolute path to relative path from workspace
     */
    makeRelativePath(absolutePath: string, workspaceFolder?: string): string {
        try {
            if (!workspaceFolder) {
                const currentWorkspaceFolders = vscode.workspace.workspaceFolders;
                if (currentWorkspaceFolders && currentWorkspaceFolders.length > 0) {
                    workspaceFolder = currentWorkspaceFolders[0].uri.fsPath;
                }
            }

            if (workspaceFolder) {
                const relativePath = path.relative(workspaceFolder, absolutePath);
                if (!relativePath.startsWith('..')) {
                    return relativePath.replace(/\\/g, '/');
                }
            }

            // Fallback: return basename if can't make relative
            return path.basename(absolutePath);
        } catch (error) {
            Logger.warn(`Failed to make relative path for: ${absolutePath}`, error);
            return path.basename(absolutePath);
        }
    }

    /**
     * Validate and normalize URI
     */
    normalizeUri(uri: string): string {
        try {
            const vscodeUri = vscode.Uri.parse(uri);
            return vscodeUri.toString();
        } catch (error) {
            Logger.warn(`Failed to normalize URI: ${uri}`, error);
            return uri;
        }
    }

    /**
     * Check if file URI is valid and accessible
     */
    async isValidFileUri(uri: string): Promise<boolean> {
        try {
            const vscodeUri = vscode.Uri.parse(uri);
            await vscode.workspace.fs.stat(vscodeUri);
            return true;
        } catch {
            return false;
        }
    }
}