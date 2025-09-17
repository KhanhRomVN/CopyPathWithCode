/**
 * FILE: src/commands/folder/FolderCommands.ts
 * 
 * FOLDER COMMANDS - Basic folder operations
 * 
 * Handles core folder management operations:
 * - Create folder
 * - Delete folder  
 * - Rename folder
 */

import * as vscode from 'vscode';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { FolderProvider } from '../../providers/FolderProvider';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IEditorService } from '../../infrastructure/folder/ui/EditorService';

export function registerFolderCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const commandHandler = container.resolve<FolderApplicationService>('FolderApplicationService');
    const treeDataProvider = container.resolve<FolderProvider>('FolderProvider');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const editorService = container.resolve<IEditorService>('IEditorService');

    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.createFolder', () =>
            handleCreateFolder(commandHandler, treeDataProvider, workspaceService, editorService, notificationService)
        ),

        vscode.commands.registerCommand('copy-path-with-code.deleteFolder', (folderItem) =>
            handleDeleteFolder(commandHandler, folderItem, notificationService)
        ),

        vscode.commands.registerCommand('copy-path-with-code.renameFolder', (folderItem) =>
            handleRenameFolder(commandHandler, folderItem, notificationService)
        )
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

// =============================================
// FOLDER COMMAND HANDLERS
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