/**
 * FILE: src/commands/common/RenameCommands.ts
 * 
 * UNIFIED RENAME COMMANDS - Xử lý rename cho cả folder và file với F2
 * 
 * Features:
 * - Rename folder: select toàn bộ tên
 * - Rename file: select chỉ phần tên (không extension)  
 * - Thực hiện rename trên filesystem thật
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { FolderService } from '../../domain/folder/services/FolderService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';
import { Logger } from '../../utils/common/logger';

export function registerRenameCommands(context: vscode.ExtensionContext): void {
    console.log('🚀 F2 Rename Debug - Registering rename commands');

    const container = ServiceContainer.getInstance();
    const folderApplicationService = container.resolve<FolderApplicationService>('FolderApplicationService');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const folderService = container.resolve<FolderService>('FolderService');

    try {
        CommandRegistry.registerCommand(
            context,
            'copy-path-with-code.renameItem',
            (item) => {
                console.log('🎯 F2 Rename Debug - Command triggered with item:', item);
                return handleRenameItem(item, folderApplicationService, notificationService, folderService);
            }
        );
        console.log('✅ F2 Rename Debug - Command registered successfully');
    } catch (error) {
        console.log('❌ F2 Rename Debug - Failed to register command:', error);
    }
}

async function handleRenameItem(
    item: any,
    folderApplicationService: FolderApplicationService,
    notificationService: INotificationService,
    folderService: FolderService
): Promise<void> {
    try {
        // DEBUG: Log toàn bộ thông tin item
        console.log('🔍 F2 Rename Debug - Item received:', {
            item,
            contextValue: item?.contextValue,
            id: item?.id,
            folderId: item?.folderId,
            label: item?.label,
            treeNode: item?.treeNode,
            resourceUri: item?.resourceUri
        });

        if (!item) {
            console.log('❌ F2 Rename Debug - No item provided');
            notificationService.showError('No item selected for rename');
            return;
        }

        // DEBUG: Log context value check
        console.log('🔍 F2 Rename Debug - Checking context value:', item.contextValue);

        // Xác định loại item và xử lý tương ứng
        if (item.contextValue === 'folder') {
            console.log('✅ F2 Rename Debug - Processing as folder');
            await handleRenameFolderWithF2(item, folderApplicationService, notificationService, folderService);
        } else if (item.contextValue === 'file' || item.contextValue === 'directory') {
            console.log('✅ F2 Rename Debug - Processing as file/directory');
            await handleRenameFileWithF2(item, notificationService);
        } else {
            console.log(`❌ F2 Rename Debug - Unknown context value: ${item.contextValue}`);
            console.log('🔍 Available contextValues should be: folder, file, directory');

            // FALLBACK: Try to determine from other properties
            if (item.id || item.folderId) {
                console.log('🔄 F2 Rename Debug - Fallback: Trying as folder');
                await handleRenameFolderWithF2(item, folderApplicationService, notificationService, folderService);
            } else {
                Logger.warn('Unknown item type for rename:', item);
                notificationService.showWarning(`Cannot rename this item type. Context: ${item.contextValue}`);
            }
        }

    } catch (error) {
        console.log('💥 F2 Rename Debug - Error:', error);
        Logger.error('Error in handleRenameItem:', error);
        notificationService.showError(`Rename failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Rename folder (extension folder)
async function handleRenameFolderWithF2(
    folderItem: any,
    folderApplicationService: FolderApplicationService,
    notificationService: INotificationService,
    folderService: FolderService
): Promise<void> {
    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    try {
        const folder = folderService.getFolderById(folderId);
        const currentName = folder.name;

        // Tạo InputBox với logic selection cho folder (toàn bộ tên)
        const newName = await showRenameInputBox({
            currentName,
            itemType: 'folder',
            prompt: `Rename folder "${currentName}"`,
            title: 'Rename Folder (F2)'
        });

        if (!newName || newName === currentName) {
            return; // User cancelled hoặc không thay đổi
        }

        // Sử dụng existing folder application service
        await folderApplicationService.handleRenameFolder({
            folderId,
            newName: newName.trim()
        });

    } catch (error) {
        Logger.error('Failed to rename folder with F2:', error);
        notificationService.showError(`Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Rename file/directory (filesystem)
async function handleRenameFileWithF2(
    fileItem: any,
    notificationService: INotificationService
): Promise<void> {
    try {
        const uri = getUriFromItem(fileItem);
        if (!uri) {
            notificationService.showError('Invalid file selection');
            return;
        }

        const currentName = path.basename(uri.fsPath);
        const isDirectory = await isItemDirectory(uri);

        // Tạo InputBox với logic selection cho file/directory
        const newName = await showRenameInputBox({
            currentName,
            itemType: isDirectory ? 'directory' : 'file',
            prompt: `Rename ${isDirectory ? 'directory' : 'file'} "${currentName}"`,
            title: `Rename ${isDirectory ? 'Directory' : 'File'} (F2)`
        });

        if (!newName || newName === currentName) {
            return; // User cancelled hoặc không thay đổi
        }

        // Thực hiện rename trên filesystem
        await performFilesystemRename(uri, newName, notificationService);

    } catch (error) {
        Logger.error('Failed to rename file with F2:', error);
        notificationService.showError(`Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// CORE: InputBox với custom selection logic
async function showRenameInputBox(options: {
    currentName: string;
    itemType: 'folder' | 'file' | 'directory';
    prompt: string;
    title: string;
}): Promise<string | undefined> {

    const { currentName, itemType, prompt, title } = options;

    return new Promise((resolve) => {
        const inputBox = vscode.window.createInputBox();

        inputBox.title = title;
        inputBox.prompt = prompt;
        inputBox.value = currentName;
        inputBox.placeholder = currentName;

        // Validation
        inputBox.onDidChangeValue((value) => {
            if (!value.trim()) {
                inputBox.validationMessage = 'Name cannot be empty';
            } else if (value.length > 255) {
                inputBox.validationMessage = 'Name too long (max 255 characters)';
            } else if (/[<>:"/\\|?*]/.test(value)) {
                inputBox.validationMessage = 'Name contains invalid characters: < > : " / \\ | ? *';
            } else if (itemType !== 'folder' && process.platform === 'win32' && /[<>:"|?*]/.test(value)) {
                inputBox.validationMessage = 'Name contains characters invalid on Windows';
            } else {
                inputBox.validationMessage = undefined;
            }
        });

        inputBox.onDidAccept(() => {
            const value = inputBox.value.trim();
            if (value && !inputBox.validationMessage) {
                resolve(value);
            }
            inputBox.dispose();
        });

        inputBox.onDidHide(() => {
            resolve(undefined);
            inputBox.dispose();
        });

        // Show InputBox
        inputBox.show();

        // Apply selection logic after show
        setTimeout(() => {
            let start = 0;
            let end = currentName.length;

            if (itemType === 'file') {
                // File: chỉ select phần tên, không extension
                const extension = path.extname(currentName);
                if (extension) {
                    end = currentName.length - extension.length;
                }
            }
            // Folder và directory: select toàn bộ (đã set sẵn)

            // Apply selection
            inputBox.valueSelection = [start, end];
        }, 100); // Delay để đảm bảo InputBox đã render hoàn toàn
    });
}

// Thực hiện rename trên filesystem
async function performFilesystemRename(
    oldUri: vscode.Uri,
    newName: string,
    notificationService: INotificationService
): Promise<void> {
    try {
        const parentDir = path.dirname(oldUri.fsPath);
        const newPath = path.join(parentDir, newName);
        const newUri = vscode.Uri.file(newPath);

        // Check nếu tên mới đã tồn tại
        try {
            await vscode.workspace.fs.stat(newUri);
            notificationService.showWarning(`"${newName}" already exists`);
            return;
        } catch {
            // File không tồn tại, tốt
        }

        // Thực hiện rename
        await vscode.workspace.fs.rename(oldUri, newUri);

        const oldName = path.basename(oldUri.fsPath);
        notificationService.showSuccess(`Renamed "${oldName}" to "${newName}"`);

        // Refresh tree view để cập nhật
        vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');

    } catch (error) {
        throw new Error(`Filesystem rename failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Helper functions
function getUriFromItem(item: any): vscode.Uri | null {
    try {
        if (item?.resourceUri) {
            return item.resourceUri;
        }

        if (item?.uri) {
            return typeof item.uri === 'string' ? vscode.Uri.parse(item.uri) : item.uri;
        }

        if (item?.treeNode?.uri) {
            return vscode.Uri.parse(item.treeNode.uri);
        }

        // Handle relative path from workspace
        if (item?.treeNode?.path) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const absolutePath = path.join(workspaceFolders[0].uri.fsPath, item.treeNode.path);
                return vscode.Uri.file(absolutePath);
            }
        }

        return null;
    } catch (error) {
        Logger.error('Error extracting URI from item:', error);
        return null;
    }
}

async function isItemDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        return stat.type === vscode.FileType.Directory;
    } catch {
        return false;
    }
}