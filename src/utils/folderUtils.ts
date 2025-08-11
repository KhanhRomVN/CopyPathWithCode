import * as vscode from 'vscode';
import { state, Folder } from '../models/models';

export function loadFolders(context: vscode.ExtensionContext) {
    const stored = context.globalState.get<Folder[]>('folders');
    if (stored) {
        // Giữ nguyên reference mảng để các module khác vẫn trỏ đúng
        state.folders.splice(0, state.folders.length, ...stored);
    }
}

export function saveFolders(context: vscode.ExtensionContext) {
    context.globalState.update('folders', state.folders);
}

export function getFolderById(id: string): Folder | undefined {
    return state.folders.find(f => f.id === id);
}

export function addFileToFolder(folderId: string, fileUri: string) {
    const folder = getFolderById(folderId);
    if (folder && !folder.files.includes(fileUri)) {
        folder.files.push(fileUri);
        return true;
    }
    return false;
}

export function removeFileFromFolder(folderId: string, fileUri: string) {
    const folder = getFolderById(folderId);
    if (folder) {
        const index = folder.files.indexOf(fileUri);
        if (index !== -1) {
            folder.files.splice(index, 1);
            return true;
        }
    }
    return false;
}
