/**
 * FILE: src/commands/contextMenuCommands.ts
 * 
 * CONTEXT MENU COMMANDS - LỆNH MENU NGỮ CẢNH
 * TEMP CLIPBOARD FUNCTIONALITY REMOVED
 * 
 * Các lệnh xuất hiện trong menu ngữ cảnh khi click chuột phải trên file/folder.
 * 
 * Chức năng chính:
 * - openFile: Mở file
 * - openToSide: Mở file ở bên cạnh
 * - openWith: Mở với ứng dụng khác
 * - copyPath: Copy đường dẫn tuyệt đối
 * - copyRelativePath: Copy đường dẫn tương đối
 * - revealInFileExplorer: Hiển thị trong file explorer
 * - renameFile: Đổi tên file
 * - deleteFile: Xóa file
 * - cut/copy/pasteFile: Cắt/sao chép/dán file
 * - newFile/newFolder: Tạo file/thư mục mới
 * - copyFileInline: Copy nội dung file (inline)
 */

// src/commands/contextMenuCommands.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../../models/models';
import { Logger } from '../../utils/common/logger';
import { TRACKING_SIGNATURE } from '../../utils/clipboard/clipboardUtils';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';

export function registerContextMenuCommands(context: vscode.ExtensionContext) {
    // Get notification service from container
    const container = ServiceContainer.getInstance();
    const notificationService = container.resolve<INotificationService>('INotificationService');

    const commands = [
        // File operations (context menu)
        vscode.commands.registerCommand('copy-path-with-code.openFile', async (item) => {
            await openFile(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.openToSide', async (item) => {
            await openFile(item, vscode.ViewColumn.Beside);
        }),
        vscode.commands.registerCommand('copy-path-with-code.openWith', async (item) => {
            await openWith(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.copyPath', (item) => {
            copyPath(item, false);
        }),
        vscode.commands.registerCommand('copy-path-with-code.copyRelativePath', (item) => {
            copyPath(item, true);
        }),
        vscode.commands.registerCommand('copy-path-with-code.revealInFileExplorer', (item) => {
            revealInFileExplorer(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.renameFile', async (item) => {
            await renameFile(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.deleteFile', async (item) => {
            await deleteFile(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.cutFile', (item) => {
            cutFile(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.copyFile', (item) => {
            copyFile(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.pasteFile', async (item) => {
            await pasteFile(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.newFile', async (item) => {
            await newFile(item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.newFolder', async (item) => {
            await newFolder(item);
        }),

        // FIXED: Handle rename command properly
        vscode.commands.registerCommand('copy-path-with-code.handleRename', async (item: any) => {
            await handleRename(item, notificationService);
        }),

        // Inline copy command (hover icon)
        vscode.commands.registerCommand('copy-path-with-code.copyFileInline', async (item) => {
            await copyFileInline(item);
        })
    ];

    // FIXED: All items are now Disposable
    commands.forEach(cmd => context.subscriptions.push(cmd));
}

// ==================== INLINE COPY FUNCTIONALITY ====================

async function copyFileInline(item: any) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine file path');
            return;
        }

        // Check if it's actually a file
        if (await isDirectory(uri)) {
            vscode.window.showWarningMessage('Cannot copy directory content');
            return;
        }

        // Read file content
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();

        // Create display path
        let displayPath: string;
        let basePath: string;

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            displayPath = vscode.workspace.asRelativePath(uri);
            basePath = displayPath;
        } else {
            displayPath = path.basename(uri.fsPath);
            basePath = uri.fsPath;
        }

        // Format content
        const formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;

        // Check if file already exists in copied files list
        const existingIndex = state.copiedFiles.findIndex(f => f.basePath === basePath);

        if (existingIndex !== -1) {
            // File already exists, update content
            state.copiedFiles[existingIndex] = {
                displayPath,
                basePath,
                content: formattedContent,
                format: 'normal'
            };
        } else {
            // Add new file
            state.copiedFiles.push({
                displayPath,
                basePath,
                content: formattedContent,
                format: 'normal'
            });
        }

        // Update clipboard
        await updateClipboardWithSignature();

        // Update status bar
        updateStatusBar();

        // Show notification
        const count = state.copiedFiles.length;
        const fileName = path.basename(displayPath);
        vscode.window.showInformationMessage(
            `Added "${fileName}" (${count} file${count > 1 ? 's' : ''} total)`
        );

    } catch (error) {
        Logger.error('Failed to copy file inline', error);
        vscode.window.showErrorMessage(`Failed to copy file: ${error}`);
    }
}

// ==================== FILE OPERATIONS (CONTEXT MENU) ====================

async function openFile(item: any, viewColumn?: vscode.ViewColumn) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine file path');
            return;
        }

        if (await isDirectory(uri)) {
            vscode.window.showInformationMessage('Cannot open directory as file');
            return;
        }

        await vscode.window.showTextDocument(uri, {
            viewColumn: viewColumn || vscode.ViewColumn.Active,
            preview: false
        });

    } catch (error) {
        Logger.error('Failed to open file', error);
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
}

async function openWith(item: any) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine file path');
            return;
        }

        // Execute the built-in open with command
        await vscode.commands.executeCommand('explorer.openWith', uri);
    } catch (error) {
        Logger.error('Failed to open with dialog', error);
        vscode.window.showErrorMessage(`Failed to open with: ${error}`);
    }
}

function copyPath(item: any, relative: boolean) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine file path');
            return;
        }

        let pathToCopy: string;

        if (relative && vscode.workspace.workspaceFolders) {
            pathToCopy = vscode.workspace.asRelativePath(uri);
        } else {
            pathToCopy = uri.fsPath;
        }

        vscode.env.clipboard.writeText(pathToCopy);

        const pathType = relative ? 'Relative path' : 'Path';
        vscode.window.showInformationMessage(`${pathType} copied to clipboard`);
    } catch (error) {
        Logger.error('Failed to copy path', error);
        vscode.window.showErrorMessage(`Failed to copy path: ${error}`);
    }
}

function revealInFileExplorer(item: any) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine file path');
            return;
        }

        vscode.commands.executeCommand('revealFileInOS', uri);
    } catch (error) {
        Logger.error('Failed to reveal in file explorer', error);
        vscode.window.showErrorMessage(`Failed to reveal in file explorer: ${error}`);
    }
}

async function renameFile(item: any) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine file path');
            return;
        }

        const currentName = path.basename(uri.fsPath);
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: currentName,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Name cannot be empty';
                }
                if (value.includes('/') || value.includes('\\')) {
                    return 'Name cannot contain path separators';
                }
                if (value.includes('<') || value.includes('>') || value.includes(':') ||
                    value.includes('"') || value.includes('|') || value.includes('?') || value.includes('*')) {
                    return 'Name contains invalid characters';
                }
                return null;
            }
        });

        if (!newName || newName === currentName) {
            return;
        }

        const newUri = vscode.Uri.file(path.join(path.dirname(uri.fsPath), newName));

        // Check if target already exists
        try {
            await vscode.workspace.fs.stat(newUri);
            vscode.window.showErrorMessage(`A file or folder with the name "${newName}" already exists`);
            return;
        } catch {
            // Target doesn't exist, proceed with rename
        }

        await vscode.workspace.fs.rename(uri, newUri);

        vscode.window.showInformationMessage(`Renamed to ${newName}`);
    } catch (error) {
        Logger.error('Failed to rename file', error);
        vscode.window.showErrorMessage(`Failed to rename: ${error}`);
    }
}

async function deleteFile(item: any) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine file path');
            return;
        }

        const fileName = path.basename(uri.fsPath);
        const isDir = await isDirectory(uri);
        const itemType = isDir ? 'directory' : 'file';

        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the ${itemType} "${fileName}"?`,
            { modal: true },
            'Delete'
        );

        if (confirmation === 'Delete') {
            await vscode.workspace.fs.delete(uri, { recursive: isDir, useTrash: true });
            vscode.window.showInformationMessage(`Deleted ${itemType} "${fileName}"`);
        }
    } catch (error) {
        Logger.error('Failed to delete file', error);
        vscode.window.showErrorMessage(`Failed to delete: ${error}`);
    }
}

async function newFile(item: any) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine directory path');
            return;
        }

        // Determine target directory
        let targetDir: vscode.Uri;
        if (await isDirectory(uri)) {
            targetDir = uri;
        } else {
            targetDir = vscode.Uri.file(path.dirname(uri.fsPath));
        }

        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter file name',
            placeHolder: 'newfile.txt',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'File name cannot be empty';
                }
                if (value.includes('/') || value.includes('\\')) {
                    return 'File name cannot contain path separators';
                }
                return null;
            }
        });

        if (!fileName) {
            return;
        }

        const newFileUri = vscode.Uri.file(path.join(targetDir.fsPath, fileName));

        // Check if file already exists
        try {
            await vscode.workspace.fs.stat(newFileUri);
            vscode.window.showErrorMessage(`File "${fileName}" already exists`);
            return;
        } catch {
            // File doesn't exist, proceed
        }

        // Create new file
        await vscode.workspace.fs.writeFile(newFileUri, new Uint8Array());

        // Open the new file
        const document = await vscode.workspace.openTextDocument(newFileUri);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage(`Created file "${fileName}"`);
    } catch (error) {
        Logger.error('Failed to create new file', error);
        vscode.window.showErrorMessage(`Failed to create file: ${error}`);
    }
}

async function newFolder(item: any) {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            vscode.window.showErrorMessage('Could not determine directory path');
            return;
        }

        // Determine target directory
        let targetDir: vscode.Uri;
        if (await isDirectory(uri)) {
            targetDir = uri;
        } else {
            targetDir = vscode.Uri.file(path.dirname(uri.fsPath));
        }

        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter folder name',
            placeHolder: 'New Folder',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Folder name cannot be empty';
                }
                if (value.includes('/') || value.includes('\\')) {
                    return 'Folder name cannot contain path separators';
                }
                return null;
            }
        });

        if (!folderName) {
            return;
        }

        const newFolderUri = vscode.Uri.file(path.join(targetDir.fsPath, folderName));

        // Check if folder already exists
        try {
            await vscode.workspace.fs.stat(newFolderUri);
            vscode.window.showErrorMessage(`Folder "${folderName}" already exists`);
            return;
        } catch {
            // Folder doesn't exist, proceed
        }

        // Create new folder
        await vscode.workspace.fs.createDirectory(newFolderUri);

        vscode.window.showInformationMessage(`Created folder "${folderName}"`);
    } catch (error) {
        Logger.error('Failed to create new folder', error);
        vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
    }
}

// ==================== CUT/COPY/PASTE OPERATIONS ====================

interface FileClipboardState {
    operation: 'cut' | 'copy';
    uris: vscode.Uri[];
}

let fileClipboardState: FileClipboardState | null = null;

function cutFile(item: any) {
    const uri = getUriFromItem(item);
    if (!uri) {
        vscode.window.showErrorMessage('Could not determine file path');
        return;
    }

    fileClipboardState = { operation: 'cut', uris: [uri] };
    vscode.window.showInformationMessage(`Cut ${path.basename(uri.fsPath)}`);
}

function copyFile(item: any) {
    const uri = getUriFromItem(item);
    if (!uri) {
        vscode.window.showErrorMessage('Could not determine file path');
        return;
    }

    fileClipboardState = { operation: 'copy', uris: [uri] };
    vscode.window.showInformationMessage(`Copied ${path.basename(uri.fsPath)}`);
}

async function pasteFile(item: any) {
    if (!fileClipboardState) {
        vscode.window.showInformationMessage('Nothing to paste');
        return;
    }

    try {
        const targetUri = getUriFromItem(item);
        if (!targetUri) {
            vscode.window.showErrorMessage('Could not determine target path');
            return;
        }

        // Determine target directory
        let targetDir: vscode.Uri;
        if (await isDirectory(targetUri)) {
            targetDir = targetUri;
        } else {
            targetDir = vscode.Uri.file(path.dirname(targetUri.fsPath));
        }

        let successCount = 0;
        let failedCount = 0;

        for (const sourceUri of fileClipboardState.uris) {
            try {
                const fileName = path.basename(sourceUri.fsPath);
                const targetPath = vscode.Uri.file(path.join(targetDir.fsPath, fileName));

                // Check if target already exists
                try {
                    await vscode.workspace.fs.stat(targetPath);
                    Logger.warn(`Target already exists, skipping: ${targetPath.fsPath}`);
                    failedCount++;
                    continue;
                } catch {
                    // Target doesn't exist, proceed
                }

                if (fileClipboardState.operation === 'copy') {
                    await vscode.workspace.fs.copy(sourceUri, targetPath);
                } else if (fileClipboardState.operation === 'cut') {
                    await vscode.workspace.fs.rename(sourceUri, targetPath);
                }

                successCount++;
            } catch (error) {
                Logger.error(`Failed to ${fileClipboardState.operation} file: ${sourceUri.fsPath}`, error);
                failedCount++;
            }
        }

        const operation = fileClipboardState.operation === 'copy' ? 'Copied' : 'Moved';
        let message = `${operation} ${successCount} item${successCount > 1 ? 's' : ''}`;
        if (failedCount > 0) {
            message += ` (${failedCount} failed)`;
        }
        vscode.window.showInformationMessage(message);

        // Clear clipboard state if it was a cut operation
        if (fileClipboardState.operation === 'cut') {
            fileClipboardState = null;
        }
    } catch (error) {
        Logger.error('Failed to paste file', error);
        vscode.window.showErrorMessage(`Failed to paste: ${error}`);
    }
}

// ==================== RENAME HANDLER ====================

async function handleRename(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection for rename');
            return;
        }

        // Sử dụng VS Code's built-in rename command
        await vscode.commands.executeCommand('renameFile', uri);

    } catch (error) {
        Logger.error('Failed to rename', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        notificationService.showError(`Failed to rename: ${errorMessage}`);
    }
}

// ==================== HELPER FUNCTIONS ====================

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

function getUriFromItem(item: any): vscode.Uri | null {
    try {
        // If item has resourceUri (from TreeItem)
        if (item && item.resourceUri) {
            return item.resourceUri;
        }

        // If item has treeNode with uri
        if (item && item.treeNode && item.treeNode.uri) {
            return vscode.Uri.parse(item.treeNode.uri);
        }

        // If item has uri property directly
        if (item && item.uri) {
            if (typeof item.uri === 'string') {
                return vscode.Uri.parse(item.uri);
            }
            return item.uri;
        }

        // If item has path property
        if (item && item.path) {
            return vscode.Uri.file(item.path);
        }

        return null;
    } catch (error) {
        Logger.error('Failed to get URI from item', error);
        return null;
    }
}

async function isDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        return (stat.type & vscode.FileType.Directory) !== 0;
    } catch {
        return false;
    }
}