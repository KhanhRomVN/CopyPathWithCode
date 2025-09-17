import { FileNode } from '../entities/FileNode';
import * as vscode from 'vscode';

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
                console.warn(`Failed to process file: ${uri}`, error);
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
                console.warn(`Failed to process path: ${filePath}`, error);
            }
        }

        return FileNode.sortNodes(Array.from(root.values()));
    }

    private insertFileIntoTree(tree: Map<string, FileNode>, fileUri: string): void {
        // Parse URI and get relative path from workspace
        const relativePath = this.getRelativePathFromUri(fileUri);
        const normalizedPath = this.pathService.normalize(relativePath);

        this.insertPathIntoTree(tree, normalizedPath, fileUri);
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

    private getRelativePathFromUri(uri: string): string {
        try {
            const vscodeUri = vscode.Uri.parse(uri);

            // Use VS Code's workspace API to get relative path
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const relativePath = vscode.workspace.asRelativePath(vscodeUri);
                return relativePath.replace(/\\/g, '/');
            }

            // Fallback: extract from file URI
            return vscodeUri.fsPath.replace(/\\/g, '/');
        } catch (error) {
            console.warn(`Failed to parse URI: ${uri}`, error);
            // Fallback: remove file:// prefix and normalize
            return uri.replace(/^file:\/\//, '').replace(/\\/g, '/');
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
}