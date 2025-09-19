/**
 * FILE: src/commands/folder/FolderMenuCommands.ts
 * 
 * FOLDER MENU COMMANDS - Context menu operations
 * 
 * Handles folder context menu and related operations:
 * - Show folder menu
 * - Copy folder contents
 * - Folder statistics
 */

import * as vscode from 'vscode';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderApplicationService } from '../../application/folder/service/FolderApplicationService';
import { FolderProvider } from '../../providers/FolderProvider';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { FolderService } from '../../domain/folder/services/FolderService';
import { state } from '../../models/models';
import { CommandRegistry } from '../../utils/common/CommandRegistry';
import { Logger } from '../../utils/common/logger';

export function registerFolderMenuCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const commandHandler = container.resolve<FolderApplicationService>('FolderApplicationService');
    const treeDataProvider = container.resolve<FolderProvider>('FolderProvider');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const folderService = container.resolve<FolderService>('FolderService');

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.showFolderMenu',
        (folderItem) => handleShowFolderMenu(folderItem, notificationService, folderService)
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyFolderContents',
        (folderItem) => handleCopyFolderContents(folderItem, notificationService, folderService)
    );

    Logger.debug('Folder menu commands registered');
}


// =============================================
// FOLDER MENU COMMAND HANDLERS
// =============================================

async function handleShowFolderMenu(
    folderItem: any,
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

        const menuOptions = [
            {
                label: `$(folder-opened) Open Folder Files`,
                description: `Open all ${folder.fileCount} files in editor`,
                action: 'openFolderFiles'
            },
            {
                label: `$(copy) Copy Folder Contents`,
                description: 'Copy all file paths and contents to clipboard',
                action: 'copyFolderContents'
            },
            {
                label: `$(add) Add Files to Folder`,
                description: 'Select files to add to this folder',
                action: 'addFileToFolder'
            },
            {
                label: `$(remove) Remove Files from Folder`,
                description: 'Select files to remove from this folder',
                action: 'removeFileFromFolder'
            },
            {
                label: `$(edit) Rename Folder`,
                description: 'Change the folder name',
                action: 'renameFolder'
            },
            {
                label: `$(trash) Delete Folder`,
                description: 'Permanently delete this folder',
                action: 'deleteFolder'
            }
        ];

        const choice = await vscode.window.showQuickPick(menuOptions, {
            placeHolder: `Actions for "${folder.name}"`,
            title: 'Folder Menu',
            matchOnDescription: true
        });

        if (!choice) return;

        // Execute the selected action
        const commandMap: { [key: string]: string } = {
            'openFolderFiles': 'copy-path-with-code.openFolderFiles',
            'copyFolderContents': 'copy-path-with-code.copyFolderContents',
            'addFileToFolder': 'copy-path-with-code.addFileToFolder',
            'removeFileFromFolder': 'copy-path-with-code.removeFileFromFolder',
            'renameFolder': 'copy-path-with-code.renameFolder',
            'deleteFolder': 'copy-path-with-code.deleteFolder'
        };

        const command = commandMap[choice.action];
        if (command) {
            await vscode.commands.executeCommand(command, folderItem);
        }
    } catch (error) {
        notificationService.showError(
            `Failed to show folder menu: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

async function handleCopyFolderContents(
    folderItem: any,
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

        if (folder.fileCount === 0) {
            notificationService.showWarning(`Folder "${folder.name}" contains no files`);
            return;
        }

        // Show loading notification
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Copying contents of "${folder.name}"`,
            cancellable: true
        }, async (progress, token) => {
            try {
                const totalFiles = folder.fileCount;
                let processedFiles = 0;
                let clipboardContent = `Folder: ${folder.name}\n`;
                clipboardContent += `Files: ${totalFiles}\n`;
                clipboardContent += `${'='.repeat(50)}\n\n`;

                for (const fileUri of folder.files) {
                    if (token.isCancellationRequested) {
                        break;
                    }

                    try {
                        const uri = vscode.Uri.parse(fileUri);
                        const fileName = uri.fsPath.split(/[/\\]/).pop() || 'unknown';

                        // Update progress
                        processedFiles++;
                        const progressPercent = (processedFiles / totalFiles) * 100;
                        progress.report({
                            increment: (1 / totalFiles) * 100,
                            message: `Processing ${fileName} (${processedFiles}/${totalFiles})`
                        });

                        // Read file content
                        try {
                            const document = await vscode.workspace.openTextDocument(uri);
                            const content = document.getText();

                            clipboardContent += `File: ${fileName}\n`;
                            clipboardContent += `Path: ${uri.fsPath}\n`;
                            clipboardContent += `${'─'.repeat(30)}\n`;
                            clipboardContent += content;
                            clipboardContent += `\n\n${'='.repeat(50)}\n\n`;
                        } catch (fileError) {
                            clipboardContent += `File: ${fileName}\n`;
                            clipboardContent += `Path: ${uri.fsPath}\n`;
                            clipboardContent += `Error: Could not read file content\n`;
                            clipboardContent += `\n${'='.repeat(50)}\n\n`;
                        }
                    } catch (error) {
                        // Skip invalid URIs
                        continue;
                    }
                }

                if (!token.isCancellationRequested) {
                    // Copy to clipboard
                    await vscode.env.clipboard.writeText(clipboardContent);

                    // Update state for status bar
                    state.copiedFiles.push({
                        displayPath: folder.name,
                        basePath: `Folder (${folder.fileCount} files)`,
                        content: clipboardContent,
                        format: 'normal'
                    });

                    // Show status bar
                    if (state.statusBarItem) {
                        state.statusBarItem.text = `$(copy) Copied: ${folder.name} (${folder.fileCount} files)`;
                        state.statusBarItem.show();
                    }

                    notificationService.showSuccess(
                        `Copied contents of "${folder.name}" (${processedFiles} files) to clipboard`
                    );
                } else {
                    notificationService.showWarning('Copy operation was cancelled');
                }
            } catch (error) {
                notificationService.showError(
                    `Failed to copy folder contents: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        });
    } catch (error) {
        notificationService.showError(
            `Failed to copy folder contents: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}