// FILE: src/commands/folder/FileManagementCommands.ts - FIXED VERSION
// Fix for selectAllFilesInFolder command receiving wrong folder ID

import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { FolderProvider } from '../../providers/FolderProvider';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IEditorService } from '../../infrastructure/folder/ui/EditorService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';
import { FolderService } from '../../domain/folder/services/FolderService';
import { Logger } from '../../utils/common/logger';

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

async function handleSelectAllFiles(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): Promise<void> {
    try {
        const previousCount = treeDataProvider.getSelectedFiles().length;
        await treeDataProvider.selectAllFiles();
        const newCount = treeDataProvider.getSelectedFiles().length;
        const addedCount = newCount - previousCount;

        if (addedCount > 0) {
            notificationService.showInfo(`Selected ${addedCount} additional files (${newCount} total)`);
        } else {
            notificationService.showInfo('All files are already selected');
        }
    } catch (error) {
        Logger.error('Error in handleSelectAllFiles:', error);
        notificationService.showError(`Failed to select all files: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
// FIXED: Folder Selection Handlers
// =============================================

function handleSelectAllFilesInFolder(
    treeDataProvider: FolderProvider,
    folderItem: any,
    notificationService: INotificationService
): void {
    try {
        Logger.debug('=== START handleSelectAllFilesInFolder ===');
        Logger.debug('folderItem received:', {
            label: folderItem?.label,
            id: folderItem?.id,
            folderId: folderItem?.folderId,
            treeNode: folderItem?.treeNode ? {
                name: folderItem.treeNode.name,
                path: folderItem.treeNode.path,
                isFile: folderItem.treeNode.isFile,
                isDirectory: folderItem.treeNode.isDirectory
            } : null,
            contextValue: folderItem?.contextValue
        });

        // ENHANCED: Multiple strategies to get correct folder ID
        const fileManagementState = treeDataProvider.getFileManagementState();
        Logger.debug('File management state:', {
            mode: fileManagementState.mode,
            folderId: fileManagementState.folderId,
            selectedFilesCount: fileManagementState.selectedFiles.size
        });

        let folderId: string | null = null;
        let targetDirectoryPath: string | null = null;

        // Strategy 1: Get from file management state (most reliable for main folder)
        if (fileManagementState.folderId) {
            folderId = fileManagementState.folderId;
            Logger.debug(`Strategy 1: Got folder ID from file management state: ${folderId}`);
        }

        // Strategy 2: Try to extract directory path from folderItem for subdirectories
        if (folderItem?.treeNode) {
            if (folderItem.treeNode.isDirectory) {
                targetDirectoryPath = folderItem.treeNode.path;
                Logger.debug(`Strategy 2: Got directory path from treeNode: ${targetDirectoryPath}`);
            }
        }

        // Strategy 3: Try to extract from folderItem properties
        if (!folderId && folderItem) {
            if (folderItem.folderId) {
                folderId = folderItem.folderId;
                Logger.debug(`Strategy 3: Got folder ID from folderItem.folderId: ${folderId}`);
            } else if (folderItem.id && !folderItem.id.includes('-add') && !folderItem.id.includes('-remove')) {
                folderId = folderItem.id;
                Logger.debug(`Strategy 4: Got folder ID from folderItem.id: ${folderId}`);
            }
        }

        if (!folderId) {
            Logger.error('No valid folder ID found for selectAllFilesInFolder');
            notificationService.showError('No active file management operation or invalid folder selection');
            return;
        }

        // Validate folder exists before proceeding
        const container = ServiceContainer.getInstance();
        const folderService = container.resolve<FolderService>('FolderService');

        try {
            const folder = folderService.getFolderById(folderId);
            Logger.debug(`Folder validation successful: ${folder.name} with ${folder.fileCount} files`);

            // NEW: If we have a target directory path, log the files that should be selected
            if (targetDirectoryPath) {
                Logger.debug(`Looking for files in directory: ${targetDirectoryPath}`);
                const filesInDirectory = folder.files.filter(uri => {
                    try {
                        const relativePath = vscode.workspace.asRelativePath(vscode.Uri.parse(uri));
                        return relativePath.startsWith(targetDirectoryPath + '/') ||
                            relativePath === targetDirectoryPath;
                    } catch (error) {
                        return false;
                    }
                });
                Logger.debug(`Found ${filesInDirectory.length} files in target directory`);
                filesInDirectory.forEach((uri, index) => {
                    Logger.debug(`File ${index + 1} in directory: ${uri}`);
                });
            }

        } catch (validationError) {
            Logger.error(`Folder validation failed for ID: ${folderId}`, validationError);
            notificationService.showError(`Folder not found. Please refresh and try again.`);
            return;
        }

        // ENHANCED: Pass directory path to the selection method
        if (folderId === null) {
            Logger.error('folderId is null, cannot select files');
            notificationService.showError('Invalid folder selection');
            return;
        }

        const selectedCount = treeDataProvider.selectAllFilesInFolder(folderId, targetDirectoryPath || undefined);

        if (selectedCount > 0) {
            const locationInfo = targetDirectoryPath ? ` in directory "${targetDirectoryPath}"` : ' in current folder';
            notificationService.showInfo(`Selected ${selectedCount} files${locationInfo}`);
        } else {
            const locationInfo = targetDirectoryPath ? ` in directory "${targetDirectoryPath}"` : ' in this folder';
            notificationService.showInfo(`No files found to select${locationInfo}`);
        }

        Logger.debug('=== END handleSelectAllFilesInFolder ===');

    } catch (error) {
        Logger.error('Error in handleSelectAllFilesInFolder:', error);
        notificationService.showError(`Failed to select files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function handleUnselectAllFilesInFolder(
    treeDataProvider: FolderProvider,
    folderItem: any,
    notificationService: INotificationService
): void {
    try {
        // ENHANCED: Multiple strategies to get correct folder ID
        const fileManagementState = treeDataProvider.getFileManagementState();

        let folderId: string | null = null;

        // Strategy 1: Get from file management state (most reliable)
        if (fileManagementState.folderId) {
            folderId = fileManagementState.folderId;
            Logger.debug(`Strategy 1: Got folder ID from file management state: ${folderId}`);
        }

        // Strategy 2: Try to extract from folderItem if state is missing
        if (!folderId && folderItem) {
            if (folderItem.folderId) {
                folderId = folderItem.folderId;
                Logger.debug(`Strategy 2: Got folder ID from folderItem.folderId: ${folderId}`);
            } else if (folderItem.id && !folderItem.id.includes('-add') && !folderItem.id.includes('-remove')) {
                folderId = folderItem.id;
                Logger.debug(`Strategy 3: Got folder ID from folderItem.id: ${folderId}`);
            }
        }

        if (!folderId) {
            Logger.error('No valid folder ID found for unselectAllFilesInFolder');
            notificationService.showError('No active file management operation or invalid folder selection');
            return;
        }

        // Validate folder exists before proceeding
        const container = ServiceContainer.getInstance();
        const folderService = container.resolve<FolderService>('FolderService');

        try {
            const folder = folderService.getFolderById(folderId);
            Logger.debug(`Folder validation successful: ${folder.name} with ${folder.fileCount} files`);
        } catch (validationError) {
            Logger.error(`Folder validation failed for ID: ${folderId}`, validationError);
            notificationService.showError(`Folder not found. Please refresh and try again.`);
            return;
        }

        const unselectedCount = treeDataProvider.unselectAllFilesInFolder(folderId);
        if (unselectedCount > 0) {
            notificationService.showInfo(`Unselected ${unselectedCount} files in current folder`);
        } else {
            notificationService.showInfo('No files were selected to unselect');
        }

    } catch (error) {
        Logger.error('Error in handleUnselectAllFilesInFolder:', error);
        notificationService.showError(`Failed to unselect files: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // ENHANCED: Different message for folders with existing files
    const container = ServiceContainer.getInstance();
    const folderService = container.resolve<FolderService>('FolderService');

    try {
        const folder = folderService.getFolderById(folderId);

        if (folder.fileCount > 0) {
            notificationService.showInfo(
                `Managing files in "${folder.name}". ` +
                `${folder.fileCount} existing files are pre-selected. ` +
                `Uncheck files to remove them, check new files to add them, then click "Confirm".`
            );
        } else {
            notificationService.showInfo(
                'Adding files to folder. Click files to select them, then click "Confirm Add Selected".'
            );
        }
    } catch (error) {
        notificationService.showInfo('Adding files to folder. Click files to select/deselect them, then click "Confirm Add Selected".');
    }
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

    // UPDATED: Clear message for remove mode
    notificationService.showInfo(
        'Removing files from folder. Select the files you want to REMOVE (they start unselected), then click "Confirm Remove Selected".'
    );
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

    // UPDATED: Different validation for different modes
    if (selectedFiles.length === 0) {
        if (managementState.mode === 'add') {
            // For add mode: allow empty selection to remove all files
            const choice = await notificationService.showConfirmDialog(
                'No files selected. This will remove all files from the folder. Continue?',
                'Remove All',
                'Cancel'
            );

            if (choice !== 'Remove All') {
                return;
            }
        } else {
            // For remove mode: no files selected means no files to remove
            notificationService.showWarning('No files selected to remove from folder');
            return;
        }
    }

    // Convert relative paths to URIs
    const currentWorkspace = workspaceService.getCurrentWorkspaceFolder();
    if (!currentWorkspace) {
        notificationService.showError('No active workspace found');
        return;
    }

    const selectedUris = selectedFiles.map(relativePath => {
        const absolutePath = path.resolve(currentWorkspace, relativePath);
        return vscode.Uri.file(absolutePath).toString();
    });

    try {
        if (managementState.mode === 'add') {
            await commandHandler.handleAddFilesToFolder({
                folderId: managementState.folderId,
                fileUris: selectedUris,
                validateFiles: true,
                mode: 'sync'
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