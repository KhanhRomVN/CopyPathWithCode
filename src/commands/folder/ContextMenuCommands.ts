// FILE: src/commands/folder/ContextMenuCommands.ts - ENHANCED VERSION
/**
 * CONTEXT MENU COMMANDS - Complete VS Code File/Folder Context Menu Implementation
 * 
 * Implements standard VS Code context menu operations for files and folders:
 * - File operations: Open, Open to Side, Copy, Cut, Paste, Rename, Delete
 * - Folder operations: Open Terminal, New File/Folder, Copy Path, etc.
 * - Cross-platform compatibility for file system operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';
import { Logger } from '../../utils/common/logger';

// Clipboard state for cut/copy operations
interface ClipboardItem {
    uri: vscode.Uri;
    operation: 'copy' | 'cut';
    timestamp: number;
}

class ClipboardManager {
    private static instance: ClipboardManager;
    private clipboardItems: ClipboardItem[] = [];

    static getInstance(): ClipboardManager {
        if (!ClipboardManager.instance) {
            ClipboardManager.instance = new ClipboardManager();
        }
        return ClipboardManager.instance;
    }

    setItems(items: ClipboardItem[]): void {
        this.clipboardItems = items.map(item => ({
            ...item,
            timestamp: Date.now()
        }));

        // Update VS Code context for paste command
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardItems', items.length > 0);
    }

    getItems(): ClipboardItem[] {
        // Clean up old items (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        this.clipboardItems = this.clipboardItems.filter(item => item.timestamp > oneHourAgo);

        return this.clipboardItems;
    }

    clear(): void {
        this.clipboardItems = [];
        vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardItems', false);
    }

    hasItems(): boolean {
        return this.getItems().length > 0;
    }
}

export function registerContextMenuCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');
    const clipboardManager = ClipboardManager.getInstance();

    const commands = [
        // File Operations
        {
            command: 'copy-path-with-code.openFile',
            handler: (item: any) => handleOpenFile(item, notificationService)
        },
        {
            command: 'copy-path-with-code.openToSide',
            handler: (item: any) => handleOpenToSide(item, notificationService)
        },
        {
            command: 'copy-path-with-code.openWith',
            handler: (item: any) => handleOpenWith(item, notificationService)
        },

        // Explorer Operations
        {
            command: 'copy-path-with-code.openContainingFolder',
            handler: (item: any) => handleOpenContainingFolder(item, notificationService)
        },
        {
            command: 'copy-path-with-code.revealInFileExplorer',
            handler: (item: any) => handleRevealInFileExplorer(item, notificationService)
        },
        {
            command: 'copy-path-with-code.openInIntegratedTerminal',
            handler: (item: any) => handleOpenInIntegratedTerminal(item, notificationService)
        },

        // Path Operations
        {
            command: 'copy-path-with-code.copyPath',
            handler: (item: any) => handleCopyPath(item, notificationService)
        },
        {
            command: 'copy-path-with-code.copyRelativePath',
            handler: (item: any) => handleCopyRelativePath(item, workspaceService, notificationService)
        },

        // Edit Operations
        {
            command: 'copy-path-with-code.renameFile',
            handler: (item: any) => handleRenameFile(item, notificationService)
        },
        {
            command: 'copy-path-with-code.deleteFile',
            handler: (item: any) => handleDeleteFile(item, notificationService)
        },

        // Clipboard Operations
        {
            command: 'copy-path-with-code.cutFile',
            handler: (item: any) => handleCutFile(item, clipboardManager, notificationService)
        },
        {
            command: 'copy-path-with-code.copyFile',
            handler: (item: any) => handleCopyFile(item, clipboardManager, notificationService)
        },
        {
            command: 'copy-path-with-code.pasteFile',
            handler: (item: any) => handlePasteFile(item, clipboardManager, notificationService)
        },

        // Creation Operations
        {
            command: 'copy-path-with-code.newFile',
            handler: (item: any) => handleNewFile(item, notificationService)
        },
        {
            command: 'copy-path-with-code.newFolder',
            handler: (item: any) => handleNewFolder(item, notificationService)
        }
    ];

    // Register all commands
    commands.forEach(({ command, handler }) => {
        CommandRegistry.registerCommand(context, command, handler);
    });

    Logger.info('Enhanced context menu commands registered');
}

// =============================================
// FILE OPERATIONS
// =============================================

async function handleOpenFile(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid file selection');
            return;
        }

        // Verify it's a file
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type !== vscode.FileType.File) {
            notificationService.showWarning('Selected item is not a file');
            return;
        }

        await vscode.window.showTextDocument(uri, { preview: false });
        Logger.debug(`Opened file: ${uri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to open file', error);
        notificationService.showError(`Failed to open file: ${getErrorMessage(error)}`);
    }
}

async function handleOpenToSide(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid file selection');
            return;
        }

        // Verify it's a file
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type !== vscode.FileType.File) {
            notificationService.showWarning('Selected item is not a file');
            return;
        }

        await vscode.window.showTextDocument(uri, {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside
        });
        Logger.debug(`Opened file to side: ${uri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to open file to side', error);
        notificationService.showError(`Failed to open file to side: ${getErrorMessage(error)}`);
    }
}

async function handleOpenWith(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid file selection');
            return;
        }

        await vscode.commands.executeCommand('vscode.openWith', uri);
        Logger.debug(`Opened file with custom editor: ${uri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to open with custom editor', error);
        notificationService.showError(`Failed to open with custom editor: ${getErrorMessage(error)}`);
    }
}

// =============================================
// EXPLORER OPERATIONS
// =============================================

async function handleOpenContainingFolder(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        let folderUri: vscode.Uri;

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
                folderUri = uri;
            } else {
                // For files, get parent directory
                folderUri = vscode.Uri.file(path.dirname(uri.fsPath));
            }
        } catch {
            // If stat fails, assume it's a file and get parent directory
            folderUri = vscode.Uri.file(path.dirname(uri.fsPath));
        }

        await vscode.commands.executeCommand('revealFileInOS', folderUri);
        Logger.debug(`Opened containing folder: ${folderUri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to open containing folder', error);
        notificationService.showError(`Failed to open containing folder: ${getErrorMessage(error)}`);
    }
}

async function handleRevealInFileExplorer(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        await vscode.commands.executeCommand('revealFileInOS', uri);
        Logger.debug(`Revealed in file explorer: ${uri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to reveal in file explorer', error);
        notificationService.showError(`Failed to reveal in file explorer: ${getErrorMessage(error)}`);
    }
}

async function handleOpenInIntegratedTerminal(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        // Determine the directory to open terminal in
        let terminalUri: vscode.Uri;

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
                terminalUri = uri;
            } else {
                // For files, open terminal in parent directory
                terminalUri = vscode.Uri.file(path.dirname(uri.fsPath));
            }
        } catch {
            // If stat fails, assume it's a file and get parent directory
            terminalUri = vscode.Uri.file(path.dirname(uri.fsPath));
        }

        // Create and show terminal
        const terminal = vscode.window.createTerminal({
            name: `Terminal - ${path.basename(terminalUri.fsPath)}`,
            cwd: terminalUri
        });

        terminal.show();
        Logger.debug(`Opened terminal in: ${terminalUri.fsPath}`);
        notificationService.showInfo(`Opened terminal in ${path.basename(terminalUri.fsPath)}`);
    } catch (error) {
        Logger.error('Failed to open integrated terminal', error);
        notificationService.showError(`Failed to open terminal: ${getErrorMessage(error)}`);
    }
}

// =============================================
// PATH OPERATIONS
// =============================================

async function handleCopyPath(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        const fullPath = uri.fsPath;
        await vscode.env.clipboard.writeText(fullPath);

        const fileName = path.basename(fullPath);
        notificationService.showInfo(`Copied path: ${fileName}`);
        Logger.debug(`Copied path: ${fullPath}`);
    } catch (error) {
        Logger.error('Failed to copy path', error);
        notificationService.showError(`Failed to copy path: ${getErrorMessage(error)}`);
    }
}

async function handleCopyRelativePath(
    item: any,
    workspaceService: IWorkspaceService,
    notificationService: INotificationService
): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        let relativePath: string;

        if (workspaceService.hasActiveWorkspace()) {
            relativePath = workspaceService.getRelativePath(uri.toString());
        } else {
            // If no workspace, use just the filename
            relativePath = path.basename(uri.fsPath);
        }

        await vscode.env.clipboard.writeText(relativePath);
        notificationService.showInfo(`Copied relative path: ${relativePath}`);
        Logger.debug(`Copied relative path: ${relativePath}`);
    } catch (error) {
        Logger.error('Failed to copy relative path', error);
        notificationService.showError(`Failed to copy relative path: ${getErrorMessage(error)}`);
    }
}

// =============================================
// EDIT OPERATIONS
// =============================================

async function handleRenameFile(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        const currentName = path.basename(uri.fsPath);
        const currentExtension = path.extname(currentName);
        const nameWithoutExtension = path.basename(currentName, currentExtension);

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: currentName,
            title: `Rename ${currentName}`,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Name cannot be empty';
                }
                if (value.includes('/') || value.includes('\\')) {
                    return 'Name cannot contain path separators';
                }
                if (value === currentName) {
                    return 'Please enter a different name';
                }
                // Check for invalid characters on Windows
                if (process.platform === 'win32' && /[<>:"|?*]/.test(value)) {
                    return 'Name contains invalid characters';
                }
                return null;
            }
        });

        if (!newName) return;

        const parentDir = path.dirname(uri.fsPath);
        const newUri = vscode.Uri.file(path.join(parentDir, newName));

        // Check if target exists
        try {
            await vscode.workspace.fs.stat(newUri);
            notificationService.showWarning(`"${newName}" already exists`);
            return;
        } catch {
            // Target doesn't exist, which is good
        }

        await vscode.workspace.fs.rename(uri, newUri);
        notificationService.showSuccess(`Renamed "${currentName}" to "${newName}"`);
        Logger.debug(`Renamed ${uri.fsPath} to ${newUri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to rename', error);
        notificationService.showError(`Failed to rename: ${getErrorMessage(error)}`);
    }
}

async function handleDeleteFile(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        const fileName = path.basename(uri.fsPath);
        let itemType = 'item';

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            itemType = stat.type === vscode.FileType.Directory ? 'folder' : 'file';
        } catch {
            // If stat fails, continue with generic 'item'
        }

        const choice = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${fileName}"?`,
            { modal: true },
            'Move to Trash',
            'Cancel'
        );

        if (choice === 'Move to Trash') {
            await vscode.workspace.fs.delete(uri, {
                recursive: true,
                useTrash: true
            });
            notificationService.showSuccess(`Deleted ${itemType} "${fileName}"`);
            Logger.debug(`Deleted ${uri.fsPath}`);
        }
    } catch (error) {
        Logger.error('Failed to delete', error);
        notificationService.showError(`Failed to delete: ${getErrorMessage(error)}`);
    }
}

// =============================================
// CLIPBOARD OPERATIONS
// =============================================

function handleCutFile(
    item: any,
    clipboardManager: ClipboardManager,
    notificationService: INotificationService
): void {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        clipboardManager.setItems([{ uri, operation: 'cut', timestamp: Date.now() }]);

        const fileName = path.basename(uri.fsPath);
        notificationService.showInfo(`Cut: ${fileName}`);
        Logger.debug(`Cut file: ${uri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to cut', error);
        notificationService.showError(`Failed to cut: ${getErrorMessage(error)}`);
    }
}

function handleCopyFile(
    item: any,
    clipboardManager: ClipboardManager,
    notificationService: INotificationService
): void {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid selection');
            return;
        }

        clipboardManager.setItems([{ uri, operation: 'copy', timestamp: Date.now() }]);

        const fileName = path.basename(uri.fsPath);
        notificationService.showInfo(`Copied: ${fileName}`);
        Logger.debug(`Copied file: ${uri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to copy', error);
        notificationService.showError(`Failed to copy: ${getErrorMessage(error)}`);
    }
}

async function handlePasteFile(
    item: any,
    clipboardManager: ClipboardManager,
    notificationService: INotificationService
): Promise<void> {
    try {
        if (!clipboardManager.hasItems()) {
            notificationService.showWarning('Nothing to paste');
            return;
        }

        const targetUri = getUriFromItem(item);
        if (!targetUri) {
            notificationService.showError('Invalid paste target');
            return;
        }

        // Determine target directory
        let targetDir: vscode.Uri;
        try {
            const stat = await vscode.workspace.fs.stat(targetUri);
            if (stat.type === vscode.FileType.Directory) {
                targetDir = targetUri;
            } else {
                targetDir = vscode.Uri.file(path.dirname(targetUri.fsPath));
            }
        } catch {
            targetDir = vscode.Uri.file(path.dirname(targetUri.fsPath));
        }

        const clipboardItems = clipboardManager.getItems();
        let successCount = 0;
        let errorCount = 0;

        for (const clipboardItem of clipboardItems) {
            try {
                const fileName = path.basename(clipboardItem.uri.fsPath);
                const targetPath = path.join(targetDir.fsPath, fileName);
                const finalTargetUri = vscode.Uri.file(targetPath);

                // Check if target already exists and get unique name if needed
                const uniqueTargetUri = await getUniqueTargetPath(finalTargetUri);

                if (clipboardItem.operation === 'copy') {
                    await vscode.workspace.fs.copy(clipboardItem.uri, uniqueTargetUri);
                } else { // cut
                    await vscode.workspace.fs.rename(clipboardItem.uri, uniqueTargetUri);
                }

                successCount++;
                Logger.debug(`${clipboardItem.operation === 'copy' ? 'Copied' : 'Moved'} ${clipboardItem.uri.fsPath} to ${uniqueTargetUri.fsPath}`);
            } catch (error) {
                errorCount++;
                Logger.error(`Failed to paste ${clipboardItem.uri.fsPath}`, error);
            }
        }

        // Clear clipboard after cut operations
        const hadCutItems = clipboardItems.some(item => item.operation === 'cut');
        if (hadCutItems) {
            clipboardManager.clear();
        }

        // Show results
        if (successCount > 0) {
            notificationService.showSuccess(`Pasted ${successCount} item(s)`);
        }
        if (errorCount > 0) {
            notificationService.showWarning(`Failed to paste ${errorCount} item(s)`);
        }
    } catch (error) {
        Logger.error('Failed to paste', error);
        notificationService.showError(`Failed to paste: ${getErrorMessage(error)}`);
    }
}

// =============================================
// CREATION OPERATIONS
// =============================================

async function handleNewFile(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid folder selection');
            return;
        }

        // Determine target directory
        let targetDir: vscode.Uri;
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
                targetDir = uri;
            } else {
                targetDir = vscode.Uri.file(path.dirname(uri.fsPath));
            }
        } catch {
            targetDir = vscode.Uri.file(path.dirname(uri.fsPath));
        }

        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter file name',
            placeHolder: 'new-file.txt',
            title: 'Create New File',
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'File name cannot be empty';
                }
                if (value.includes('/') || value.includes('\\')) {
                    return 'File name cannot contain path separators';
                }
                // Check for invalid characters on Windows
                if (process.platform === 'win32' && /[<>:"|?*]/.test(value)) {
                    return 'File name contains invalid characters';
                }
                return null;
            }
        });

        if (!fileName) return;

        const newFileUri = vscode.Uri.file(path.join(targetDir.fsPath, fileName));

        // Check if file already exists
        try {
            await vscode.workspace.fs.stat(newFileUri);
            notificationService.showWarning(`File "${fileName}" already exists`);
            return;
        } catch {
            // File doesn't exist, which is what we want
        }

        // Create empty file
        await vscode.workspace.fs.writeFile(newFileUri, new Uint8Array());

        // Open the new file
        await vscode.window.showTextDocument(newFileUri);

        notificationService.showSuccess(`Created file "${fileName}"`);
        Logger.debug(`Created new file: ${newFileUri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to create new file', error);
        notificationService.showError(`Failed to create file: ${getErrorMessage(error)}`);
    }
}

async function handleNewFolder(item: any, notificationService: INotificationService): Promise<void> {
    try {
        const uri = getUriFromItem(item);
        if (!uri) {
            notificationService.showError('Invalid folder selection');
            return;
        }

        // Determine target directory
        let targetDir: vscode.Uri;
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
                targetDir = uri;
            } else {
                targetDir = vscode.Uri.file(path.dirname(uri.fsPath));
            }
        } catch {
            targetDir = vscode.Uri.file(path.dirname(uri.fsPath));
        }

        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter folder name',
            placeHolder: 'new-folder',
            title: 'Create New Folder',
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Folder name cannot be empty';
                }
                if (value.includes('/') || value.includes('\\')) {
                    return 'Folder name cannot contain path separators';
                }
                if (/[<>:"/\\|?*]/.test(value)) {
                    return 'Folder name contains forbidden characters';
                }
                return null;
            }
        });

        if (!folderName) return;

        const newFolderUri = vscode.Uri.file(path.join(targetDir.fsPath, folderName));

        // Check if folder already exists
        try {
            await vscode.workspace.fs.stat(newFolderUri);
            notificationService.showWarning(`Folder "${folderName}" already exists`);
            return;
        } catch {
            // Folder doesn't exist, which is what we want
        }

        // Create folder
        await vscode.workspace.fs.createDirectory(newFolderUri);

        notificationService.showSuccess(`Created folder "${folderName}"`);
        Logger.debug(`Created new folder: ${newFolderUri.fsPath}`);
    } catch (error) {
        Logger.error('Failed to create new folder', error);
        notificationService.showError(`Failed to create folder: ${getErrorMessage(error)}`);
    }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function getUriFromItem(item: any): vscode.Uri | null {
    try {
        // Handle different item types
        if (item?.resourceUri) {
            return item.resourceUri;
        }

        if (item?.uri) {
            return typeof item.uri === 'string' ? vscode.Uri.parse(item.uri) : item.uri;
        }

        if (item?.treeNode?.uri) {
            return vscode.Uri.parse(item.treeNode.uri);
        }

        // Handle file paths
        if (typeof item === 'string') {
            return vscode.Uri.file(item);
        }

        // Handle TreeItem with path information
        if (item?.treeNode?.path && item?.folderId) {
            // This is a path relative to workspace, need to convert to absolute
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const absolutePath = path.join(workspaceFolders[0].uri.fsPath, item.treeNode.path);
                return vscode.Uri.file(absolutePath);
            }
        }

        Logger.warn('Could not extract URI from item', item);
        return null;
    } catch (error) {
        Logger.error('Error extracting URI from item', error);
        return null;
    }
}

async function getUniqueTargetPath(targetUri: vscode.Uri): Promise<vscode.Uri> {
    let counter = 1;
    let currentUri = targetUri;

    while (true) {
        try {
            await vscode.workspace.fs.stat(currentUri);
            // File exists, try with counter
            const ext = path.extname(targetUri.fsPath);
            const nameWithoutExt = path.basename(targetUri.fsPath, ext);
            const dir = path.dirname(targetUri.fsPath);

            const newName = `${nameWithoutExt} (${counter})${ext}`;
            currentUri = vscode.Uri.file(path.join(dir, newName));
            counter++;
        } catch {
            // File doesn't exist, use this path
            break;
        }
    }

    return currentUri;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Unknown error';
}