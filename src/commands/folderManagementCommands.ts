import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder } from '../models/models';
import { saveFolders } from '../utils/folderUtils';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { getFolderById } from '../utils/folderUtils';
import { Logger } from '../utils/logger';
import { hasActiveWorkspace, getCurrentWorkspaceFolder, isFolderFromCurrentWorkspace } from '../utils/workspaceUtils';
import { copyFolderContents } from '../utils/clipboardUtils';
import { startAddFileMode } from "../commands/fileManagementCommands"

export function registerFolderManagementCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider
) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.createFolder', () => createFolder(context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.deleteFolder', (folder) => deleteFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.renameFolder', (folder) => renameFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.showFolderMenu', (folder) => showFolderMenu(folder))
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

/** Resolve input can be TreeItem (from TreeView) or Folder (model) -> return Folder from state */
function resolveFolder(folderOrItem: any): Folder | undefined {
    if (!folderOrItem) return undefined;
    // If has id -> find in state by id
    if (typeof folderOrItem.id === 'string') {
        return getFolderById(folderOrItem.id);
    }
    // If has name + files could be Folder-like object -> match by name
    if (typeof folderOrItem.name === 'string') {
        return state.folders.find(f => f.name === folderOrItem.name);
    }
    return undefined;
}

async function createFolder(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        vscode.window.showWarningMessage('Cannot create folders in global view. Switch to workspace view.');
        return;
    }

    // Check if workspace is available
    if (!hasActiveWorkspace()) {
        const choice = await vscode.window.showErrorMessage(
            'Cannot create folders without an active workspace. Please open a folder or workspace first.',
            'Open Folder', 'Cancel'
        );

        if (choice === 'Open Folder') {
            vscode.commands.executeCommand('workbench.action.files.openFolder');
        }
        return;
    }

    // Exit file management mode if active
    if (treeDataProvider.isInFileManagementMode()) {
        const choice = await vscode.window.showWarningMessage(
            'You are currently in file management mode. Exit to create a new folder?',
            'Exit and Create', 'Cancel'
        );

        if (choice === 'Exit and Create') {
            treeDataProvider.exitFileManagementMode();
        } else {
            return;
        }
    }

    const name = await vscode.window.showInputBox({
        prompt: 'Enter folder name',
        placeHolder: 'My Code Folder',
        title: 'Create New Folder',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Folder name cannot be empty';
            }
            if (state.folders.some(f => f.name === value.trim())) {
                return 'A folder with this name already exists';
            }
            return null;
        }
    });

    if (!name) return;

    // Filter out non-file schemes
    const fileEditors = vscode.window.visibleTextEditors.filter(editor => {
        return editor.document.uri.scheme === 'file';
    });

    Logger.info(`Found ${fileEditors.length} file editors`);

    // Enhanced options with better descriptions
    const options = [
        {
            label: 'Create empty folder',
            description: 'Start with an empty folder - add files later',
            detail: 'Perfect for organizing files step by step',
            iconPath: new vscode.ThemeIcon('folder')
        },
        {
            label: `Add ${fileEditors.length} open file${fileEditors.length !== 1 ? 's' : ''}`,
            description: fileEditors.length > 0 ? 'Include currently open files in the folder' : 'No open files to add',
            detail: fileEditors.length > 0 ? `Files: ${fileEditors.map(e => path.basename(e.document.uri.fsPath)).join(', ')}` : 'Open some files first',
            iconPath: new vscode.ThemeIcon('folder-opened')
        }
    ];

    // Disable the "add files" option if no files are open
    if (fileEditors.length === 0) {
        options[1].description = 'No open files to add (disabled)';
        // We'll still show it but handle it differently
    }

    const choice = await vscode.window.showQuickPick(options, {
        placeHolder: 'How would you like to create the folder?',
        title: `Creating folder "${name}"`,
        ignoreFocusOut: true
    });

    if (!choice) return;

    let openFiles: string[] = [];

    if (choice.label.includes('Add') && fileEditors.length > 0) {
        openFiles = fileEditors.map(e => e.document.uri.toString());
    } else if (choice.label.includes('Add') && fileEditors.length === 0) {
        vscode.window.showInformationMessage('No open files to add. Creating empty folder.');
    }

    // Store current workspace information
    const currentWorkspace = getCurrentWorkspaceFolder();
    if (!currentWorkspace) {
        vscode.window.showErrorMessage('Failed to get current workspace information');
        return;
    }

    const folder: Folder = {
        id: Date.now().toString(),
        name: name.trim(),
        files: openFiles,
        workspaceFolder: currentWorkspace
    };

    state.folders.push(folder);
    saveFolders(context);
    treeDataProvider.refresh();

    const workspaceInfo = ` in workspace "${path.basename(currentWorkspace)}"`;
    const message = `Folder "${name}" created with ${openFiles.length} file${openFiles.length !== 1 ? 's' : ''}${workspaceInfo}`;

    // Show different actions based on whether files were added
    if (openFiles.length > 0) {
        const action = await vscode.window.showInformationMessage(
            message,
            'Copy Folder Contents', 'Add More Files', 'Done'
        );

        if (action === 'Copy Folder Contents') {
            copyFolderContents(folder);
        } else if (action === 'Add More Files') {
            setTimeout(() => startAddFileMode(treeDataProvider, folder), 500);
        }
    } else {
        const action = await vscode.window.showInformationMessage(
            message,
            'Add Files Now', 'Done'
        );

        if (action === 'Add Files Now') {
            setTimeout(() => startAddFileMode(treeDataProvider, folder), 500);
        }
    }
}

async function deleteFolder(folderParam: any, context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const options = [
        {
            label: 'Cancel',
            description: 'Keep the folder',
            iconPath: new vscode.ThemeIcon('close')
        },
        {
            label: `Delete "${folder.name}"`,
            description: `Remove folder with ${folder.files.length} files`,
            iconPath: new vscode.ThemeIcon('trash')
        }
    ];

    const confirm = await vscode.window.showQuickPick(
        options,
        {
            placeHolder: `Are you sure you want to delete "${folder.name}"?`,
            title: 'Delete Folder'
        }
    );

    if (confirm && confirm.label.startsWith('Delete')) {
        state.folders = state.folders.filter(f => f.id !== folder.id);
        saveFolders(context);

        // Exit file management mode if we're managing this folder
        const managementState = treeDataProvider.getFileManagementState();
        if (treeDataProvider.isInFileManagementMode() && managementState.folderId === folder.id) {
            treeDataProvider.exitFileManagementMode();
        } else {
            treeDataProvider.refresh();
        }

        vscode.window.showInformationMessage(`Folder "${folder.name}" deleted`);
    }
}

async function renameFolder(folderParam: any, context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const newName = await vscode.window.showInputBox({
        prompt: 'Enter new folder name',
        value: folder.name,
        title: `Rename "${folder.name}"`
    });

    if (newName && newName !== folder.name) {
        folder.name = newName;
        saveFolders(context);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`Folder renamed to "${newName}"`);
    }
}

async function showFolderMenu(folderParam: any) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const isCurrentWorkspace = isFolderFromCurrentWorkspace(folder);
    const workspaceInfo = folder.workspaceFolder ? ` (${path.basename(folder.workspaceFolder)})` : '';

    const menuOptions = [
        {
            label: 'Add File to Folder',
            description: 'Select files to add with search support',
            iconPath: new vscode.ThemeIcon('add')
        },
        {
            label: 'Remove File from Folder',
            description: 'Remove existing files with search support',
            iconPath: new vscode.ThemeIcon('remove')
        },
        {
            label: 'Open Folder Files',
            description: `Open ${folder.files.length} files in editor`,
            iconPath: new vscode.ThemeIcon('folder-opened')
        },
        {
            label: 'Copy Folder Contents',
            description: 'Copy all files to clipboard',
            iconPath: new vscode.ThemeIcon('copy')
        },
        {
            label: 'Rename Folder',
            description: 'Change folder name',
            iconPath: new vscode.ThemeIcon('edit')
        },
        {
            label: 'Delete Folder',
            description: 'Remove folder permanently',
            iconPath: new vscode.ThemeIcon('trash')
        }
    ];

    const selection = await vscode.window.showQuickPick(menuOptions, {
        placeHolder: `Select action for "${folder.name}"${workspaceInfo}`,
        title: `Folder Actions${!isCurrentWorkspace ? ' (Different Workspace)' : ''}`
    });

    if (selection) {
        const commandMap: Record<string, string> = {
            'Add File to Folder': 'copy-path-with-code.addFileToFolder',
            'Remove File from Folder': 'copy-path-with-code.removeFileFromFolder',
            'Open Folder Files': 'copy-path-with-code.openFolderFiles',
            'Copy Folder Contents': 'copy-path-with-code.copyFolderContents',
            'Rename Folder': 'copy-path-with-code.renameFolder',
            'Delete Folder': 'copy-path-with-code.deleteFolder'
        };

        // Call command and pass Folder (not TreeItem)
        await vscode.commands.executeCommand(commandMap[selection.label], folder);
    }
}

export { resolveFolder };