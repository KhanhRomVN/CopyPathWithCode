/**
 * FILE: src/infrastructure/clipboard/storage/ClipboardStorage.ts
 * 
 * CLIPBOARD STORAGE - INFRASTRUCTURE IMPLEMENTATION
 * TEMP CLIPBOARD FUNCTIONALITY REMOVED
 * 
 * Complete implementation bridging clean architecture with legacy state system
 */

import { IClipboardRepository } from '../../../domain/clipboard/services/ClipboardService';
import { CopiedFile } from '../../../domain/clipboard/entities/CopiedFile';
import { DetectedFile } from '../../../domain/clipboard/entities/DetectedFile';
// TempClipboardFile removed - no longer needed

export class ClipboardStorage implements IClipboardRepository {

    // ==================== COPIED FILES OPERATIONS ====================

    getCopiedFiles(): CopiedFile[] {
        const { state } = require('../../../models/models');
        return [...state.copiedFiles]; // Return copy to prevent direct mutation
    }

    setCopiedFiles(files: CopiedFile[]): void {
        const { state } = require('../../../models/models');
        state.copiedFiles = [...files]; // Store copy to prevent external mutation
    }

    addCopiedFile(file: CopiedFile): void {
        const { state } = require('../../../models/models');

        // Remove any existing file with same basePath first
        state.copiedFiles = state.copiedFiles.filter((f: { basePath: string; }) => f.basePath !== file.basePath);

        // Add the new file
        state.copiedFiles.push({ ...file }); // Store copy
    }

    removeCopiedFile(basePath: string): void {
        const { state } = require('../../../models/models');
        state.copiedFiles = state.copiedFiles.filter((f: { basePath: string; }) => f.basePath !== basePath);
    }

    clearCopiedFiles(): void {
        const { state } = require('../../../models/models');
        state.copiedFiles = [];
    }

    // ==================== DETECTED FILES OPERATIONS ====================

    getDetectedFiles(): DetectedFile[] {
        const { state } = require('../../../models/models');

        // Convert ClipboardFile to DetectedFile format
        return state.clipboardFiles.map((clipboardFile: any) => ({
            filePath: clipboardFile.filePath,
            content: clipboardFile.content,
            detectedAt: clipboardFile.detectedAt
        }));
    }

    setDetectedFiles(files: DetectedFile[]): void {
        const { state } = require('../../../models/models');

        // Convert DetectedFile to ClipboardFile format for legacy compatibility
        state.clipboardFiles = files.map(file => ({
            filePath: file.filePath,
            content: file.content,
            detectedAt: file.detectedAt
        }));
    }

    clearDetectedFiles(): void {
        const { state } = require('../../../models/models');
        state.clipboardFiles = [];
    }

    // ==================== TEMP STORAGE OPERATIONS - REMOVED ====================
    // All temp storage methods have been removed as the functionality is no longer needed:
    // - getTempFiles()
    // - setTempFiles() 
    // - clearTempFiles()
}