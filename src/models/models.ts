import * as vscode from 'vscode';

export interface CopiedFile {
    displayPath: string;
    basePath: string;
    content: string;
    format: 'normal' | 'error';
}

export interface Folder {
    id: string;
    name: string;
    files: string[];
    color?: string;
}

export interface ErrorInfo {
    message: string;
    line: number;
    content: string;
    severity: number;
    index: number;
}

export const state = {
    copiedFiles: [] as CopiedFile[],
    folders: [] as Folder[],
    statusBarItem: undefined as vscode.StatusBarItem | undefined,
};