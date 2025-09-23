/**
 * FILE: src/commands/folder/FolderCommands.ts - UPDATED VERSION with Custom Expand Logic
 * 
 * FOLDER COMMANDS - Fixed expand functionality with working strategies
 */

import * as vscode from 'vscode';
import { IFolderTreeService, ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { FolderProvider } from '../../providers/FolderProvider';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IEditorService } from '../../infrastructure/folder/ui/EditorService';
import { FolderService } from '../../domain/folder/services/FolderService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';
import { Logger } from '../../utils/common/logger';
import { FileNode } from '../../domain/folder/entities/FileNode';

// Store tree view references for expand/collapse operations
let folderTreeView: vscode.TreeView<vscode.TreeItem> | undefined;

// Function to set tree view reference from extension.ts
export function setFolderTreeView(treeView: vscode.TreeView<vscode.TreeItem>): void {
    folderTreeView = treeView;
}

export function registerFolderCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const commandHandler = container.resolve<FolderApplicationService>('FolderApplicationService');
    const treeDataProvider = container.resolve<FolderProvider>('FolderProvider');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const editorService = container.resolve<IEditorService>('IEditorService');
    const folderService = container.resolve<FolderService>('FolderService');

    // Original folder commands + Enhanced action button commands
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
        // FIXED: Enhanced action button commands with working expand logic
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
}

// =============================================
// ORIGINAL FOLDER COMMAND HANDLERS (unchanged)
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
// FIXED: Custom Expand Logic that Actually Works
// =============================================

async function handleExpandFolder(
    folderItem: any,
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): Promise<void> {
    const startTime = Date.now();

    try {
        const folderId = folderItem?.id || folderItem?.folderId;
        if (!folderId) {
            Logger.error('handleExpandFolder: Invalid folder selection - no folderId');
            notificationService.showError('Invalid folder selection');
            return;
        }

        // Get folder data
        const container = ServiceContainer.getInstance();
        const folderService = container.resolve<FolderService>('FolderService');
        const folderTreeService = container.resolve<IFolderTreeService>('IFolderTreeService');

        const folder = folderService.getFolderById(folderId);

        if (!folderTreeView) {
            Logger.error('TreeView is not available');
            notificationService.showError('TreeView not available. Try refreshing the extension.');
            return;
        }

        // STRATEGY 1: Custom recursive expansion using reveal with expand levels
        try {
            // Focus the folder manager view first
            await vscode.commands.executeCommand('workbench.view.extension.copy-path-with-code-folders');
            await sleep(200);

            // Reveal the main folder with deep expansion
            await folderTreeView.reveal(folderItem, {
                select: true,
                focus: true,
                expand: 10 // Try to expand up to 10 levels deep
            });
            await sleep(300);

            // Now recursively expand all subdirectories
            await expandAllDirectoriesRecursively(folderItem, treeDataProvider, folderTreeView);
            notificationService.showInfo(`Expanded all directories in "${folder.name}"`);
            return;

        } catch (error) {
            Logger.warn(`Strategy 1 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // STRATEGY 2: Multiple list.expand commands
        try {
            // Focus and select the folder
            await folderTreeView.reveal(folderItem, {
                select: true,
                focus: true,
                expand: 1
            });
            await sleep(150);

            // Execute multiple expand commands to expand more levels
            for (let i = 0; i < 5; i++) {
                try {
                    await vscode.commands.executeCommand('list.expand');
                    await sleep(100);
                } catch (expandError) {
                    break;
                }
            }

            notificationService.showInfo(`Expanded multiple levels in "${folder.name}"`);
            return;

        } catch (error) {
            Logger.warn(`Strategy 2 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // STRATEGY 3: Force expansion through cache manipulation
        try {
            // Clear cache to force fresh rendering
            treeDataProvider.clearCache();

            // Trigger a refresh with the folder selected
            await folderTreeView.reveal(folderItem, {
                select: true,
                focus: true,
                expand: true
            });

            // Refresh the tree
            treeDataProvider.refresh();
            await sleep(200);

            notificationService.showInfo(`Refreshed and expanded "${folder.name}"`);
            return;

        } catch (error) {
            Logger.warn(`Strategy 3 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // ALL STRATEGIES FAILED
        Logger.error(`ALL EXPANSION STRATEGIES FAILED for folder: ${folderId}`);
        Logger.error(`Total time spent: ${Date.now() - startTime}ms`);

        notificationService.showWarning(
            `Could not fully expand all directories in "${folder.name}". ` +
            `Some directories may be expanded. You can manually click on folder icons to expand them further.`
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error(`CRITICAL ERROR in handleExpandFolder: ${errorMessage}`, error);
        notificationService.showError(`Failed to expand folder: ${errorMessage}`);
    }
}

// CUSTOM: Recursive expansion function that works with our tree structure
async function expandAllDirectoriesRecursively(
    parentItem: vscode.TreeItem,
    treeDataProvider: FolderProvider,
    treeView: vscode.TreeView<vscode.TreeItem>,
    currentDepth: number = 0,
    maxDepth: number = 10
): Promise<void> {
    if (currentDepth >= maxDepth) {
        return;
    }

    try {
        // Get children of the current item
        const children = await treeDataProvider.getChildren(parentItem);

        // Process each child
        for (const child of children) {
            const childAny = child as any;

            // If this child is a directory, expand it recursively
            if (childAny.treeNode && childAny.treeNode.isDirectory) {
                try {

                    // Reveal and expand this directory
                    await treeView.reveal(child, {
                        select: false,
                        focus: false,
                        expand: Math.min(3, maxDepth - currentDepth) // Dynamic expand level
                    });
                    await sleep(50);

                    // Recursively expand its children
                    await expandAllDirectoriesRecursively(
                        child,
                        treeDataProvider,
                        treeView,
                        currentDepth + 1,
                        maxDepth
                    );


                } catch (expandError) {
                    Logger.warn(`Failed to expand directory: ${childAny.treeNode?.name}`, expandError);
                    // Continue with other directories
                }
            }
        }


    } catch (error) {
        Logger.warn(`Error during recursive directory expansion at depth ${currentDepth}`, error);
    }
}

async function handleCollapseFolder(
    folderItem: any,
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): Promise<void> {
    const startTime = Date.now();

    try {
        const folderId = folderItem?.id || folderItem?.folderId;
        if (!folderId) {
            Logger.error('handleCollapseFolder: Invalid folder selection');
            notificationService.showError('Invalid folder selection');
            return;
        }


        if (!folderTreeView) {
            Logger.error('TreeView not available for collapse operation');
            notificationService.showError('TreeView not available');
            return;
        }

        // Focus view and collapse
        await vscode.commands.executeCommand('workbench.view.extension.copy-path-with-code-folders');
        await sleep(150);

        // Select the folder and collapse it completely
        await folderTreeView.reveal(folderItem, {
            select: true,
            focus: true,
            expand: false // This should collapse it
        });
        await sleep(100);

        // Clear cache and refresh to ensure collapsed state
        treeDataProvider.clearCache();
        treeDataProvider.refresh();
        await sleep(50);

        notificationService.showInfo('Folder collapsed');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error(`Collapse failed: ${errorMessage}`, error);
        notificationService.showError(`Failed to collapse folder: ${errorMessage}`);
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

    } catch (error) {
        Logger.error('Failed to quick rename folder', error);
        notificationService.showError(`Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}