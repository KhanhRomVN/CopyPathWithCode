export interface FileNodeProps {
    name: string;
    path: string;
    isFile: boolean;
    children?: Map<string, FileNode>;
    uri?: string;
    size?: number;
    lastModified?: Date;
}

export class FileNode {
    private readonly _name: string;
    private readonly _path: string;
    private readonly _isFile: boolean;
    private readonly _children: Map<string, FileNode>;
    private readonly _uri?: string;
    private readonly _size?: number;
    private readonly _lastModified?: Date;

    constructor(props: FileNodeProps) {
        this._name = props.name;
        this._path = props.path;
        this._isFile = props.isFile;
        this._children = props.children || new Map();
        this._uri = props.uri;
        this._size = props.size;
        this._lastModified = props.lastModified;
    }

    // Getters
    get name(): string { return this._name; }
    get path(): string { return this._path; }
    get isFile(): boolean { return this._isFile; }
    get isDirectory(): boolean { return !this._isFile; }
    get children(): Map<string, FileNode> { return this._children; }
    get uri(): string | undefined { return this._uri; }
    get size(): number | undefined { return this._size; }
    get lastModified(): Date | undefined { return this._lastModified; }
    get hasChildren(): boolean { return this._children.size > 0; }
    get childrenCount(): number { return this._children.size; }

    // Tree operations
    addChild(child: FileNode): void {
        if (this._isFile) {
            throw new Error('Cannot add children to a file node');
        }
        this._children.set(child.name, child);
    }

    getChildrenArray(): FileNode[] {
        return Array.from(this._children.values());
    }

    // Recursive operations
    getAllFiles(): FileNode[] {
        const files: FileNode[] = [];

        if (this._isFile) {
            files.push(this);
        } else {
            for (const child of this._children.values()) {
                files.push(...child.getAllFiles());
            }
        }

        return files;
    }

    getAllFilePaths(): string[] {
        return this.getAllFiles().map(file => file.path);
    }

    getFileCount(): number {
        if (this._isFile) {
            return 1;
        }

        let count = 0;
        for (const child of this._children.values()) {
            count += child.getFileCount();
        }
        return count;
    }

    // Factory methods - UPDATED: Thêm URI cho directory
    static createFile(name: string, path: string, uri?: string, size?: number, lastModified?: Date): FileNode {
        return new FileNode({
            name,
            path,
            isFile: true,
            uri,
            size,
            lastModified
        });
    }

    static createDirectory(name: string, path: string, uri?: string): FileNode {
        return new FileNode({
            name,
            path,
            isFile: false,
            children: new Map(),
            uri // FIXED: Thêm URI cho directory
        });
    }

    // Sorting
    static sortNodes(nodes: FileNode[]): FileNode[] {
        return nodes.sort((a, b) => {
            // Directories first, then files
            if (a.isFile !== b.isFile) {
                return a.isFile ? 1 : -1;
            }
            // Alphabetical within same type
            return a.name.localeCompare(b.name);
        });
    }

    static createDirectoryWithUri(name: string, path: string, workspacePath?: string): FileNode {
        let uri: string | undefined;

        if (workspacePath) {
            const fullPath = require('path').join(workspacePath, path);
            uri = `file://${fullPath}`;
        }

        return new FileNode({
            name,
            path,
            isFile: false,
            children: new Map(),
            uri
        });
    }
}