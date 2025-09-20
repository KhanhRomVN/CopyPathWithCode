import * as vscode from 'vscode';

export interface CopiedFile {
    displayPath: string;
    basePath: string;
    content: string;
    format: 'normal' | 'error';
}

export interface TempClipboardFile {
    displayPath: string;
    basePath: string;
    content: string;
    format: 'normal' | 'error';
    workspaceId: string;
    savedAt: number;
}

export interface Folder {
    id: string;
    name: string;
    files: string[];
    color?: string;
    workspaceFolder?: string; // Store which workspace this folder was created in
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
    clipboardFiles: [] as ClipboardFile[],
    isClipboardDetectionEnabled: true,
    // Temporary storage is now handled by the infrastructure layer
    // but we keep track of temp storage availability
    tempStorageEnabled: true,
};

export interface ClipboardFile {
    filePath: string;
    content: string;
    detectedAt: number;
}