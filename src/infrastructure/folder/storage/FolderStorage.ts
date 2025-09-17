import * as vscode from 'vscode';
import { Folder } from '../../../domain/folder/entities/Folder';
import { IFolderRepository } from '../../../domain/folder/services/FolderService';

export class FolderStorage implements IFolderRepository {
    private folders: Folder[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        this.loadFromStorage();
    }

    findAll(): Folder[] {
        return [...this.folders];
    }

    findById(id: string): Folder | undefined {
        return this.folders.find(f => f.id === id);
    }

    findByName(name: string): Folder | undefined {
        return this.folders.find(f => f.name === name);
    }

    findByWorkspace(workspacePath: string): Folder[] {
        return this.folders.filter(f => f.workspaceFolder === workspacePath);
    }

    save(folder: Folder): void {
        const index = this.folders.findIndex(f => f.id === folder.id);

        if (index >= 0) {
            this.folders[index] = folder;
        } else {
            this.folders.push(folder);
        }

        this.saveToStorage();
    }

    delete(id: string): boolean {
        const index = this.folders.findIndex(f => f.id === id);

        if (index >= 0) {
            this.folders.splice(index, 1);
            this.saveToStorage();
            return true;
        }

        return false;
    }

    exists(id: string): boolean {
        return this.folders.some(f => f.id === id);
    }

    private loadFromStorage(): void {
        const stored = this.context.globalState.get<any[]>('folders', []);
        this.folders = stored.map(data => Folder.fromData(data));
    }

    private saveToStorage(): void {
        const data = this.folders.map(f => f.toData());
        this.context.globalState.update('folders', data);
    }

    // Batch operations for performance
    saveAll(folders: Folder[]): void {
        this.folders = [...folders];
        this.saveToStorage();
    }

    clear(): void {
        this.folders = [];
        this.saveToStorage();
    }
}