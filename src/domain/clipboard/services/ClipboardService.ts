/**
 * FILE: src/domain/clipboard/services/ClipboardService.ts
 * 
 * CLIPBOARD SERVICE - DOMAIN SERVICE FOR CLIPBOARD OPERATIONS
 * TEMP CLIPBOARD FUNCTIONALITY REMOVED
 * 
 * Complete service implementation handling clipboard-related operations
 * including copy, paste, detection, and integrity checking.
 */

import { ErrorInfo } from '../../../models/models';
import { CopiedFile } from '../entities/CopiedFile';
import { DetectedFile } from '../entities/DetectedFile';
// TempClipboardFile removed - no longer needed

// Repository interface for clipboard data persistence
export interface IClipboardRepository {
    // Copied files operations
    getCopiedFiles(): CopiedFile[];
    setCopiedFiles(files: CopiedFile[]): void;
    addCopiedFile(file: CopiedFile): void;
    removeCopiedFile(basePath: string): void;
    clearCopiedFiles(): void;

    // Detected files operations
    getDetectedFiles(): DetectedFile[];
    setDetectedFiles(files: DetectedFile[]): void;
    clearDetectedFiles(): void;

    // Temp storage operations - REMOVED
    // All temp-related methods have been removed
}

// System service interface for clipboard system operations
export interface IClipboardSystemService {
    readClipboard(): Promise<string>;
    writeClipboard(content: string): Promise<void>;
}

// Notification service interface for user feedback
export interface IClipboardNotificationService {
    showInfo(message: string): void;
    showWarning(message: string): void;
    showError(message: string): void;
}

export class ClipboardService {
    private readonly TRACKING_SIGNATURE = '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';

    constructor(
        private repository: IClipboardRepository,
        private systemService: IClipboardSystemService,
        private notificationService?: IClipboardNotificationService
    ) { }

    // ==================== COPIED FILES OPERATIONS ====================

    /**
     * Get all currently copied files
     */
    getCopiedFiles(): CopiedFile[] {
        return this.repository.getCopiedFiles();
    }

    /**
     * Add a file to the copied files collection
     */
    async addCopiedFile(file: CopiedFile): Promise<void> {
        // Remove any existing file with same basePath
        this.repository.removeCopiedFile(file.basePath);

        // Add the new file
        this.repository.addCopiedFile(file);

        // Update system clipboard
        await this.updateSystemClipboard();
    }

    /**
     * Remove a file from the copied files collection
     */
    async removeCopiedFile(basePath: string): Promise<void> {
        this.repository.removeCopiedFile(basePath);
        await this.updateSystemClipboard();
    }

    /**
     * Replace all copied files with new collection
     */
    async setCopiedFiles(files: CopiedFile[]): Promise<void> {
        this.repository.setCopiedFiles(files);
        await this.updateSystemClipboard();
    }

    /**
     * Clear all copied files
     */
    async clearCopiedFiles(): Promise<void> {
        this.repository.clearCopiedFiles();
        await this.systemService.writeClipboard('');
        this.notificationService?.showInfo('Clipboard cleared');
    }

    /**
     * Copy content of a single file with specified format
     */
    async copyFileContent(
        displayPath: string,
        basePath: string,
        content: string,
        format: 'normal' | 'error' = 'normal',
        errorInfo?: ErrorInfo
    ): Promise<void> {
        const formattedContent = this.formatFileContent(displayPath, content);

        const copiedFile: CopiedFile = {
            displayPath,
            basePath,
            content: formattedContent,
            format
        };

        await this.addCopiedFile(copiedFile);

        const count = this.repository.getCopiedFiles().length;
        this.notificationService?.showInfo(`Copied ${count} file${count > 1 ? 's' : ''} to clipboard`);
    }

    /**
     * Copy content with error information included
     */
    async copyFileContentWithErrors(
        displayPath: string,
        basePath: string,
        content: string,
        errors: Array<{
            message: string;
            line: number;
            content: string;
            severity: number;
            index: number;
        }>
    ): Promise<void> {
        let formattedContent: string;

        if (errors.length > 0) {
            const errorString = errors.map(err =>
                `${err.index}. ${err.message} | ${err.line} | ${err.content}`
            ).join('\n');

            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\n${errorString}\n\`\`\``;
        } else {
            formattedContent = this.formatFileContent(displayPath, content);
        }

        const copiedFile: CopiedFile = {
            displayPath,
            basePath,
            content: formattedContent,
            format: 'error'
        };

        await this.addCopiedFile(copiedFile);

        const count = this.repository.getCopiedFiles().length;
        const errorCount = errors.length;
        this.notificationService?.showInfo(
            `Copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`
        );
    }

    // ==================== DETECTED FILES OPERATIONS ====================

    /**
     * Get currently detected files from clipboard parsing
     */
    getDetectedFiles(): DetectedFile[] {
        return this.repository.getDetectedFiles();
    }

    /**
     * Update detected files from clipboard parsing
     */
    async updateDetectedFiles(files: DetectedFile[]): Promise<void> {
        this.repository.setDetectedFiles(files);
    }

    /**
     * Clear all detected files
     */
    async clearDetectedFiles(): Promise<void> {
        this.repository.clearDetectedFiles();
    }

    // ==================== CLIPBOARD INTEGRITY ====================

    /**
     * Check clipboard integrity and clear tracked files if content was modified externally
     */
    async checkClipboardIntegrity(): Promise<boolean> {
        try {
            const clipboardText = await this.systemService.readClipboard();
            const hasSignature = clipboardText.endsWith(this.TRACKING_SIGNATURE);

            if (!hasSignature && this.repository.getCopiedFiles().length > 0) {
                // Content was modified externally, clear our tracking immediately
                this.repository.clearCopiedFiles();

                // IMPORTANT: Trigger UI update immediately
                this.notificationService?.showInfo('Clipboard modified externally - cleared file tracking');

                return false;
            }

            return hasSignature;
        } catch (error) {
            // On any error, clear the tracked files to be safe
            if (this.repository.getCopiedFiles().length > 0) {
                this.repository.clearCopiedFiles();
            }
            return false;
        }
    }

    /**
     * Verify if clipboard content contains our tracking signature
     */
    async hasTrackingSignature(): Promise<boolean> {
        try {
            const clipboardText = await this.systemService.readClipboard();
            return clipboardText.endsWith(this.TRACKING_SIGNATURE);
        } catch (error) {
            return false;
        }
    }

    // ==================== FOLDER OPERATIONS ====================

    /**
     * Copy all files from a folder to clipboard
     */
    async copyFolderContents(folderFiles: string[]): Promise<void> {
        // This method would need additional dependencies to read file contents
        // For now, it's a placeholder that shows the pattern
        throw new Error('copyFolderContents requires additional file system dependencies');
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Format file content for clipboard
     */
    private formatFileContent(displayPath: string, content: string): string {
        return `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
    }

    /**
     * Update system clipboard with current copied files
     */
    private async updateSystemClipboard(): Promise<void> {
        const copiedFiles = this.repository.getCopiedFiles();

        if (copiedFiles.length === 0) {
            await this.systemService.writeClipboard('');
            return;
        }

        const combined = copiedFiles
            .map(f => f.content)
            .join('\n\n---\n\n');

        const finalContent = combined + '\n' + this.TRACKING_SIGNATURE;
        await this.systemService.writeClipboard(finalContent);
    }

    /**
     * Get the tracking signature used to identify extension content
     */
    getTrackingSignature(): string {
        return this.TRACKING_SIGNATURE;
    }

    /**
     * Get statistics about current clipboard state
     */
    getClipboardStats(): {
        copiedFiles: number;
        detectedFiles: number;
    } {
        return {
            copiedFiles: this.repository.getCopiedFiles().length,
            detectedFiles: this.repository.getDetectedFiles().length,
        };
    }

    /**
     * Check if there are any files copied (used for UI state)
     */
    hasCopiedFiles(): boolean {
        return this.repository.getCopiedFiles().length > 0;
    }
}