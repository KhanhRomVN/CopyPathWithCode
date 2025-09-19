export interface TempClipboardFile {
    displayPath: string;
    basePath: string;
    content: string;
    format: 'normal' | 'error';
    savedAt: number;
}