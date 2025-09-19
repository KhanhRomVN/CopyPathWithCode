export interface CopiedFile {
    displayPath: string;
    basePath: string;
    content: string;
    format: 'normal' | 'error';
}

export class CopiedFileEntity {
    constructor(
        public readonly displayPath: string,
        public readonly basePath: string,
        public readonly content: string,
        public readonly format: 'normal' | 'error' = 'normal'
    ) { }

    static create(
        displayPath: string,
        basePath: string,
        content: string,
        format: 'normal' | 'error' = 'normal'
    ): CopiedFileEntity {
        return new CopiedFileEntity(displayPath, basePath, content, format);
    }

    equals(other: CopiedFileEntity): boolean {
        return this.basePath === other.basePath;
    }

    getFileName(): string {
        return this.displayPath.split('/').pop() || this.displayPath;
    }
}