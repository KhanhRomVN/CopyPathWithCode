import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../models/models';
import { saveFolders } from '../utils/folderUtils';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { Logger } from '../utils/logger';
import { isFolderFromCurrentWorkspace } from '../utils/workspaceUtils';
import { resolveFolder } from './folderManagementCommands';
import { copyFolderContents } from '../utils/clipboardUtils';
import { openFolderFiles } from "../commands/folderOperationsCommands"

export function registerFileManagementCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider
) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.addFileToFolder', (folderItem) => startAddFileMode(treeDataProvider, folderItem)),
        vscode.commands.registerCommand('copy-path-with-code.removeFileFromFolder', (folderItem) => startRemoveFileMode(treeDataProvider, folderItem)),
        vscode.commands.registerCommand('copy-path-with-code.toggleFileSelection', (filePath: string) => {
            treeDataProvider.toggleFileSelection(filePath);
        }),
        vscode.commands.registerCommand('copy-path-with-code.confirmFileManagement', () => confirmFileManagement(context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.cancelFileManagement', () => {
            treeDataProvider.exitFileManagementMode();
        }),
        vscode.commands.registerCommand('copy-path-with-code.selectAllFiles', () => {
            treeDataProvider.selectAllFiles();
        }),
        vscode.commands.registerCommand('copy-path-with-code.deselectAllFiles', () => {
            treeDataProvider.deselectAllFiles();
        }),
        vscode.commands.registerCommand('copy-path-with-code.selectAllFilesInFolder', (item) => {
            selectAllFilesInFolder(treeDataProvider, item);
        }),
        vscode.commands.registerCommand('copy-path-with-code.unselectAllFilesInFolder', (item) => {
            unselectAllFilesInFolder(treeDataProvider, item);
        })
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

export async function startAddFileMode(treeDataProvider: FolderTreeDataProvider, folderParam?: any) {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        vscode.window.showWarningMessage('Cannot add files in global view. Switch to workspace view.');
        return;
    }

    let folderItem = folderParam;
    if (!folderItem) {
        if (!state.folders.length) {
            const choice = await vscode.window.showInformationMessage(
                'No folders available. Create a folder first.',
                'Create Folder', 'Cancel'
            );

            if (choice === 'Create Folder') {
                vscode.commands.executeCommand('copy-path-with-code.createFolder');
            }
            return;
        }

        // Enhanced folder selection with better visual indicators
        const folderChoices = state.folders.map(f => {
            const workspaceInfo = f.workspaceFolder ? ` (${path.basename(f.workspaceFolder)})` : '';
            const isCurrentWorkspace = isFolderFromCurrentWorkspace(f);
            const fileCount = f.files.length;

            return {
                label: f.name + workspaceInfo,
                description: `${fileCount} file${fileCount !== 1 ? 's' : ''}`,
                detail: !isCurrentWorkspace ? 'From different workspace - some files might not be accessible' : 'Current workspace',
                iconPath: isCurrentWorkspace ?
                    new vscode.ThemeIcon('folder-opened') :
                    new vscode.ThemeIcon('folder-library'),
                folder: f
            };
        });

        const pick = await vscode.window.showQuickPick(folderChoices, {
            placeHolder: 'Select folder to add files',
            title: 'Add Files to Folder',
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!pick) return;
        folderItem = pick.folder;
    }

    const folder = resolveFolder(folderItem);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    // Check if folder is from different workspace
    if (!isFolderFromCurrentWorkspace(folder)) {
        const choice = await vscode.window.showWarningMessage(
            `This folder was created in a different workspace (${folder.workspaceFolder ? path.basename(folder.workspaceFolder) : 'Unknown'}). Do you want to continue?`,
            {
                modal: true,
                detail: 'Files from the current workspace will be added to this folder. Some files might not be accessible from different workspaces.'
            },
            'Continue', 'Cancel'
        );
        if (choice !== 'Continue') return;
    }

    // Enter add file mode with enhanced user guidance
    treeDataProvider.enterFileManagementMode(folder.id, 'add');

    // Show enhanced guidance message
    const action = await vscode.window.showInformationMessage(
        `Adding files to "${folder.name}". Select files in the tree and use the action buttons.`,
        {
            detail: 'Use the search function to quickly find files. Files already in the folder are pre-selected.'
        },
        'Show Search Tips', 'Got it'
    );

    if (action === 'Show Search Tips') {
        showSearchTips();
    }
}

async function startRemoveFileMode(treeDataProvider: FolderTreeDataProvider, folderParam?: any) {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        vscode.window.showWarningMessage('Cannot remove files in global view. Switch to workspace view.');
        return;
    }

    let folderItem = folderParam;
    if (!folderItem) {
        if (!state.folders.length) {
            vscode.window.showInformationMessage('No folders available.');
            return;
        }

        // Enhanced folder selection showing file counts
        const folderChoices = state.folders.map(f => {
            const workspaceInfo = f.workspaceFolder ? ` (${path.basename(f.workspaceFolder)})` : '';
            const isCurrentWorkspace = isFolderFromCurrentWorkspace(f);
            const fileCount = f.files.length;

            return {
                label: f.name + workspaceInfo,
                description: `${fileCount} file${fileCount !== 1 ? 's' : ''}`,
                detail: fileCount === 0 ? 'No files to remove' :
                    !isCurrentWorkspace ? 'From different workspace' :
                        'Current workspace',
                iconPath: isCurrentWorkspace ?
                    new vscode.ThemeIcon('folder-opened') :
                    new vscode.ThemeIcon('folder-library'),
                folder: f,
                disabled: fileCount === 0
            };
        });

        // Filter out folders with no files but still show them as disabled
        const pick = await vscode.window.showQuickPick(folderChoices, {
            placeHolder: 'Select folder to remove files from',
            title: 'Remove Files from Folder',
            ignoreFocusOut: true
        });

        if (!pick) return;

        if (pick.disabled) {
            vscode.window.showInformationMessage(`Folder "${pick.folder.name}" has no files to remove.`);
            return;
        }

        folderItem = pick.folder;
    }

    const folder = resolveFolder(folderItem);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    if (folder.files.length === 0) {
        vscode.window.showInformationMessage(`No files to remove from "${folder.name}".`);
        return;
    }

    // Enter remove file mode
    treeDataProvider.enterFileManagementMode(folder.id, 'remove');

    // Show enhanced guidance message
    const action = await vscode.window.showInformationMessage(
        `Removing files from "${folder.name}". Select files to remove and confirm.`,
        {
            detail: `${folder.files.length} files available for removal. Use search to find specific files quickly.`
        },
        'Show Search Tips', 'Got it'
    );

    if (action === 'Show Search Tips') {
        showSearchTips();
    }
}

function showSearchTips() {
    const tips = [
        '• Type file names or extensions (.js, .ts) to filter',
        '• Use patterns like *test* or *config* to find specific types',
        '• Search works on both file names and folder paths',
        '• Use "Select All Files" to quickly select everything',
        '• Right-click folders to select all files within them'
    ];

    vscode.window.showInformationMessage(
        'Search Tips',
        {
            modal: true,
            detail: tips.join('\n')
        },
        'Got it'
    );
}

async function confirmFileManagement(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const selectedFiles = treeDataProvider.getSelectedFiles();
    const managementState = treeDataProvider.getFileManagementState();
    const folderId = managementState.folderId;
    const mode = managementState.mode;

    if (!folderId || mode === 'normal') {
        vscode.window.showErrorMessage('Not in file management mode');
        return;
    }

    const folder = state.folders.find(f => f.id === folderId);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        treeDataProvider.exitFileManagementMode();
        return;
    }

    if (selectedFiles.length === 0) {
        const action = await vscode.window.showWarningMessage(
            'No files selected. What would you like to do?',
            'Continue Selection', 'Cancel Operation'
        );

        if (action !== 'Continue Selection') {
            treeDataProvider.exitFileManagementMode();
        }
        return;
    }

    // Show confirmation with details
    const filesList = selectedFiles.length > 5 ?
        `${selectedFiles.slice(0, 5).map((f: string) => path.basename(f)).join(', ')} and ${selectedFiles.length - 5} more` :
        selectedFiles.map((f: string) => path.basename(f)).join(', ');

    const actionVerb = mode === 'add' ? 'add' : 'remove';
    const preposition = mode === 'add' ? 'to' : 'from';

    const confirmed = await vscode.window.showInformationMessage(
        `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} ${preposition} "${folder.name}"?`,
        {
            modal: true,
            detail: `Files: ${filesList}`
        },
        'Confirm', 'Cancel'
    );

    if (confirmed !== 'Confirm') return;

    // Convert relative paths to URIs
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
    const selectedUris = selectedFiles.map((p: string) =>
        vscode.Uri.file(path.join(workspaceRoot, p)).toString()
    );

    let operationCount = 0;

    if (mode === 'add') {
        // Add files to folder
        const beforeCount = folder.files.length;
        folder.files = Array.from(new Set([...folder.files, ...selectedUris]));
        operationCount = folder.files.length - beforeCount;

        Logger.info(`Added ${operationCount} files to folder "${folder.name}"`);
    } else {
        // Remove files from folder
        const beforeCount = folder.files.length;
        folder.files = folder.files.filter(f => !selectedUris.includes(f));
        operationCount = beforeCount - folder.files.length;

        Logger.info(`Removed ${operationCount} files from folder "${folder.name}"`);
    }

    // Save changes and exit file management mode
    saveFolders(context);
    treeDataProvider.exitFileManagementMode();

    // Show success message with next actions
    const successMessage = `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)}ed ${operationCount} file${operationCount !== 1 ? 's' : ''} ${preposition} "${folder.name}"`;

    const nextAction = await vscode.window.showInformationMessage(
        successMessage,
        'Copy Folder Contents', 'Open Folder Files', 'Done'
    );

    if (nextAction === 'Copy Folder Contents') {
        copyFolderContents(folder);
    } else if (nextAction === 'Open Folder Files') {
        openFolderFiles(folder);
    }
}

// Select/Deselect functions for folder-specific operations
async function selectAllFilesInFolder(treeDataProvider: FolderTreeDataProvider, item: any) {
    if (!item || !item.treeNode) {
        vscode.window.showErrorMessage('Could not select files: Invalid folder');
        return;
    }

    const treeNode = item.treeNode;
    const allFiles = getAllFilesFromNode(treeNode);

    allFiles.forEach(filePath => {
        treeDataProvider.toggleFileSelection(filePath);
    });

    vscode.window.showInformationMessage(`Selected ${allFiles.length} files in folder`);
}

async function unselectAllFilesInFolder(treeDataProvider: FolderTreeDataProvider, item: any) {
    if (!item || !item.treeNode) {
        vscode.window.showErrorMessage('Could not deselect files: Invalid folder');
        return;
    }

    const treeNode = item.treeNode;
    const allFiles = getAllFilesFromNode(treeNode);
    const managementState = treeDataProvider.getFileManagementState();

    allFiles.forEach(filePath => {
        managementState.selectedFiles.delete(filePath);
    });

    treeDataProvider.refresh();
    vscode.window.showInformationMessage(`Deselected ${allFiles.length} files in folder`);
}

// Helper function to get all files from a tree node
function getAllFilesFromNode(node: any): string[] {
    const files: string[] = [];

    if (node.isFile) {
        files.push(node.path);
    } else {
        for (const child of node.children.values()) {
            files.push(...getAllFilesFromNode(child));
        }
    }

    return files;
}