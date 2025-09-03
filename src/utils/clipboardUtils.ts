import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder, CopiedFile } from '../models/models';

export interface ErrorInfo {
    message: string;
    line: number;
    content: string;
}

export async function copyPathWithContent() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        const filePath = document.uri.fsPath;

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
        }

        let content: string;
        const sel = editor.selection;
        if (!sel.isEmpty) {
            content = document.getText(sel);
            const startLine = sel.start.line + 1;
            const endLine = sel.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
        } else {
            content = document.getText();
        }

        // Xóa file cũ có cùng basePath
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        state.copiedFiles.push({ displayPath, basePath, content });

        const combined = state.copiedFiles
            .map(f => `${f.displayPath}\n\n${f.content}`)
            .join('\n\n---\n\n');

        await vscode.env.clipboard.writeText(combined);
        const count = state.copiedFiles.length;
        vscode.window.showInformationMessage(`Copied ${count} file${count > 1 ? 's' : ''} to clipboard`);
        if (state.statusBarItem) {
            state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''} copied`;
            state.statusBarItem.show();
        }
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to copy: ${msg}`);
        console.error('Error:', err);
    }
}

export function parseErrorFromContent(content: string): ErrorInfo | null {
    // Pattern để phát hiện error format: "1. <error_message> | <error_line> | <error_content_line>"
    const errorPattern = /^1\.\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(.+)$/m;
    const match = content.match(errorPattern);

    if (match) {
        return {
            message: match[1].trim(),
            line: parseInt(match[2], 10),
            content: match[3].trim()
        };
    }

    return null;
}

export async function copyPathWithContentAndError() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const filePath = document.uri.fsPath;

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
        }

        let content: string;
        const sel = editor.selection;
        if (!sel.isEmpty) {
            content = document.getText(sel);
            const startLine = sel.start.line + 1;
            const endLine = sel.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
        } else {
            content = document.getText();
        }

        // Parse error information từ content
        const errorInfo = parseErrorFromContent(content);

        let formattedContent: string;
        if (errorInfo) {
            // Format với error information
            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\`\n1. ${errorInfo.message} | ${errorInfo.line} | ${errorInfo.content}`;
        } else {
            // Format thông thường nếu không tìm thấy error
            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
        }

        // Xóa file cũ có cùng basePath
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        state.copiedFiles.push({ displayPath, basePath, content: formattedContent });

        const combined = state.copiedFiles
            .map(f => f.content)
            .join('\n\n---\n\n');

        await vscode.env.clipboard.writeText(combined);
        const count = state.copiedFiles.length;
        vscode.window.showInformationMessage(`Copied ${count} file${count > 1 ? 's' : ''} with error info to clipboard`);

        if (state.statusBarItem) {
            state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''} copied (with error)`;
            state.statusBarItem.show();
        }
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to copy with error info: ${msg}`);
        console.error('Error:', err);
    }
}

export async function clearClipboard() {
    try {
        state.copiedFiles.length = 0; // Clear giữ nguyên reference
        await vscode.env.clipboard.writeText('');
        vscode.window.showInformationMessage('Clipboard cleared');
        if (state.statusBarItem) {
            state.statusBarItem.hide();
        }
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to clear clipboard: ${msg}`);
        console.error('Error:', err);
    }
}

export async function copyFolderContents(folder: Folder) {
    const toCopy: CopiedFile[] = [];
    for (const uriStr of folder.files) {
        try {
            const uri = vscode.Uri.parse(uriStr);
            const doc = await vscode.workspace.openTextDocument(uri);
            toCopy.push({
                displayPath: vscode.workspace.asRelativePath(uri),
                basePath: vscode.workspace.asRelativePath(uri),
                content: doc.getText()
            });
        } catch (e) {
            console.error(`Failed to read ${uriStr}:`, e);
        }
    }
    if (!toCopy.length) {
        vscode.window.showWarningMessage('No files to copy in this folder');
        return;
    }
    const combined = toCopy.map(f => `${f.displayPath}\n\n${f.content}`).join('\n\n---\n\n');
    await vscode.env.clipboard.writeText(combined);
    vscode.window.showInformationMessage(`Copied ${toCopy.length} files from "${folder.name}"`);
    if (state.statusBarItem) {
        state.statusBarItem.text = `$(clippy) ${toCopy.length} file${toCopy.length > 1 ? 's' : ''} copied`;
        state.statusBarItem.show();
    }
}
