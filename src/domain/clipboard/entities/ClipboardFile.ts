export interface ClipboardFile {
    filePath: string;
    content: string;
    detectedAt: number;
    format: 'normal' | 'error';
    displayPath: string;
    basePath: string;
}

export class ClipboardFileEntity {
    constructor(
        public readonly filePath: string,
        public readonly content: string,
        public readonly detectedAt: number,
        public readonly format: 'normal' | 'error' = 'normal',
        public readonly displayPath?: string,
        public readonly basePath?: string
    ) { }

    static create(
        filePath: string,
        content: string,
        format: 'normal' | 'error' = 'normal'
    ): ClipboardFileEntity {
        return new ClipboardFileEntity(
            filePath,
            content,
            Date.now(),
            format,
            filePath,
            filePath
        );
    }

    isValid(): boolean {
        return this.filePath.trim().length > 0 &&
            this.content.trim().length > 0;
    }

    getFileName(): string {
        return this.filePath.split('/').pop() || this.filePath;
    }
}