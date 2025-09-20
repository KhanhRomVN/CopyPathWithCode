/**
 * FILE: src/infrastructure/clipboard/storage/TempStorage.ts
 * 
 * TEMPORARY STORAGE INFRASTRUCTURE
 * 
 * File-based storage for workspace-specific temporary clipboard data.
 * Each workspace maintains its own temporary storage that persists across VS Code sessions.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ITempStorageRepository } from '../../../domain/clipboard/services/TempStorageService';
import { TempClipboardFile } from '../../../domain/clipboard/entities/TempClipboardFile';

export class TempStorage implements ITempStorageRepository {
    private readonly STORAGE_FILE_NAME = 'temp-clipboard.json';

    constructor(private context: vscode.ExtensionContext) { }

    getTempFiles(workspaceId: string): TempClipboardFile[] {
        try {
            const filePath = this.getTempStorageFilePath(workspaceId);

            if (!fs.existsSync(filePath)) {
                return [];
            }

            const data = fs.readFileSync(filePath, 'utf8');
            const tempData = JSON.parse(data);

            // Return files for this workspace only
            return (tempData.files || []).filter((file: TempClipboardFile) =>
                file.workspaceId === workspaceId
            );
        } catch (error) {
            console.error('Failed to read temp storage:', error);
            return [];
        }
    }

    setTempFiles(workspaceId: string, files: TempClipboardFile[]): void {
        try {
            const filePath = this.getTempStorageFilePath(workspaceId);

            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Read existing data to preserve other workspaces
            let allData: { files: TempClipboardFile[] } = { files: [] };
            if (fs.existsSync(filePath)) {
                try {
                    const existingData = fs.readFileSync(filePath, 'utf8');
                    allData = JSON.parse(existingData);
                } catch {
                    // If file is corrupted, start fresh
                    allData = { files: [] };
                }
            }

            // Remove existing files for this workspace
            allData.files = allData.files.filter(file => file.workspaceId !== workspaceId);

            // Add new files for this workspace
            allData.files.push(...files);

            // Write back to file
            fs.writeFileSync(filePath, JSON.stringify(allData, null, 2), 'utf8');
        } catch (error) {
            console.error('Failed to write temp storage:', error);
        }
    }

    addTempFile(file: TempClipboardFile): void {
        const existingFiles = this.getTempFiles(file.workspaceId);

        // Remove existing file with same basePath
        const filteredFiles = existingFiles.filter(f => f.basePath !== file.basePath);
        filteredFiles.push(file);

        this.setTempFiles(file.workspaceId, filteredFiles);
    }

    clearTempFiles(workspaceId: string): void {
        this.setTempFiles(workspaceId, []);
    }

    getCurrentWorkspaceId(): string {
        // Generate unique ID for current workspace
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            return this.generateWorkspaceId(workspaceFolder.uri.fsPath);
        }

        // Fallback for when no workspace is open
        return 'no-workspace-' + Date.now();
    }

    private generateWorkspaceId(workspacePath: string): string {
        // Create a simple hash of the workspace path
        let hash = 0;
        for (let i = 0; i < workspacePath.length; i++) {
            const char = workspacePath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return 'workspace-' + Math.abs(hash).toString(36);
    }

    private getTempStorageFilePath(workspaceId: string): string {
        return path.join(this.context.globalStorageUri.fsPath, this.STORAGE_FILE_NAME);
    }

    // Cleanup method for maintenance
    cleanupOldTempFiles(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
        try {
            const filePath = this.getTempStorageFilePath('');

            if (!fs.existsSync(filePath)) {
                return;
            }

            const data = fs.readFileSync(filePath, 'utf8');
            const tempData = JSON.parse(data);
            const now = Date.now();

            // Remove files older than maxAge
            const validFiles = (tempData.files || []).filter((file: TempClipboardFile) =>
                (now - file.savedAt) < maxAge
            );

            // Update file if any files were removed
            if (validFiles.length < (tempData.files || []).length) {
                fs.writeFileSync(filePath, JSON.stringify({ files: validFiles }, null, 2), 'utf8');
            }
        } catch (error) {
            console.error('Failed to cleanup old temp files:', error);
        }
    }
}