/**
 * FILE: src/domain/clipboard/services/TempStorageService.ts
 * 
 * TEMPORARY STORAGE SERVICE - WORKSPACE SPECIFIC
 * 
 * Manages temporary clipboard storage that is specific to each VSCode workspace.
 * Each workspace maintains its own separate temporary storage.
 */

import { TempClipboardFile } from '../entities/TempClipboardFile';

export interface ITempStorageRepository {
    // Temp storage operations for current workspace
    getTempFiles(workspaceId: string): TempClipboardFile[];
    setTempFiles(workspaceId: string, files: TempClipboardFile[]): void;
    addTempFile(file: TempClipboardFile): void;
    clearTempFiles(workspaceId: string): void;

    // Workspace management
    getCurrentWorkspaceId(): string;
}

export class TempStorageService {
    constructor(
        private repository: ITempStorageRepository
    ) { }

    /**
     * Save current copied files to temporary storage for current workspace
     */
    async saveToTempStorage(copiedFiles: any[]): Promise<void> {
        const workspaceId = this.repository.getCurrentWorkspaceId();

        const tempFiles: TempClipboardFile[] = copiedFiles.map(file => ({
            displayPath: file.displayPath,
            basePath: file.basePath,
            content: file.content,
            format: file.format,
            workspaceId: workspaceId,
            savedAt: Date.now()
        }));

        this.repository.setTempFiles(workspaceId, tempFiles);
    }

    /**
     * Get temporary files for current workspace
     */
    getTempFiles(): TempClipboardFile[] {
        const workspaceId = this.repository.getCurrentWorkspaceId();
        return this.repository.getTempFiles(workspaceId);
    }

    /**
     * Clear temporary storage for current workspace only
     */
    async clearTempStorage(): Promise<void> {
        const workspaceId = this.repository.getCurrentWorkspaceId();
        this.repository.clearTempFiles(workspaceId);
    }

    /**
     * Check if temp storage has files for current workspace
     */
    hasTempFiles(): boolean {
        return this.getTempFiles().length > 0;
    }

    /**
     * Get temp storage statistics for current workspace
     */
    getTempStats(): { count: number; workspaceId: string } {
        const workspaceId = this.repository.getCurrentWorkspaceId();
        const files = this.repository.getTempFiles(workspaceId);

        return {
            count: files.length,
            workspaceId: workspaceId
        };
    }
}