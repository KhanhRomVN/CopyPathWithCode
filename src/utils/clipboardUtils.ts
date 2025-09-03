import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder, CopiedFile, ErrorInfo } from '../models/models';
import { Logger } from './logger';

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

        // Remove any existing file with same basePath and format
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f =>
            !(f.basePath === basePath && f.format === 'normal')
        );
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

        const combined = state.copiedFiles
            .map(f => f.content)
            .join('\n\n---\n\n');

        await vscode.env.clipboard.writeText(combined);
        const count = state.copiedFiles.length;

        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} to clipboard`);
        vscode.window.showInformationMessage(`Copied ${count} file${count > 1 ? 's' : ''} to clipboard`);

        if (state.statusBarItem) {
            state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''} copied`;
            state.statusBarItem.show();
        }
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
        let errorCounter = 1; // Counter for proper numbering

        Logger.debug(`Found ${diagnostics.length} diagnostics for document`);

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

        Logger.debug(`Processed ${errors.length} errors/warnings for inclusion`);

        let formattedContent: string;
        if (errors.length > 0) {
            // Format with error information - use proper numbering
            const errorString = errors.map(err =>
                `${err.index}. ${err.message} | ${err.line} | ${err.content}`
            ).join('\n');

            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\`\n${errorString}`;
            Logger.debug(`Formatted content with ${errors.length} error entries`);
        } else {
            // Regular format if no errors found
            formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
            Logger.debug('No errors found, using regular format');
        }

        // Remove any existing file with same basePath and format
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f =>
            !(f.basePath === basePath && f.format === 'error')
        );
        const afterCount = state.copiedFiles.length;

        if (beforeCount !== afterCount) {
            Logger.debug(`Removed existing error format entry for ${basePath}`);
        }

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

        Logger.info(`Successfully copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`);
        vscode.window.showInformationMessage(
            `Copied ${count} file${count > 1 ? 's' : ''} with ${errorCount} error${errorCount !== 1 ? 's' : ''} to clipboard`
        );

        if (state.statusBarItem) {
            state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''} (${errorCount} error${errorCount !== 1 ? 's' : ''})`;
            state.statusBarItem.show();
        }
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error('Failed to copy with error info', err);
        vscode.window.showErrorMessage(`Failed to copy with error info: ${msg}`);
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
            Logger.debug('Status bar item hidden');
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
        const combined = toCopy.map(f => f.content).join('\n\n---\n\n');
        await vscode.env.clipboard.writeText(combined);

        Logger.info(`Successfully copied ${toCopy.length} files from folder "${folder.name}"`);
        vscode.window.showInformationMessage(`Copied ${toCopy.length} files from "${folder.name}"`);

        if (state.statusBarItem) {
            state.statusBarItem.text = `$(clippy) ${toCopy.length} file${toCopy.length > 1 ? 's' : ''} copied`;
            state.statusBarItem.show();
        }
    } catch (err: any) {
        const msg = err.message || 'Unknown error';
        Logger.error(`Failed to copy folder contents for "${folder.name}"`, err);
        vscode.window.showErrorMessage(`Failed to copy folder contents: ${msg}`);
    }
}