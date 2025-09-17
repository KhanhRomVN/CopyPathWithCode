import { FileNode } from '../entities/FileNode';

export interface IFileSystemService {
    readFile(uri: string): Promise<string>;
    writeFile(uri: string, content: string): Promise<void>;
    deleteFile(uri: string): Promise<void>;
    moveFile(sourceUri: string, targetUri: string): Promise<void>;
    copyFile(sourceUri: string, targetUri: string): Promise<void>;
    exists(uri: string): Promise<boolean>;
    isFile(uri: string): Promise<boolean>;
    isDirectory(uri: string): Promise<boolean>;
    getFileStats(uri: string): Promise<{ size: number; lastModified: Date }>;
}

export class FileService {
    constructor(private readonly fileSystem: IFileSystemService) { }

    async readFileContent(fileUri: string): Promise<string> {
        if (!await this.fileSystem.exists(fileUri)) {
            throw new Error(`File not found: ${fileUri}`);
        }

        if (!await this.fileSystem.isFile(fileUri)) {
            throw new Error(`Path is not a file: ${fileUri}`);
        }

        return this.fileSystem.readFile(fileUri);
    }

    async writeFileContent(fileUri: string, content: string): Promise<void> {
        await this.fileSystem.writeFile(fileUri, content);
    }

    async deleteFile(fileUri: string): Promise<void> {
        if (!await this.fileSystem.exists(fileUri)) {
            throw new Error(`File not found: ${fileUri}`);
        }

        await this.fileSystem.deleteFile(fileUri);
    }

    async moveFile(sourceUri: string, targetUri: string): Promise<void> {
        if (!await this.fileSystem.exists(sourceUri)) {
            throw new Error(`Source file not found: ${sourceUri}`);
        }

        if (await this.fileSystem.exists(targetUri)) {
            throw new Error(`Target file already exists: ${targetUri}`);
        }

        await this.fileSystem.moveFile(sourceUri, targetUri);
    }

    async copyFile(sourceUri: string, targetUri: string, overwrite = false): Promise<void> {
        if (!await this.fileSystem.exists(sourceUri)) {
            throw new Error(`Source file not found: ${sourceUri}`);
        }

        if (!overwrite && await this.fileSystem.exists(targetUri)) {
            throw new Error(`Target file already exists: ${targetUri}`);
        }

        await this.fileSystem.copyFile(sourceUri, targetUri);
    }

    async validateFileUri(fileUri: string): Promise<boolean> {
        try {
            return await this.fileSystem.exists(fileUri) && await this.fileSystem.isFile(fileUri);
        } catch {
            return false;
        }
    }

    async validateFileUris(fileUris: string[]): Promise<string[]> {
        const validUris: string[] = [];

        for (const uri of fileUris) {
            if (await this.validateFileUri(uri)) {
                validUris.push(uri);
            }
        }

        return validUris;
    }

    async getFileInfo(fileUri: string): Promise<{ size: number; lastModified: Date } | null> {
        try {
            if (!await this.fileSystem.exists(fileUri)) {
                return null;
            }
            return await this.fileSystem.getFileStats(fileUri);
        } catch {
            return null;
        }
    }
}