/**
 * FILE: src/providers/ClipboardProvider.ts
 * 
 * CLIPBOARD TREE DATA PROVIDER - PROVIDER HIỂN THỊ CLIPBOARD
 * 
 * Provider chịu trách nhiệm hiển thị danh sách file đã detect từ clipboard.
 * 
 * Chức năng chính:
 * - Hiển thị các file đã được phát hiện trong clipboard
 * - Hiển thị thông tin chi tiết về file (đường dẫn, thời gian detect)
 * - Cho phép mở preview của file từ clipboard
 * - Xử lý trường hợp không có file nào trong clipboard
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../models/models';

export class ClipboardProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Root level - show detected files
            return Promise.resolve(this.getClipboardFiles());
        }
        return Promise.resolve([]);
    }

    private getClipboardFiles(): vscode.TreeItem[] {
        if (state.clipboardFiles.length === 0) {
            const item = new vscode.TreeItem('No files detected in clipboard');
            item.description = 'Copy files using the extension to see them here';
            return [item];
        }

        return state.clipboardFiles.map(file => {
            const fileName = path.basename(file.filePath);
            const item = new vscode.TreeItem(fileName, vscode.TreeItemCollapsibleState.None);

            item.description = file.filePath;
            item.tooltip = `Detected at: ${new Date(file.detectedAt).toLocaleTimeString()}`;
            item.command = {
                command: 'copy-path-with-code.openClipboardFile',
                title: 'Open File Preview',
                arguments: [file]
            };

            item.contextValue = 'clipboardFile';
            item.iconPath = vscode.ThemeIcon.File;

            return item;
        });
    }
}