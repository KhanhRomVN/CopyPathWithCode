export interface FolderProps {
    id: string;
    name: string;
    files: string[];
    workspaceFolder?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class Folder {
    private readonly _id: string;
    private _name: string;
    private _files: string[];
    private _workspaceFolder?: string;
    private _createdAt: Date;
    private _updatedAt: Date;

    constructor(props: FolderProps) {
        this._id = props.id;
        this._name = props.name;
        this._files = [...props.files]; // Create copy to prevent external mutation
        this._workspaceFolder = props.workspaceFolder;
        this._createdAt = props.createdAt;
        this._updatedAt = props.updatedAt;
    }

    // Getters
    get id(): string { return this._id; }
    get name(): string { return this._name; }
    get files(): readonly string[] { return this._files; }
    get workspaceFolder(): string | undefined { return this._workspaceFolder; }
    get createdAt(): Date { return this._createdAt; }
    get updatedAt(): Date { return this._updatedAt; }
    get fileCount(): number { return this._files.length; }

    // Business methods
    rename(newName: string): void {
        if (!newName.trim()) {
            throw new Error('Folder name cannot be empty');
        }
        this._name = newName.trim();
        this._updatedAt = new Date();
    }

    addFile(fileUri: string): boolean {
        if (this._files.includes(fileUri)) {
            return false; // File already exists
        }
        this._files.push(fileUri);
        this._updatedAt = new Date();
        return true;
    }

    removeFile(fileUri: string): boolean {
        const index = this._files.indexOf(fileUri);
        if (index === -1) {
            return false; // File not found
        }
        this._files.splice(index, 1);
        this._updatedAt = new Date();
        return true;
    }

    addFiles(fileUris: string[]): number {
        let addedCount = 0;
        for (const uri of fileUris) {
            if (this.addFile(uri)) {
                addedCount++;
            }
        }
        return addedCount;
    }

    removeFiles(fileUris: string[]): number {
        let removedCount = 0;
        for (const uri of fileUris) {
            if (this.removeFile(uri)) {
                removedCount++;
            }
        }
        return removedCount;
    }

    hasFile(fileUri: string): boolean {
        return this._files.includes(fileUri);
    }

    isEmpty(): boolean {
        return this._files.length === 0;
    }

    isFromWorkspace(workspacePath: string): boolean {
        if (!this._workspaceFolder) {
            return false;
        }
        return this._workspaceFolder === workspacePath;
    }

    clearFiles(): void {
        this._files = [];
        this._updatedAt = new Date();
    }

    // Factory methods
    static create(name: string, workspaceFolder?: string): Folder {
        const now = new Date();
        return new Folder({
            id: Date.now().toString(),
            name: name.trim(),
            files: [],
            workspaceFolder,
            createdAt: now,
            updatedAt: now
        });
    }

    static fromData(data: any): Folder {
        return new Folder({
            id: data.id,
            name: data.name,
            files: data.files || [],
            workspaceFolder: data.workspaceFolder,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
        });
    }

    // Serialization
    toData(): FolderProps {
        return {
            id: this._id,
            name: this._name,
            files: [...this._files],
            workspaceFolder: this._workspaceFolder,
            createdAt: this._createdAt,
            updatedAt: this._updatedAt
        };
    }
}