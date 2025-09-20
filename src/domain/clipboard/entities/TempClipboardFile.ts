/**
 * FILE: src/domain/clipboard/entities/TempClipboardFile.ts
 * 
 * TEMPORARY CLIPBOARD FILE ENTITY - WORKSPACE SPECIFIC
 * 
 * Represents a temporarily stored file specific to the current VSCode workspace.
 * This allows each workspace to maintain its own separate temporary clipboard.
 */

export interface TempClipboardFile {
    displayPath: string;
    basePath: string;
    content: string;
    format: 'normal' | 'error';
    workspaceId: string; // Unique identifier for workspace
    savedAt: number; // Timestamp when saved
}

export class TempClipboardFileEntity {
    constructor(
        public readonly displayPath: string,
        public readonly basePath: string,
        public readonly content: string,
        public readonly format: 'normal' | 'error',
        public readonly workspaceId: string,
        public readonly savedAt: number = Date.now()
    ) { }

    static create(
        displayPath: string,
        basePath: string,
        content: string,
        format: 'normal' | 'error',
        workspaceId: string
    ): TempClipboardFileEntity {
        return new TempClipboardFileEntity(
            displayPath,
            basePath,
            content,
            format,
            workspaceId,
            Date.now()
        );
    }

    equals(other: TempClipboardFileEntity): boolean {
        return this.basePath === other.basePath &&
            this.workspaceId === other.workspaceId;
    }

    getFileName(): string {
        return this.displayPath.split('/').pop() || this.displayPath;
    }

    isFromWorkspace(workspaceId: string): boolean {
        return this.workspaceId === workspaceId;
    }
}