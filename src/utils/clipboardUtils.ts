import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder, CopiedFile, ErrorInfo } from '../models/models';

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

        // Format content for normal copy
        const formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;

        // Remove any existing file with same basePath and format
        state.copiedFiles = state.copiedFiles.filter(f =>
            !(f.basePath === basePath && f.format === 'normal')
        );

        state.copiedFiles.push({
            displayPath,
            basePath,
            content: formattedContent,
            format: 'normal'
        });

        const combined = state.copiedFiles
            .map(f => f.content)
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

export async function copyPathWithContentAndError() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const filePath = document.uri.fsPath;

        let displayPath = filePath;
        let basePath = filePath;
        if (vscode.workspace.workspaceFolders) {
            const ws = vscode.workspace.workspaceFolders[0];
            displayPath = path.relative(ws.uri.fsPath, filePath);
            basePath = displayPath;
        }

        let content: string;
        if (!selection.isEmpty) {
            content = document.getText(selection);
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            displayPath = `${displayPath}:${startLine}-${endLine}`;
        } else {
            content = document.getText();
        }

        // Get errors and warnings from Problems panel for this document
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errors: ErrorInfo[] = [];
        let errorCounter = 1; // Counter for proper numbering

        diagnostics.forEach(diagnostic => {
            // Only include errors (red) and warnings (yellow)
            // Severity: 0=Error, 1=Warning, 2=Information, 3=Hint
            if (diagnostic.severity <= 1) {
                // Check if diagnostic is within selection or applies to entire file
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

        let formattedContent: string;
        if (errors.length > 0) {
            // Format with error information - use proper numbering
            const errorString = errors.map(err =>
                `${err.index}. ${err.message} | ${err.line} | ${err.content}`
            ).join('\n');

            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\`\n${errorString}`;
        } else {
            // Regular format if no errors found
            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
        }

        // Remove any existing file with same basePath and format
        state.copiedFiles = state.copiedFiles.filter(f =>
            !(f.basePath === basePath && f.format === 'error')
        );

        state.copiedFiles.push({
            displayPath,
            basePath,
            content: formattedContent,
            format: 'error'
        });

        const combined = state.copiedFiles
            .map(f => f.content)
            .join('\n\n---\n\n');

        await vscode.env.clipboard.writeText(combined);
        const count = state.copiedFiles.length;
        const errorCount = errors.length;

        vscode.window.showInformationMessage(
            `Copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`
        );

        if (state.statusBarItem) {
            state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''} (${errorCount} error${errorCount !== 1 ? 's' : ''})`;
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
            const displayPath = vscode.workspace.asRelativePath(uri);

            toCopy.push({
                displayPath,
                basePath: displayPath,
                content: `${displayPath}:\n\`\`\`\n${doc.getText()}\n\`\`\``,
                format: 'normal'
            });
        } catch (e) {
            console.error(`Failed to read ${uriStr}:`, e);
        }
    }

    if (!toCopy.length) {
        vscode.window.showWarningMessage('No files to copy in this folder');
        return;
    }

    const combined = toCopy.map(f => f.content).join('\n\n---\n\n');
    await vscode.env.clipboard.writeText(combined);
    vscode.window.showInformationMessage(`Copied ${toCopy.length} files from "${folder.name}"`);

    if (state.statusBarItem) {
        state.statusBarItem.text = `$(clippy) ${toCopy.length} file${toCopy.length > 1 ? 's' : ''} copied`;
        state.statusBarItem.show();
    }
}