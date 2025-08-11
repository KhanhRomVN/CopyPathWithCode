import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder, CopiedFile } from '../models/models';

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
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        vscode.window.showErrorMessage(`Failed to copy: ${msg}`);
        console.error('Error:', err);
    }
}

export async function clearClipboard() {
    try {
        state.copiedFiles.length = 0; // Clear giữ nguyên reference
        await vscode.env.clipboard.writeText('');
        vscode.window.showInformationMessage('Clipboard cleared');
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
}
