/**
 * FILE: src/commands/folder/FolderCommands.ts - UPDATED
 * 
 * FOLDER COMMANDS - Basic folder operations + Enhanced Action Buttons
 * 
 * Handles core folder management operations:
 * - Create folder
 * - Delete folder  
 * - Rename folder
 * - NEW: Expand folder (action button)
 * - NEW: Collapse folder (action button)
 * - NEW: Copy folder content (action button)
 * - NEW: Quick rename (F2 shortcut)
 */

import * as vscode from 'vscode';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { FolderProvider } from '../../providers/FolderProvider';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IEditorService } from '../../infrastructure/folder/ui/EditorService';
import { FolderService } from '../../domain/folder/services/FolderService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';
import { Logger } from '../../utils/common/logger';

export function registerFolderCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const commandHandler = container.resolve<FolderApplicationService>('FolderApplicationService');
    const treeDataProvider = container.resolve<FolderProvider>('FolderProvider');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const editorService = container.resolve<IEditorService>('IEditorService');
    const folderService = container.resolve<FolderService>('FolderService');

    // Original folder commands
    const commands = [
        {
            command: 'copy-path-with-code.createFolder',
            handler: () => handleCreateFolder(commandHandler, treeDataProvider, workspaceService, editorService, notificationService)
        },
        {
            command: 'copy-path-with-code.deleteFolder',
            handler: (folderItem: any) => handleDeleteFolder(commandHandler, folderItem, notificationService)
        },
        {
            command: 'copy-path-with-code.renameFolder',
            handler: (folderItem: any) => handleRenameFolder(commandHandler, folderItem, notificationService)
        },
        // NEW: Enhanced action button commands
        {
            command: 'copy-path-with-code.expandFolder',
            handler: (folderItem: any) => handleExpandFolder(folderItem, treeDataProvider, notificationService)
        },
        {
            command: 'copy-path-with-code.collapseFolder',
            handler: (folderItem: any) => handleCollapseFolder(folderItem, treeDataProvider, notificationService)
        },
        {
            command: 'copy-path-with-code.copyFolderContent',
            handler: (folderItem: any) => handleCopyFolderContent(folderItem, notificationService)
        },
        {
            command: 'copy-path-with-code.renameFolderQuick',
            handler: (folderItem: any) => handleRenameFolderQuick(folderItem, commandHandler, notificationService, folderService)
        }
    ];

    // Register all commands using CommandRegistry
    commands.forEach(({ command, handler }) => {
        CommandRegistry.registerCommand(context, command, handler);
    });

    Logger.debug('Folder commands registered with enhanced action buttons');
}

// =============================================
// ORIGINAL FOLDER COMMAND HANDLERS
// =============================================

async function handleCreateFolder(
    commandHandler: FolderApplicationService,
    treeDataProvider: FolderProvider,
    workspaceService: IWorkspaceService,
    editorService: IEditorService,
    notificationService: INotificationService
): Promise<void> {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        notificationService.showWarning('Cannot create folders in global view. Switch to workspace view.');
        return;
    }

    // Check if workspace is available
    if (!workspaceService.hasActiveWorkspace()) {
        const choice = await notificationService.showConfirmDialog(
            'Cannot create folders without an active workspace. Please open a folder or workspace first.',
            'Open Folder'
        );
        if (choice === 'Open Folder') {
            vscode.commands.executeCommand('workbench.action.files.openFolder');
        }
        return;
    }

    // Exit file management mode if active
    if (treeDataProvider.isInFileManagementMode()) {
        treeDataProvider.exitFileManagementMode();
    }

    // Get folder name
    const name = await vscode.window.showInputBox({
        prompt: 'Enter folder name',
        placeHolder: 'My Code Folder',
        title: 'Create New Folder',
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Folder name cannot be empty';
            }
            if (value.length > 100) {
                return 'Folder name cannot exceed 100 characters';
            }
            if (/[<>:"/\\|?*]/.test(value)) {
                return 'Folder name contains forbidden characters: < > : " / \\ | ? *';
            }
            return null;
        }
    });

    if (!name) return;

    // Get open file editors
    const openFileUris = editorService.getOpenEditors();

    // Give user choice about including files
    const options = [
        {
            label: 'Create empty folder',
            description: 'Start with an empty folder'
        },
        {
            label: `Add ${openFileUris.length} open file${openFileUris.length !== 1 ? 's' : ''}`,
            description: 'Include currently open files'
        }
    ];

    const choice = await vscode.window.showQuickPick(options, {
        placeHolder: 'Include files in folder?',
        title: `Creating folder "${name}"`
    });

    if (!choice) return;

    const includeOpenFiles = choice.label.includes('Add');
    const currentWorkspace = workspaceService.getCurrentWorkspaceFolder();

    await commandHandler.handleCreateFolder({
        name: name.trim(),
        workspaceFolder: currentWorkspace,
        includeOpenFiles,
        openFileUris: includeOpenFiles ? openFileUris : []
    });
}

async function handleDeleteFolder(
    commandHandler: FolderApplicationService,
    folderItem: any,
    notificationService: INotificationService
): Promise<void> {
    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    const confirmChoice = await notificationService.showConfirmDialog(
        `Are you sure you want to delete this folder? This action cannot be undone.`,
        'Delete',
        'Cancel'
    );

    if (confirmChoice === 'Delete') {
        await commandHandler.handleDeleteFolder({
            folderId,
            confirmDelete: true
        });
    }
}

async function handleRenameFolder(
    commandHandler: FolderApplicationService,
    folderItem: any,
    notificationService: INotificationService
): Promise<void> {
    const folderId = folderItem?.id || folderItem?.folderId;
    if (!folderId) {
        notificationService.showError('Invalid folder selection');
        return;
    }

    const newName = await vscode.window.showInputBox({
        prompt: 'Enter new folder name',
        title: 'Rename Folder',
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Folder name cannot be empty';
            }
            if (value.length > 100) {
                return 'Folder name cannot exceed 100 characters';
            }
            if (/[<>:"/\\|?*]/.test(value)) {
                return 'Folder name contains forbidden characters: < > : " / \\ | ? *';
            }
            return null;
        }
    });

    if (newName) {
        await commandHandler.handleRenameFolder({
            folderId,
            newName: newName.trim()
        });
    }
}

// =============================================
// NEW: ENHANCED ACTION BUTTON HANDLERS
// =============================================

async function handleExpandFolder(
    folderItem: any,
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): Promise<void> {
    try {
        const folderId = folderItem?.id || folderItem?.folderId;
        if (!folderId) {
            notificationService.showError('Invalid folder selection');
            return;
        }

        // Clear cache to ensure fresh data and refresh
        treeDataProvider.clearCache();
        treeDataProvider.refresh();

        notificationService.showInfo('Folder expanded');
        Logger.debug(`Expanded folder: ${folderId}`);

    } catch (error) {
        Logger.error('Failed to expand folder', error);
        notificationService.showError(`Failed to expand folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function handleCollapseFolder(
    folderItem: any,
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): Promise<void> {
    try {
        const folderId = folderItem?.id || folderItem?.folderId;
        if (!folderId) {
            notificationService.showError('Invalid folder selection');
            return;
        }

        // Use VS Code's built-in collapse functionality
        await vscode.commands.executeCommand('list.collapse');

        // Also refresh tree to reset state
        treeDataProvider.clearCache();
        treeDataProvider.refresh();

        notificationService.showInfo('Folder collapsed');
        Logger.debug(`Collapsed folder: ${folderId}`);

    } catch (error) {
        Logger.error('Failed to collapse folder', error);
        notificationService.showError(`Failed to collapse folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function handleCopyFolderContent(
    folderItem: any,
    notificationService: INotificationService
): Promise<void> {
    try {
        const folderId = folderItem?.id || folderItem?.folderId;
        if (!folderId) {
            notificationService.showError('Invalid folder selection');
            return;
        }

        // Delegate to existing copyFolderContents command
        await vscode.commands.executeCommand('copy-path-with-code.copyFolderContents', folderItem);

        Logger.debug(`Quick copied folder content: ${folderId}`);

    } catch (error) {
        Logger.error('Failed to copy folder content', error);
        notificationService.showError(`Failed to copy folder content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function handleRenameFolderQuick(
    folderItem: any,
    commandHandler: FolderApplicationService,
    notificationService: INotificationService,
    folderService: FolderService
): Promise<void> {
    try {
        const folderId = folderItem?.id || folderItem?.folderId;
        if (!folderId) {
            notificationService.showError('Invalid folder selection');
            return;
        }

        const folder = folderService.getFolderById(folderId);

        const newName = await vscode.window.showInputBox({
            prompt: `Rename folder "${folder.name}"`,
            value: folder.name,
            title: 'Quick Rename Folder (F2)',
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Folder name cannot be empty';
                }
                if (value.length > 100) {
                    return 'Folder name cannot exceed 100 characters';
                }
                if (/[<>:"/\\|?*]/.test(value)) {
                    return 'Folder name contains forbidden characters: < > : " / \\ | ? *';
                }
                if (value === folder.name) {
                    return 'Please enter a different name';
                }
                return null;
            }
        });

        if (!newName) {
            return; // User cancelled
        }

        // Use the existing command handler
        await commandHandler.handleRenameFolder({
            folderId,
            newName: newName.trim()
        });

        Logger.debug(`Quick renamed folder ${folder.name} to ${newName}`);

    } catch (error) {
        Logger.error('Failed to quick rename folder', error);
        notificationService.showError(`Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}