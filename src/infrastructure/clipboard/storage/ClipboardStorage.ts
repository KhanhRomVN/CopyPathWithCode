import { IClipboardRepository } from '../../../domain/clipboard/services/ClipboardService';
import { CopiedFileEntity } from '../../../domain/clipboard/entities/CopiedFile';
import { ClipboardFileEntity } from '../../../domain/clipboard/entities/ClipboardFile';
import { state } from '../../../models/models';

export class ClipboardStorage implements IClipboardRepository {
    getCopiedFiles(): CopiedFileEntity[] {
        return state.copiedFiles.map(f =>
            new CopiedFileEntity(f.displayPath, f.basePath, f.content, f.format)
        );
    }

    setCopiedFiles(files: CopiedFileEntity[]): void {
        state.copiedFiles = files.map(f => ({
            displayPath: f.displayPath,
            basePath: f.basePath,
            content: f.content,
            format: f.format
        }));
    }

    getDetectedFiles(): ClipboardFileEntity[] {
        return state.clipboardFiles.map(f =>
            new ClipboardFileEntity(f.filePath, f.content, f.detectedAt)
        );
    }

    setDetectedFiles(files: ClipboardFileEntity[]): void {
        state.clipboardFiles = files.map(f => ({
            filePath: f.filePath,
            content: f.content,
            detectedAt: f.detectedAt
        }));
    }

    getTempFiles(): CopiedFileEntity[] {
        return state.tempClipboard.map(f =>
            new CopiedFileEntity(f.displayPath, f.basePath, f.content, f.format)
        );
    }

    setTempFiles(files: CopiedFileEntity[]): void {
        state.tempClipboard = files.map(f => ({
            displayPath: f.displayPath,
            basePath: f.basePath,
            content: f.content,
            format: f.format
        }));
    }

    clear(): void {
        state.copiedFiles = [];
        state.clipboardFiles = [];
        state.tempClipboard = [];
    }
}