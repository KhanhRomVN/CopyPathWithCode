import * as vscode from 'vscode';
import { ClipboardService } from '../../../domain/clipboard/services/ClipboardService';
import { CopiedFileEntity } from '../../../domain/clipboard/entities/CopiedFile';
import { IClipboardNotificationService } from '../../../infrastructure/clipboard/ui/ClipboardNotificationService';

export interface ErrorInfo {
    message: string;
    line: number;
    content: string;
    severity: number;
    index: number;
}

export class CopyFileContentUseCase {
    constructor(
        private readonly clipboardService: ClipboardService,
        private readonly notificationService: IClipboardNotificationService
    ) { }

    async execute(includeErrors: boolean = false): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                this.notificationService.showWarning('No active text editor found');
                return;
            }

            const document = editor.document;
            const filePath = document.uri.fsPath;

            let displayPath = filePath;
            let basePath = filePath;

            if (vscode.workspace.workspaceFolders) {
                const ws = vscode.workspace.workspaceFolders[0];
                displayPath = vscode.workspace.asRelativePath(document.uri);
                basePath = displayPath;
            }

            let content: string;
            const selection = editor.selection;

            if (!selection.isEmpty) {
                content = document.getText(selection);
                const startLine = selection.start.line + 1;
                const endLine = selection.end.line + 1;
                displayPath = `${displayPath}:${startLine}-${endLine}`;
            } else {
                content = document.getText();
            }

            let formattedContent: string;
            const format: 'normal' | 'error' = includeErrors ? 'error' : 'normal';

            if (includeErrors) {
                const errors = this.getErrorsFromDocument(document, selection);
                formattedContent = this.formatContentWithErrors(displayPath, content, errors);
            } else {
                formattedContent = this.formatContent(displayPath, content);
            }

            const copiedFile = CopiedFileEntity.create(displayPath, basePath, formattedContent, format);

            // SỬA LỖI: Thay thế updateSystemClipboard() bằng addCopiedFile()
            await this.clipboardService.addCopiedFile(copiedFile);

            const count = this.clipboardService.getCopiedFiles().length;
            const errorText = includeErrors ? ' with errors' : '';
            this.notificationService.showInfo(
                `Copied ${count} file${count > 1 ? 's' : ''}${errorText} to clipboard`
            );

        } catch (error) {
            this.notificationService.showError(
                `Failed to copy: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private getErrorsFromDocument(document: vscode.TextDocument, selection: vscode.Selection): ErrorInfo[] {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errors: ErrorInfo[] = [];
        let errorCounter = 1;

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

        return errors;
    }

    private formatContent(displayPath: string, content: string): string {
        return `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
    }

    private formatContentWithErrors(displayPath: string, content: string, errors: ErrorInfo[]): string {
        if (errors.length > 0) {
            const errorString = errors.map(err =>
                `${err.index}. ${err.message} | ${err.line} | ${err.content}`
            ).join('\n');

            return `${displayPath}:\n\`\`\`\n${content}\n\n${errorString}\n\`\`\``;
        } else {
            return `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;
        }
    }
}