/**
 * Updated src/commands/index.ts - TEMPORARY STORAGE REMOVED
 * Refactored clipboard commands to use clean architecture services
 * Temporary storage functionality has been completely removed
 */

import * as vscode from 'vscode';
import { FolderProvider } from '../providers/FolderProvider';
import { ClipboardProvider } from '../providers/ClipboardProvider';
import { ServiceContainer } from '../infrastructure/di/ServiceContainer';
import { CommandRegistry } from '../utils/common/CommandRegistry';
import { Logger } from '../utils/common/logger';
import { ClipboardDetector } from '../utils/clipboard/clipboardDetector';

// Import command modules
import { registerCoreCommands } from './clipboard/coreCommands';
import { registerFolderCommands } from './folder/FolderCommands';
import { registerFileManagementCommands } from './folder/FileManagementCommands';
import { registerViewCommands } from './folder/ViewCommands';
import { registerDirectoryCommands } from './folder/directoryCommands';
import { registerFolderMenuCommands } from './folder/FolderMenuCommands';
import { registerContextMenuCommands } from './clipboard/contextMenuCommands';

// Import services for clipboard commands
import { ClipboardService } from '../domain/clipboard/services/ClipboardService';
import path from 'path';

export function registerAllCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderProvider,
    clipboardProvider: ClipboardProvider
): void {
    try {
        // Clear any existing registrations to start fresh
        CommandRegistry.clear();

        // Register core clipboard commands first (these are the main keyboard shortcuts)
        registerCoreCommands(context);

        // Register context menu commands
        registerContextMenuCommands(context);

        // Register critical commands that are referenced immediately
        registerCriticalCommands(context, treeDataProvider);

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
        }
    );

    // Register toggleViewMode - this is referenced in critical flow
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.toggleViewMode',
        () => handleToggleViewMode(treeDataProvider)
    );

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
        async (fileItem) => {
            if (!fileItem?.resourceUri) {
                return;
            }

            const uri = fileItem.resourceUri;
            try {
                const container = ServiceContainer.getInstance();
                const clipboardService = container.resolve<ClipboardService>('ClipboardService');

                // Read file content without opening the file in the editor
                const document = await vscode.workspace.openTextDocument(uri);
                const content = document.getText();

                // Use clipboard service to copy - with format parameter
                await clipboardService.copyFileContent(uri.toString(), content, 'normal');

                // Show notification
                vscode.window.showInformationMessage(`Copied: ${path.basename(uri.fsPath)}`);

            } catch (error) {
                vscode.window.showErrorMessage(`Failed to copy file: ${error}`);
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

// Clipboard management commands using clean architecture services
function registerClipboardCommands(
    context: vscode.ExtensionContext,
    clipboardProvider: ClipboardProvider
): void {

    // Get services from container
    const container = ServiceContainer.getInstance();
    const clipboardService = container.resolve<ClipboardService>('ClipboardService');

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.toggleClipboardDetection',
        () => {
            // Use ClipboardDetector with proper service integration
            const detector = ClipboardDetector.getInstance();
            if (detector) {
                const currentStatus = detector.getDetectionStatus();
                const newState = !currentStatus;
                detector.toggleDetection(newState);
                const status = newState ? 'enabled' : 'disabled';
                vscode.window.showInformationMessage(`Clipboard detection ${status}`);
            }
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearClipboardQueue',
        async () => {
            // Use ClipboardDetector with proper service integration
            const detector = ClipboardDetector.getInstance();
            if (detector) {
                await detector.clearQueue();
                clipboardProvider.refresh();
                vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles', false);
                vscode.window.showInformationMessage('Clipboard queue cleared');
            }
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

    // Refresh clipboard view command
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.refreshClipboardView',
        () => {
            clipboardProvider.refresh();
            // Update context for UI visibility using clean architecture
            const detectedFiles = clipboardService.getDetectedFiles();
            vscode.commands.executeCommand('setContext', 'copyPathWithCode.hasClipboardFiles',
                detectedFiles.length > 0);
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