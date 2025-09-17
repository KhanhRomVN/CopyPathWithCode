/**
 * FILE: src/commands/folder/FileManagementCommands.ts
 * 
 * FILE MANAGEMENT COMMANDS - File add/remove operations
 * Fixed to properly convert relative paths to absolute URIs
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { FolderProvider } from '../../providers/FolderProvider';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IEditorService } from '../../infrastructure/folder/ui/EditorService';

export function registerFileManagementCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const commandHandler = container.resolve<FolderApplicationService>('FolderApplicationService');
    const treeDataProvider = container.resolve<FolderProvider>('FolderProvider');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const editorService = container.resolve<IEditorService>('IEditorService');

    const commands = [
        // File Management Commands
        vscode.commands.registerCommand('copy-path-with-code.addFileToFolder', (folderItem) =>
            handleAddFileToFolder(commandHandler, treeDataProvider, folderItem, workspaceService, notificationService)
        ),

        vscode.commands.registerCommand('copy-path-with-code.removeFileFromFolder', (folderItem) =>
            handleRemoveFileFromFolder(commandHandler, treeDataProvider, folderItem, notificationService)
        ),

        vscode.commands.registerCommand('copy-path-with-code.openFolderFiles', (folderItem) =>
            handleOpenFolderFiles(commandHandler, folderItem, editorService, notificationService)
        ),

        // File Selection Commands
        vscode.commands.registerCommand('copy-path-with-code.toggleFileSelection', (filePath: string) => {
            treeDataProvider.toggleFileSelection(filePath);
        }),

        vscode.commands.registerCommand('copy-path-with-code.selectAllFiles', () => {
            treeDataProvider.selectAllFiles();
        }),

        vscode.commands.registerCommand('copy-path-with-code.deselectAllFiles', () => {
            treeDataProvider.deselectAllFiles();
        }),

        vscode.commands.registerCommand('copy-path-with-code.selectAllFilesInFolder', (folderItem) => {
            handleSelectAllFilesInFolder(treeDataProvider, folderItem, notificationService);
        }),

        vscode.commands.registerCommand('copy-path-with-code.unselectAllFilesInFolder', (folderItem) => {
            handleUnselectAllFilesInFolder(treeDataProvider, folderItem, notificationService);
        }),

        // File Management Mode Commands
        vscode.commands.registerCommand('copy-path-with-code.confirmFileManagement', () =>
            handleConfirmFileManagement(commandHandler, treeDataProvider, workspaceService, notificationService)
        ),

        vscode.commands.registerCommand('copy-path-with-code.cancelFileManagement', () => {
            handleCancelFileManagement(treeDataProvider, notificationService);
        })
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

// =============================================
// FILE MANAGEMENT COMMAND HANDLERS
// =============================================

async function handleAddFileToFolder(
    commandHandler: FolderApplicationService,
    treeDataProvider: FolderProvider,
    folderItem: any,
    workspaceService: IWorkspaceService,
    notificationService: INotificationService
): Promise<void> {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        notificationService.showWarning('Cannot add files in global view. Switch to workspace view.');
        return;
    }

    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    // Check if workspace is available
    if (!workspaceService.hasActiveWorkspace()) {
        notificationService.showWarning('No active workspace found. Please open a folder or workspace first.');
        return;
    }

    // Enter file management mode
    treeDataProvider.enterFileManagementMode(folderId, 'add');
    notificationService.showInfo('Adding files to folder. Select files in the sidebar and click "Confirm Add Selected".');
}

async function handleRemoveFileFromFolder(
    commandHandler: FolderApplicationService,
    treeDataProvider: FolderProvider,
    folderItem: any,
    notificationService: INotificationService
): Promise<void> {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        notificationService.showWarning('Cannot remove files in global view. Switch to workspace view.');
        return;
    }

    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    // Enter file management mode
    treeDataProvider.enterFileManagementMode(folderId, 'remove');
    notificationService.showInfo('Removing files from folder. Select files in the sidebar and click "Confirm Remove Selected".');
}

async function handleOpenFolderFiles(
    commandHandler: FolderApplicationService,
    folderItem: any,
    editorService: IEditorService,
    notificationService: INotificationService
): Promise<void> {
    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    const options = [
        {
            label: 'Close existing tabs',
            description: 'Close all open editors first',
            detail: 'This will close all currently open files before opening folder files'
        },
        {
            label: 'Keep existing tabs',
            description: 'Add to currently open files',
            detail: 'Folder files will be opened alongside existing files'
        }
    ];

    const choice = await vscode.window.showQuickPick(options, {
        placeHolder: 'Handle existing tabs?',
        title: 'Opening folder files',
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (!choice) return;

    const closeExisting = choice.label === 'Close existing tabs';

    if (closeExisting) {
        try {
            await editorService.closeAllEditors();
        } catch (error) {
            notificationService.showWarning('Could not close existing tabs, but will continue opening folder files.');
        }
    }

    await commandHandler.handleOpenFolderFiles({
        folderId,
        closeExistingTabs: closeExisting,
        validateFiles: true
    });
}

function handleSelectAllFilesInFolder(
    treeDataProvider: FolderProvider,
    folderItem: any,
    notificationService: INotificationService
): void {
    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    const selectedCount = treeDataProvider.selectAllFilesInFolder(folderId);
    if (selectedCount > 0) {
        notificationService.showInfo(`Selected ${selectedCount} files in folder`);
    } else {
        notificationService.showInfo('No files found in folder');
    }
}

function handleUnselectAllFilesInFolder(
    treeDataProvider: FolderProvider,
    folderItem: any,
    notificationService: INotificationService
): void {
    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    const unselectedCount = treeDataProvider.unselectAllFilesInFolder(folderId);
    if (unselectedCount > 0) {
        notificationService.showInfo(`Unselected ${unselectedCount} files in folder`);
    } else {
        notificationService.showInfo('No files were selected in folder');
    }
}

async function handleConfirmFileManagement(
    commandHandler: FolderApplicationService,
    treeDataProvider: FolderProvider,
    workspaceService: IWorkspaceService,
    notificationService: INotificationService
): Promise<void> {
    const selectedFiles = treeDataProvider.getSelectedFiles();
    const managementState = treeDataProvider.getFileManagementState();

    if (managementState.mode === 'normal' || !managementState.folderId) {
        notificationService.showWarning('No active file management operation');
        return;
    }

    if (selectedFiles.length === 0) {
        notificationService.showWarning('No files selected');
        return;
    }

    // Convert relative paths to URIs
    const currentWorkspace = workspaceService.getCurrentWorkspaceFolder();
    if (!currentWorkspace) {
        notificationService.showError('No active workspace found');
        return;
    }

    const selectedUris = selectedFiles.map(relativePath => {
        // Convert relative path to absolute path, then to URI
        const absolutePath = path.resolve(currentWorkspace, relativePath);
        return vscode.Uri.file(absolutePath).toString();
    });

    try {
        if (managementState.mode === 'add') {
            await commandHandler.handleAddFilesToFolder({
                folderId: managementState.folderId,
                fileUris: selectedUris,
                validateFiles: true
            });
        } else if (managementState.mode === 'remove') {
            await commandHandler.handleRemoveFilesFromFolder({
                folderId: managementState.folderId,
                fileUris: selectedUris
            });
        }

        // Exit file management mode on success
        treeDataProvider.exitFileManagementMode();
    } catch (error) {
        notificationService.showError(
            `Failed to ${managementState.mode} files: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

function handleCancelFileManagement(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): void {
    const managementState = treeDataProvider.getFileManagementState();

    if (managementState.mode === 'normal') {
        notificationService.showInfo('No active file management operation to cancel');
        return;
    }

    treeDataProvider.exitFileManagementMode();
    notificationService.showInfo('File management operation cancelled');
}