import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { FolderProvider } from '../../providers/FolderProvider';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IEditorService } from '../../infrastructure/folder/ui/EditorService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';

export function registerFileManagementCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const commandHandler = container.resolve<FolderApplicationService>('FolderApplicationService');
    const treeDataProvider = container.resolve<FolderProvider>('FolderProvider');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const editorService = container.resolve<IEditorService>('IEditorService');

    // Use CommandRegistry for all commands to prevent duplicates
    const commands = [
        // File Management Commands
        {
            command: 'copy-path-with-code.addFileToFolder',
            handler: (folderItem: any) => handleAddFileToFolder(commandHandler, treeDataProvider, folderItem, workspaceService, notificationService)
        },
        {
            command: 'copy-path-with-code.removeFileFromFolder',
            handler: (folderItem: any) => handleRemoveFileFromFolder(commandHandler, treeDataProvider, folderItem, notificationService)
        },
        {
            command: 'copy-path-with-code.openFolderFiles',
            handler: (folderItem: any) => handleOpenFolderFiles(commandHandler, folderItem, editorService, notificationService)
        },

        // File Selection Commands - CRITICAL: These must be registered properly
        {
            command: 'copy-path-with-code.toggleFileSelection',
            handler: (filePath: string) => handleToggleFileSelection(treeDataProvider, filePath, notificationService)
        },
        {
            command: 'copy-path-with-code.selectAllFiles',
            handler: () => handleSelectAllFiles(treeDataProvider, notificationService)
        },
        {
            command: 'copy-path-with-code.deselectAllFiles',
            handler: () => handleDeselectAllFiles(treeDataProvider, notificationService)
        },
        {
            command: 'copy-path-with-code.selectAllFilesInFolder',
            handler: (folderItem: any) => handleSelectAllFilesInFolder(treeDataProvider, folderItem, notificationService)
        },
        {
            command: 'copy-path-with-code.unselectAllFilesInFolder',
            handler: (folderItem: any) => handleUnselectAllFilesInFolder(treeDataProvider, folderItem, notificationService)
        },

        // File Management Mode Commands
        {
            command: 'copy-path-with-code.confirmFileManagement',
            handler: () => handleConfirmFileManagement(commandHandler, treeDataProvider, workspaceService, notificationService)
        },
        {
            command: 'copy-path-with-code.cancelFileManagement',
            handler: () => handleCancelFileManagement(treeDataProvider, notificationService)
        }
    ];

    // Register all commands using CommandRegistry
    commands.forEach(({ command, handler }) => {
        CommandRegistry.registerCommand(context, command, handler);
    });
}

// =============================================
// FILE SELECTION HANDLERS - FIXED VERSIONS
// =============================================

function handleToggleFileSelection(
    treeDataProvider: FolderProvider,
    filePath: string,
    notificationService: INotificationService
): void {
    if (!filePath) {
        notificationService.showError('Invalid file path for selection');
        return;
    }

    // Toggle selection WITHOUT refreshing the tree to prevent collapse
    treeDataProvider.toggleFileSelection(filePath);

    // Show feedback without triggering tree refresh
    const selectedCount = treeDataProvider.getSelectedFiles().length;

    // Use status bar or minimal notification instead of full notification
    console.log(`File selection toggled: ${filePath} (${selectedCount} files selected)`);

    // Optional: Show a brief status message that doesn't interfere
    if (selectedCount === 1) {
        // Only show message for first selection
        notificationService.showInfo(`${selectedCount} file selected`);
    }
}

function handleSelectAllFiles(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): void {
    const previousCount = treeDataProvider.getSelectedFiles().length;
    treeDataProvider.selectAllFiles();
    const newCount = treeDataProvider.getSelectedFiles().length;
    const addedCount = newCount - previousCount;

    if (addedCount > 0) {
        notificationService.showInfo(`Selected ${addedCount} additional files (${newCount} total)`);
    } else {
        notificationService.showInfo('All files are already selected');
    }
}

function handleDeselectAllFiles(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): void {
    const previousCount = treeDataProvider.getSelectedFiles().length;
    treeDataProvider.deselectAllFiles();

    if (previousCount > 0) {
        notificationService.showInfo(`Deselected ${previousCount} files`);
    } else {
        notificationService.showInfo('No files were selected');
    }
}

// =============================================
// EXISTING HANDLERS - UNCHANGED
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
    notificationService.showInfo('Adding files to folder. Click files to select/deselect them, then click "Confirm Add Selected".');
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
    notificationService.showInfo('Removing files from folder. Click files to select/deselect them, then click "Confirm Remove Selected".');
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