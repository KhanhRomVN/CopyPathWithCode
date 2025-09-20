/**
 * FILE: src/utils/clipboardUtils.ts
 * 
 * CLIPBOARD UTILITIES - TIỆN ÍCH XỬ LÝ CLIPBOARD
 * TEMP CLIPBOARD FUNCTIONALITY REMOVED
 * 
 * Các hàm tiện ích liên quan đến xử lý clipboard và nội dung copy.
 * 
 * Chức năng chính:
 * - copyPathWithContent: Copy đường dẫn file kèm nội dung
 * - copyPathWithContentAndError: Copy kèm thông tin lỗi
 * - clearClipboard: Xóa clipboard
 * - copyFolderContents: Copy toàn bộ nội dung thư mục
 * - checkClipboardIntegrity: Kiểm tra tính toàn vẹn của clipboard
 * - Quản lý tracking signature để nhận diện content của extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder, CopiedFile, ErrorInfo } from '../../models/models';
import { Logger } from '../common/logger';

// Signature for tracking extension content
const TRACKING_SIGNATURE = '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';

export async function copyPathWithContent() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            Logger.warn('No active text editor found');
            return;
        }

        const document = editor.document;
        const filePath = document.uri.fsPath;
        Logger.debug(`Copying content from: ${filePath}`);

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
            Logger.debug(`Using workspace relative path: ${displayPath}`);
        }

        let content: string;
        const sel = editor.selection;
        if (!sel.isEmpty) {
            content = document.getText(sel);
            const startLine = sel.start.line + 1;
            const endLine = sel.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
            Logger.debug(`Copying selection from line ${startLine} to ${endLine}`);
        } else {
            content = document.getText();
            Logger.debug('Copying entire file content');
        }

        // Format content for normal copy
        const formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;

        // Remove any existing file with same basePath (regardless of format)
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        const afterCount = state.copiedFiles.length;

        if (beforeCount !== afterCount) {
            Logger.debug(`Removed existing file entry for ${basePath}`);
        }

        state.copiedFiles.push({
            displayPath,
            basePath,
            content: formattedContent,
            format: 'normal'
        });

        await updateClipboardWithSignature();

        const count = state.copiedFiles.length;
        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} to clipboard`);
        vscode.window.showInformationMessage(`Copied ${count} file${count > 1 ? 's' : ''} to clipboard`);

        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to copy content', err);
        vscode.window.showErrorMessage(`Failed to copy: ${msg}`);
    }
}

export async function copyPathWithContentAndError() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            Logger.warn('No active text editor found for error copy');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const filePath = document.uri.fsPath;
        Logger.debug(`Copying content with error info from: ${filePath}`);

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
            Logger.debug(`Using workspace relative path: ${displayPath}`);
        }

        let content: string;
        if (!selection.isEmpty) {
            content = document.getText(selection);
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
            Logger.debug(`Copying selection from line ${startLine} to ${endLine}`);
        } else {
            content = document.getText();
            Logger.debug('Copying entire file content');
        }

        // Get errors and warnings from Problems panel for this document
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errors: ErrorInfo[] = [];
        let errorCounter = 1;

        Logger.debug(`Found ${diagnostics.length} diagnostics for document`);

        diagnostics.forEach(diagnostic => {
            if (diagnostic.severity <= 1) {
                if (selection.isEmpty || diagnostic.range.intersection(selection)) {
                    const line = diagnostic.range.start.line;
                    errors.push({
                        message: diagnostic.message,
                        line: line + 1,
                        content: document.lineAt(line).text.trim(),
                        severity: diagnostic.severity,
                        index: errorCounter++
                    });
                }
            }
        });

        Logger.debug(`Processed ${errors.length} errors/warnings for inclusion`);

        let formattedContent: string;
        if (errors.length > 0) {
            const errorString = errors.map(err =>
                `${err.index}. ${err.message} | ${err.line} | ${err.content}`
            ).join('\n');

            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\n${errorString}\n\`\`\``;
        } else {
            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
        }

        // Remove any existing file with same basePath (regardless of format)
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        const afterCount = state.copiedFiles.length;

        if (beforeCount !== afterCount) {
            Logger.debug(`Removed existing file entry for ${basePath}`);
        }

        state.copiedFiles.push({
            displayPath,
            basePath,
            content: formattedContent,
            format: 'error'
        });

        await updateClipboardWithSignature();

        const count = state.copiedFiles.length;
        const errorCount = errors.length;

        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`);
        vscode.window.showInformationMessage(
            `Copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`
        );

        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to copy with error info', err);
        vscode.window.showErrorMessage(`Failed to copy with error info: ${msg}`);
    }
}

async function updateClipboardWithSignature() {
    const combined = state.copiedFiles
        .map(f => f.content)
        .join('\n\n---\n\n');

    const finalContent = combined + '\n' + TRACKING_SIGNATURE;
    await vscode.env.clipboard.writeText(finalContent);
}

function updateStatusBar() {
    if (state.statusBarItem) {
        const count = state.copiedFiles.length;
        if (count > 0) {
            state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''} copied`;
            state.statusBarItem.show();
        } else {
            state.statusBarItem.hide();
        }
    }
}

export async function clearClipboard() {
    try {
        const beforeCount = state.copiedFiles.length;
        Logger.debug(`Clearing clipboard with ${beforeCount} files`);

        state.copiedFiles.length = 0;
        // Also clear clipboard detection
        state.clipboardFiles = [];

        await vscode.env.clipboard.writeText('');
        Logger.info('Successfully cleared clipboard');
        vscode.window.showInformationMessage('Clipboard cleared');

        if (state.statusBarItem) {
            state.statusBarItem.hide();
            Logger.debug('Status bar hidden after clear');
        }

        // Refresh the clipboard view
        Logger.debug('Refreshing clipboard view');
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to clear clipboard', err);
        vscode.window.showErrorMessage(`Failed to clear clipboard: ${msg}`);
    }
}

export async function copyFolderContents(folder: Folder) {
    Logger.debug(`Starting to copy folder contents: ${folder.name} with ${folder.files.length} files`);

    const toCopy: CopiedFile[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const uriStr of folder.files) {
        try {
            const uri = vscode.Uri.parse(uriStr);
            const doc = await vscode.workspace.openTextDocument(uri);
            const displayPath = vscode.workspace.asRelativePath(uri);

            toCopy.push({
                displayPath,
                basePath: displayPath,
                content: `${displayPath}:\n\`\`\`\n${doc.getText()}\n\`\`\``,
                format: 'normal'
            });

            successCount++;
            Logger.debug(`Successfully processed file: ${displayPath}`);
        } catch (e) {
            failureCount++;
            Logger.error(`Failed to read file: ${uriStr}`, e);
        }
    }

    Logger.debug(`Processed ${successCount} files successfully, ${failureCount} failures`);

    if (!toCopy.length) {
        Logger.warn(`No files to copy in folder: ${folder.name}`);
        vscode.window.showWarningMessage('No files to copy in this folder');
        return;
    }

    try {
        // Replace current copied files with folder contents
        state.copiedFiles = toCopy;
        await updateClipboardWithSignature();

        Logger.info(`Successfully copied ${toCopy.length} files from folder "${folder.name}"`);
        vscode.window.showInformationMessage(`Copied ${toCopy.length} files from "${folder.name}"`);

        updateStatusBar();
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error(`Failed to copy folder contents for "${folder.name}"`, err);
        vscode.window.showErrorMessage(`Failed to copy folder contents: ${msg}`);
    }
}

// Function to check if clipboard content has our signature
export async function checkClipboardIntegrity(): Promise<boolean> {
    try {
        const clipboardText = await vscode.env.clipboard.readText();
        const hasSignature = clipboardText.endsWith(TRACKING_SIGNATURE);

        if (!hasSignature && state.copiedFiles.length > 0) {
            // Content was modified externally, clear our tracking
            Logger.info('Clipboard content modified externally, clearing file tracking');
            state.copiedFiles = [];
            updateStatusBar();
            return false;
        }

        return hasSignature;
    } catch (error) {
        Logger.error('Failed to check clipboard integrity', error);
        return false;
    }
}

export { TRACKING_SIGNATURE };