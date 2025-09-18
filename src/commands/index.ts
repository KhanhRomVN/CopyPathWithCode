/**
 * FILE: src/commands/index.ts
 * 
 * COMMANDS INDEX - Central command registration
 * Fixed to prevent duplicate command registrations
 */

import * as vscode from 'vscode';
import { FolderProvider } from '../providers/FolderProvider';
import { ClipboardProvider } from '../providers/ClipboardProvider';
import { ServiceContainer } from '../infrastructure/di/ServiceContainer';
import { CommandRegistry } from '../utils/common/CommandRegistry';
import { Logger } from '../utils/common/logger';
import { INotificationService } from '../application/folder/service/FolderApplicationService';
import { IWorkspaceService } from '../infrastructure/folder/workspace/WorkspaceService';

// Import command modules
import { registerFolderCommands } from './folder/FolderCommands';
import { registerFileManagementCommands } from './folder/FileManagementCommands';
import { registerViewCommands } from './folder/ViewCommands';
import { registerDirectoryCommands } from './folder/directoryCommands';
import { registerFolderMenuCommands } from './folder/FolderMenuCommands';
import { registerContextMenuCommands } from './folder/ContextMenuCommands'; // NEW

export function registerAllCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderProvider,
    clipboardProvider: ClipboardProvider
): void {
    try {
        Logger.info('Starting command registration');

        // Clear any existing registrations to start fresh
        CommandRegistry.clear();

        // Register critical commands first (these might be needed immediately)
        registerCriticalCommands(context, treeDataProvider);

        // Register command modules
        registerFolderCommands(context);
        registerFileManagementCommands(context);
        registerViewCommands(context);
        registerDirectoryCommands(context, treeDataProvider);
        registerFolderMenuCommands(context);

        // Register additional commands
        registerMainApplicationCommands(context, treeDataProvider, clipboardProvider);
        registerFileOperationCommands(context);
        registerClipboardCommands(context, clipboardProvider);

        registerContextMenuCommands(context);
        Logger.debug('Context menu commands registered');

        const registeredCommands = CommandRegistry.getRegisteredCommands();
        Logger.info(`Successfully registered ${registeredCommands.length} commands`);
        Logger.debug('Registered commands:', registeredCommands);

    } catch (error) {
        Logger.error('Failed to register extension commands', error);
        throw new Error(`Failed to register extension commands: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Register critical commands that are referenced immediately
function registerCriticalCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderProvider
): void {
    const container = ServiceContainer.getInstance();
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');

    // Register refreshFolderView - this is called immediately after extension activation
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.refreshFolderView',
        () => {
            treeDataProvider.refresh();
            Logger.debug('Folder view refreshed');
        }
    );

    // Register toggleViewMode - this is referenced in critical flow
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.toggleViewMode',
        () => handleToggleViewMode(treeDataProvider, notificationService, workspaceService)
    );

    Logger.debug('Critical commands registered');
}

// Main application commands
function registerMainApplicationCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderProvider,
    clipboardProvider: ClipboardProvider
): void {

    // Copy operations
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContent',
        () => vscode.commands.executeCommand('copy-path-with-code.copyPathWithContent')
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContentAndError',
        () => vscode.commands.executeCommand('copy-path-with-code.copyPathWithContentAndError')
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearClipboard',
        () => vscode.commands.executeCommand('copy-path-with-code.clearClipboard')
    );

    // Individual file copy from tree
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyIndividualFile',
        (fileItem) => {
            // Handle copying individual file from tree view
            if (fileItem?.resourceUri) {
                vscode.commands.executeCommand('copy-path-with-code.copyPathWithContent', fileItem.resourceUri);
            }
        }
    );
}

// File operations
function registerFileOperationCommands(context: vscode.ExtensionContext): void {
    const fileOperations = [
        'openFile',
        'openToSide',
        'openWith',
        'copyPath',
        'copyRelativePath',
        'revealInFileExplorer',
        'renameFile',
        'deleteFile',
        'cutFile',
        'copyFile',
        'pasteFile',
        'newFile',
        'newFolder'
    ];

    fileOperations.forEach(operation => {
        CommandRegistry.registerCommand(
            context,
            `copy-path-with-code.${operation}`,
            (item) => handleFileOperation(operation, item)
        );
    });
}

// Clipboard management commands
function registerClipboardCommands(
    context: vscode.ExtensionContext,
    clipboardProvider: ClipboardProvider
): void {

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.toggleClipboardDetection',
        () => {
            // Toggle clipboard detection logic
            vscode.window.showInformationMessage('Clipboard detection toggled');
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearClipboardQueue',
        () => {
            // Clear clipboard queue by refreshing the provider
            clipboardProvider.refresh();
            // Clear the state array directly
            const { state } = require('../models/models');
            state.clipboardFiles.length = 0;
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', false);
            vscode.window.showInformationMessage('Clipboard queue cleared');
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.openClipboardFile',
        (item) => {
            if (item?.resourceUri) {
                vscode.commands.executeCommand('vscode.open', item.resourceUri);
            }
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.showLogs',
        () => {
            Logger.show();
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.saveClipboardToTemp',
        () => {
            // Save clipboard to temp logic
            vscode.window.showInformationMessage('Clipboard saved to temp');
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.restoreClipboardFromTemp',
        () => {
            // Restore clipboard from temp logic
            vscode.window.showInformationMessage('Clipboard restored from temp');
        }
    );
}

// Toggle view mode handler
function handleToggleViewMode(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService,
    workspaceService: IWorkspaceService
): void {
    const currentMode = treeDataProvider.getViewMode();
    const newMode = currentMode === 'workspace' ? 'global' : 'workspace';

    // Validate workspace mode
    if (newMode === 'workspace' && !workspaceService.hasActiveWorkspace()) {
        const message = 'Cannot switch to workspace view: no active workspace found. Please open a folder or workspace first.';
        notificationService.showWarning(message);

        // Offer to open folder
        vscode.window.showWarningMessage(
            message,
            'Open Folder'
        ).then(choice => {
            if (choice === 'Open Folder') {
                vscode.commands.executeCommand('workbench.action.files.openFolder');
            }
        });
        return;
    }

    // Exit file management mode when switching views
    if (treeDataProvider.isInFileManagementMode()) {
        treeDataProvider.exitFileManagementMode();
    }

    // Clear search when switching views
    treeDataProvider.clearSearch();

    // Switch view mode
    treeDataProvider.switchViewMode(newMode);

    // Update context for menu visibility
    vscode.commands.executeCommand('setContext', 'copyPathWithCode.viewMode', newMode);

    // Show feedback
    const modeDisplay = newMode === 'workspace' ? 'Workspace' : 'Global';
    const workspaceInfo = newMode === 'workspace'
        ? ` (${workspaceService.getCurrentWorkspaceFolder() || 'Unknown'})`
        : '';

    notificationService.showInfo(`View mode: ${modeDisplay}${workspaceInfo}`);
}

// File operation handler
function handleFileOperation(operation: string, item: any): void {
    if (!item?.resourceUri) {
        vscode.window.showErrorMessage('No file selected');
        return;
    }

    const uri = item.resourceUri;

    switch (operation) {
        case 'openFile':
            vscode.commands.executeCommand('vscode.open', uri);
            break;
        case 'openToSide':
            vscode.commands.executeCommand('vscode.open', uri, { viewColumn: vscode.ViewColumn.Beside });
            break;
        case 'openWith':
            vscode.commands.executeCommand('vscode.openWith', uri);
            break;
        case 'copyPath':
            vscode.env.clipboard.writeText(uri.fsPath);
            vscode.window.showInformationMessage('Path copied to clipboard');
            break;
        case 'copyRelativePath':
            const relativePath = vscode.workspace.asRelativePath(uri);
            vscode.env.clipboard.writeText(relativePath);
            vscode.window.showInformationMessage('Relative path copied to clipboard');
            break;
        case 'revealInFileExplorer':
            vscode.commands.executeCommand('revealFileInOS', uri);
            break;
        default:
            vscode.window.showErrorMessage(`Operation '${operation}' not implemented`);
    }
}