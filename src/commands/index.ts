/**
 * FILE: src/commands/index.ts
 * 
 * COMMANDS INDEX - Simplified command registration
 * Fixed to prevent "An object could not be cloned" error
 */

import * as vscode from 'vscode';
import { FolderProvider } from '../providers/FolderProvider';
import { ClipboardProvider } from '../providers/ClipboardProvider';
import { ServiceContainer } from '../infrastructure/di/ServiceContainer';
import { CommandRegistry } from '../utils/common/CommandRegistry';
import { Logger } from '../utils/common/logger';

// Import command modules
import { registerCoreCommands } from './clipboard/coreCommands';
import { registerTempClipboardCommands } from './clipboard/tempClipboardCommands';
import { registerFolderCommands } from './folder/FolderCommands';
import { registerFileManagementCommands } from './folder/FileManagementCommands';
import { registerViewCommands } from './folder/ViewCommands';
import { registerDirectoryCommands } from './folder/directoryCommands';
import { registerFolderMenuCommands } from './folder/FolderMenuCommands';
import { registerContextMenuCommands } from './clipboard/contextMenuCommands';

export function registerAllCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderProvider,
    clipboardProvider: ClipboardProvider
): void {
    try {
        Logger.info('Starting command registration');

        // Clear any existing registrations to start fresh
        CommandRegistry.clear();

        // Register core clipboard commands first (these are the main keyboard shortcuts)
        registerCoreCommands(context);
        Logger.debug('Core clipboard commands registered');

        // Register temp clipboard commands
        registerTempClipboardCommands(context);
        Logger.debug('Temp clipboard commands registered');

        // Register context menu commands
        registerContextMenuCommands(context);
        Logger.debug('Context menu commands registered');

        // Register critical commands that are referenced immediately
        registerCriticalCommands(context, treeDataProvider);
        Logger.debug('Critical commands registered');

        // Register command modules
        registerFolderCommands(context);
        registerFileManagementCommands(context);
        registerViewCommands(context);
        registerDirectoryCommands(context, treeDataProvider);
        registerFolderMenuCommands(context);

        // Register additional commands
        registerMainApplicationCommands(context, treeDataProvider, clipboardProvider);
        registerClipboardCommands(context, clipboardProvider);

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
    // Register refreshFolderView - this is called immediately after extension activation
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.refreshFolderView',
        () => {
            treeDataProvider.refresh();
            Logger.debug('Folder view refreshed');
        }
    );

    // Register clipboard view refresh command (essential for UI updates)
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.refreshClipboardView',
        () => {
            // Simple function that doesn't reference complex objects
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', false);
            Logger.debug('Clipboard view refresh command executed');
        }
    );

    // Register toggleViewMode - this is referenced in critical flow
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.toggleViewMode',
        () => handleToggleViewMode(treeDataProvider)
    );

    Logger.debug('Critical commands registered');
}

// Main application commands with simplified implementations
function registerMainApplicationCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderProvider,
    clipboardProvider: ClipboardProvider
): void {

    // Individual file copy from tree
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyIndividualFile',
        (fileItem) => {
            // Handle copying individual file from tree view
            if (fileItem?.resourceUri) {
                // Use a simple approach instead of complex command chaining
                const uri = fileItem.resourceUri;
                vscode.window.showTextDocument(uri).then(() => {
                    // After opening, execute the copy command
                    vscode.commands.executeCommand('copy-path-with-code.copyPathWithContent');
                });
            }
        }
    );

    // Show logs command
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.showLogs',
        () => {
            Logger.show();
        }
    );
}

// Clipboard management commands with simplified implementations
function registerClipboardCommands(
    context: vscode.ExtensionContext,
    clipboardProvider: ClipboardProvider
): void {

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.toggleClipboardDetection',
        () => {
            // Simple toggle implementation
            const { state } = require('../models/models');
            state.isClipboardDetectionEnabled = !state.isClipboardDetectionEnabled;
            const status = state.isClipboardDetectionEnabled ? 'enabled' : 'disabled';
            vscode.window.showInformationMessage(`Clipboard detection ${status}`);
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
}

// Simplified toggle view mode handler
function handleToggleViewMode(treeDataProvider: FolderProvider): void {
    try {
        const currentMode = treeDataProvider.getViewMode();
        const newMode = currentMode === 'workspace' ? 'global' : 'workspace';

        // Simple validation
        if (newMode === 'workspace' && !vscode.workspace.workspaceFolders?.length) {
            vscode.window.showWarningMessage(
                'Cannot switch to workspace view: no active workspace found. Please open a folder or workspace first.',
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
        vscode.window.showInformationMessage(`View mode: ${modeDisplay}`);

    } catch (error) {
        Logger.error('Failed to toggle view mode', error);
        vscode.window.showErrorMessage('Failed to toggle view mode');
    }
}