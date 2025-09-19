import { CopiedFileEntity } from '../entities/CopiedFile';
import { ClipboardFileEntity } from '../entities/ClipboardFile';

export interface IClipboardRepository {
    getCopiedFiles(): CopiedFileEntity[];
    setCopiedFiles(files: CopiedFileEntity[]): void;
    getDetectedFiles(): ClipboardFileEntity[];
    setDetectedFiles(files: ClipboardFileEntity[]): void;
    getTempFiles(): CopiedFileEntity[];
    setTempFiles(files: CopiedFileEntity[]): void;
    clear(): void;
}

export interface IClipboardSystemService {
    writeText(text: string): Promise<void>;
    readText(): Promise<string>;
}

export class ClipboardService {
    constructor(
        private readonly repository: IClipboardRepository,
        private readonly systemService: IClipboardSystemService
    ) { }

    addCopiedFile(file: CopiedFileEntity): void {
        const files = this.repository.getCopiedFiles();

        // Remove existing file with same base path
        const filteredFiles = files.filter(f => f.basePath !== file.basePath);

        // Add new file
        filteredFiles.push(file);
        this.repository.setCopiedFiles(filteredFiles);
    }

    removeCopiedFile(basePath: string): boolean {
        const files = this.repository.getCopiedFiles();
        const filteredFiles = files.filter(f => f.basePath !== basePath);

        if (filteredFiles.length !== files.length) {
            this.repository.setCopiedFiles(filteredFiles);
            return true;
        }
        return false;
    }

    getCopiedFiles(): CopiedFileEntity[] {
        return this.repository.getCopiedFiles();
    }

    clearCopiedFiles(): void {
        this.repository.setCopiedFiles([]);
    }

    addDetectedFile(file: ClipboardFileEntity): void {
        const files = this.repository.getDetectedFiles();

        // Remove existing file with same path
        const filteredFiles = files.filter(f => f.filePath !== file.filePath);

        // Add new file
        filteredFiles.push(file);
        this.repository.setDetectedFiles(filteredFiles);
    }

    getDetectedFiles(): ClipboardFileEntity[] {
        return this.repository.getDetectedFiles();
    }

    clearDetectedFiles(): void {
        this.repository.setDetectedFiles([]);
    }

    saveToTemp(): boolean {
        const copiedFiles = this.repository.getCopiedFiles();
        if (copiedFiles.length === 0) {
            return false;
        }

        this.repository.setTempFiles([...copiedFiles]);
        this.repository.setCopiedFiles([]);
        return true;
    }

    restoreFromTemp(): boolean {
        const tempFiles = this.repository.getTempFiles();
        if (tempFiles.length === 0) {
            return false;
        }

        this.repository.setCopiedFiles([...tempFiles]);
        return true;
    }

    getTempFiles(): CopiedFileEntity[] {
        return this.repository.getTempFiles();
    }

    async updateSystemClipboard(): Promise<void> {
        const files = this.repository.getCopiedFiles();
        const combined = files
            .map(f => f.content)
            .join('\n\n---\n\n');

        const finalContent = combined + '\n' + this.getTrackingSignature();
        await this.systemService.writeText(finalContent);
    }

    async checkClipboardIntegrity(): Promise<boolean> {
        try {
            const clipboardText = await this.systemService.readText();
            const hasSignature = clipboardText.endsWith(this.getTrackingSignature());

            if (!hasSignature && this.repository.getCopiedFiles().length > 0) {
                this.repository.setCopiedFiles([]);
                return false;
            }

            return hasSignature;
        } catch (error) {
            return false;
        }
    }

    private getTrackingSignature(): string {
        return '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';
    }
}