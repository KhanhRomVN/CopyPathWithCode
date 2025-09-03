import * as vscode from 'vscode';

export interface CopiedFile {
    displayPath: string;
    basePath: string;
    content: string;
}

export interface Folder {
    id: string;
    name: string;
    files: string[]; // Array of file URIs
    color?: string;  // Tab highlight color
}

// State object
export const state = {
    copiedFiles: [] as CopiedFile[],
    folders: [] as Folder[],
    statusBarItem: undefined as vscode.StatusBarItem | undefined,
};

export interface ErrorInfo {
    message: string;
    line: number;
    content: string;
    severity: number; // 0=Error, 1=Warning
    index: number;    // For proper numbering
}