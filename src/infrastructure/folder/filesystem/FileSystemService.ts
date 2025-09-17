import * as vscode from 'vscode';
import { IFileSystemService } from '../../../domain/folder/services/FileService';

export class VSCodeFileSystemService implements IFileSystemService {

    async readFile(uri: string): Promise<string> {
        const vscodeUri = vscode.Uri.parse(uri);
        const uint8Array = await vscode.workspace.fs.readFile(vscodeUri);
        return new TextDecoder().decode(uint8Array);
    }

    async writeFile(uri: string, content: string): Promise<void> {
        const vscodeUri = vscode.Uri.parse(uri);
        const uint8Array = new TextEncoder().encode(content);
        await vscode.workspace.fs.writeFile(vscodeUri, uint8Array);
    }

    async deleteFile(uri: string): Promise<void> {
        const vscodeUri = vscode.Uri.parse(uri);
        await vscode.workspace.fs.delete(vscodeUri);
    }

    async moveFile(sourceUri: string, targetUri: string): Promise<void> {
        const source = vscode.Uri.parse(sourceUri);
        const target = vscode.Uri.parse(targetUri);
        await vscode.workspace.fs.rename(source, target);
    }

    async copyFile(sourceUri: string, targetUri: string): Promise<void> {
        const source = vscode.Uri.parse(sourceUri);
        const target = vscode.Uri.parse(targetUri);
        await vscode.workspace.fs.copy(source, target);
    }

    async exists(uri: string): Promise<boolean> {
        try {
            const vscodeUri = vscode.Uri.parse(uri);
            await vscode.workspace.fs.stat(vscodeUri);
            return true;
        } catch {
            return false;
        }
    }

    async isFile(uri: string): Promise<boolean> {
        try {
            const vscodeUri = vscode.Uri.parse(uri);
            const stat = await vscode.workspace.fs.stat(vscodeUri);
            return stat.type === vscode.FileType.File;
        } catch {
            return false;
        }
    }

    async isDirectory(uri: string): Promise<boolean> {
        try {
            const vscodeUri = vscode.Uri.parse(uri);
            const stat = await vscode.workspace.fs.stat(vscodeUri);
            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }

    async getFileStats(uri: string): Promise<{ size: number; lastModified: Date }> {
        const vscodeUri = vscode.Uri.parse(uri);
        const stat = await vscode.workspace.fs.stat(vscodeUri);

        return {
            size: stat.size,
            lastModified: new Date(stat.mtime)
        };
    }
}