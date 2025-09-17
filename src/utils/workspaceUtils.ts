/**
 * FILE: src/utils/workspaceUtils.ts
 * 
 * WORKSPACE UTILITIES - TIỆN ÍCH XỬ LÝ WORKSPACE
 * 
 * Các hàm tiện ích liên quan đến xử lý workspace trong VS Code.
 * 
 * Chức năng chính:
 * - getCurrentWorkspaceFolder: Lấy đường dẫn workspace hiện tại
 * - hasActiveWorkspace: Kiểm tra có workspace active không
 * - isFolderFromCurrentWorkspace: Kiểm tra thư mục có từ workspace hiện tại không
 * - getFoldersForCurrentWorkspace: Lấy danh sách thư mục của workspace hiện tại
 * - getAllWorkspaceFolders: Lấy tất cả thư mục từ tất cả workspace
 * - getWorkspaceDisplayName: Lấy tên hiển thị của workspace
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder } from '../models/models';

export function getCurrentWorkspaceFolder(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath;
}

export function hasActiveWorkspace(): boolean {
    return vscode.workspace.workspaceFolders !== undefined &&
        vscode.workspace.workspaceFolders.length > 0;
}

export function isFolderFromCurrentWorkspace(folder: Folder): boolean {
    const currentWorkspace = getCurrentWorkspaceFolder();

    if (!currentWorkspace) {
        return !folder.workspaceFolder; // If no workspace, only legacy folders are "current"
    }

    if (!folder.workspaceFolder) {
        return true; // Legacy folders without workspace info are considered current
    }

    return folder.workspaceFolder === currentWorkspace;
}

export function getFoldersForCurrentWorkspace(): Folder[] {
    return state.folders.filter(folder => isFolderFromCurrentWorkspace(folder));
}

export function getAllWorkspaceFolders(): { workspace: string | null, folders: Folder[] }[] {
    const workspaceMap = new Map<string | null, Folder[]>();

    for (const folder of state.folders) {
        const key = folder.workspaceFolder || null;
        if (!workspaceMap.has(key)) {
            workspaceMap.set(key, []);
        }
        workspaceMap.get(key)!.push(folder);
    }

    return Array.from(workspaceMap.entries()).map(([workspace, folders]) => ({
        workspace,
        folders
    }));
}

export function getWorkspaceDisplayName(workspacePath: string | null): string {
    if (!workspacePath) {
        return 'Legacy Folders';
    }
    return path.basename(workspacePath);
}