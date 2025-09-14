import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder, ClipboardFile } from '../models/models';
import { saveFolders } from '../utils/folderUtils';
import { copyFolderContents } from '../utils/clipboardUtils';
import { FolderWebview } from '../views/folderWebview';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { ClipboardTreeDataProvider } from '../providers/clipboardTreeDataProvider';
import { getFolderById } from '../utils/folderUtils';
import { ClipboardDetector } from '../utils/clipboardDetector';
import { Logger } from '../utils/logger';

export function registerFolderCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider,
    clipboardTreeDataProvider: ClipboardTreeDataProvider
) {
    const clipboardDetector = ClipboardDetector.init(context);

    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.createFolder', () => createFolder(context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.addFileToFolder', (folderItem) => showAddFileWebview(context, treeDataProvider, folderItem)),
        vscode.commands.registerCommand('copy-path-with-code.removeFileFromFolder', (folderItem) => showRemoveFileWebview(context, treeDataProvider, folderItem)),
        vscode.commands.registerCommand('copy-path-with-code.openFolderFiles', (folder) => openFolderFiles(folder)),
        vscode.commands.registerCommand('copy-path-with-code.copyFolderContents', (folder) => copyFolderContents(folder)),
        vscode.commands.registerCommand('copy-path-with-code.deleteFolder', (folder) => deleteFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.renameFolder', (folder) => renameFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.showFolderMenu', (folder) => showFolderMenu(folder)),

        // Clipboard detection commands
        vscode.commands.registerCommand('copy-path-with-code.toggleClipboardDetection', () => {
            const currentlyEnabled = state.isClipboardDetectionEnabled;
            clipboardDetector.toggleDetection(!currentlyEnabled);
            vscode.window.showInformationMessage(
                `Clipboard detection ${currentlyEnabled ? 'disabled' : 'enabled'}`
            );
        }),

        vscode.commands.registerCommand('copy-path-with-code.clearClipboardQueue', () => {
            clipboardDetector.clearQueue();
            vscode.window.showInformationMessage('Clipboard queue cleared');
        }),

        vscode.commands.registerCommand('copy-path-with-code.openClipboardFile', (file: ClipboardFile) => {
            openClipboardFilePreview(file);
        }),

        vscode.commands.registerCommand('copy-path-with-code.showLogs', () => {
            Logger.show();
        }),
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
    const name = await vscode.window.showInputBox({ prompt: 'Enter folder name', placeHolder: 'My Code Folder' });
    if (!name) { return; }

    const openFiles = vscode.window.visibleTextEditors.map(e => e.document.uri.toString());

    // Store current workspace information
    const currentWorkspace = vscode.workspace.workspaceFolders?.[0];
    const workspaceFolder = currentWorkspace ? currentWorkspace.uri.fsPath : undefined;

    const folder: Folder = {
        id: Date.now().toString(),
        name,
        files: openFiles,
        workspaceFolder
    };

    state.folders.push(folder);
    saveFolders(context);
    treeDataProvider.refresh();

    const workspaceInfo = workspaceFolder ? ` in workspace "${path.basename(workspaceFolder)}"` : '';
    vscode.window.showInformationMessage(`Folder "${name}" created with ${openFiles.length} files${workspaceInfo}`);
}

async function showAddFileWebview(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider, folderParam?: any) {
    let folderItem = folderParam;
    if (!folderItem) {
        if (!state.folders.length) {
            vscode.window.showInformationMessage('No folders available. Create a folder first.');
            return;
        }

        // Filter folders to show workspace info
        const folderChoices = state.folders.map(f => {
            const workspaceInfo = f.workspaceFolder ? ` (${path.basename(f.workspaceFolder)})` : '';
            const isCurrentWorkspace = isFromCurrentWorkspace(f);

            return {
                label: f.name + workspaceInfo,
                description: !isCurrentWorkspace ? 'From different workspace' : undefined,
                folder: f
            };
        });

        const pick = await vscode.window.showQuickPick(
            folderChoices,
            { placeHolder: 'Select folder to add files' }
        );
        if (!pick) {
            return;
        }
        folderItem = pick.folder;
    }
    const folder = resolveFolder(folderItem);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    // Check if folder is from different workspace
    if (!isFromCurrentWorkspace(folder)) {
        const choice = await vscode.window.showWarningMessage(
            `This folder was created in a different workspace (${folder.workspaceFolder ? path.basename(folder.workspaceFolder) : 'Unknown'}). Do you want to continue?`,
            'Continue', 'Cancel'
        );
        if (choice !== 'Continue') {
            return;
        }
    }

    FolderWebview.show(context, folder.id, 'add', treeDataProvider);
}

async function showRemoveFileWebview(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider, folderParam?: any) {
    let folderItem = folderParam;
    if (!folderItem) {
        if (!state.folders.length) {
            vscode.window.showInformationMessage('No folders available.');
            return;
        }

        // Filter folders to show workspace info
        const folderChoices = state.folders.map(f => {
            const workspaceInfo = f.workspaceFolder ? ` (${path.basename(f.workspaceFolder)})` : '';
            const isCurrentWorkspace = isFromCurrentWorkspace(f);

            return {
                label: f.name + workspaceInfo,
                description: !isCurrentWorkspace ? 'From different workspace' : undefined,
                folder: f
            };
        });

        const pick = await vscode.window.showQuickPick(
            folderChoices,
            { placeHolder: 'Select folder to remove files' }
        );
        if (!pick) {
            return;
        }
        folderItem = pick.folder;
    }
    const folder = resolveFolder(folderItem);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }
    FolderWebview.show(context, folder.id, 'remove', treeDataProvider);
}

async function openFolderFiles(folderParam: any) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    // Check if folder is from different workspace
    if (!isFromCurrentWorkspace(folder)) {
        const choice = await vscode.window.showWarningMessage(
            `This folder contains files from a different workspace (${folder.workspaceFolder ? path.basename(folder.workspaceFolder) : 'Unknown'}). Some files might not be accessible. Continue?`,
            'Continue', 'Cancel'
        );
        if (choice !== 'Continue') {
            return;
        }
    }

    const options = ['Close existing tabs', 'Keep existing tabs'];
    const sel = await vscode.window.showQuickPick(options, { placeHolder: 'Handle existing tabs?' });
    if (!sel) { return; }
    if (sel === options[0]) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }

    const unique = Array.from(new Set(folder.files));
    let successCount = 0;
    let failureCount = 0;

    for (const uri of unique) {
        try {
            await vscode.window.showTextDocument(vscode.Uri.parse(uri), { preview: false });
            successCount++;
        } catch (error) {
            failureCount++;
            Logger.error(`Failed to open file: ${uri}`, error);
        }
    }

    const message = `Opened ${successCount} files from "${folder.name}"`;
    const failureMessage = failureCount > 0 ? ` (${failureCount} files could not be opened)` : '';
    vscode.window.showInformationMessage(message + failureMessage);
}

async function deleteFolder(folderParam: any, context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const confirm = await vscode.window.showQuickPick(
        ['Cancel', `Delete "${folder.name}"`],
        { placeHolder: `Are you sure you want to delete "${folder.name}"?` }
    );
    if (confirm === `Delete "${folder.name}"`) {
        state.folders = state.folders.filter(f => f.id !== folder.id);
        saveFolders(context);
        treeDataProvider.refresh();
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
        value: folder.name
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

    const isCurrentWorkspace = isFromCurrentWorkspace(folder);
    const workspaceInfo = folder.workspaceFolder ? ` (${path.basename(folder.workspaceFolder)})` : '';

    const selection = await vscode.window.showQuickPick([
        'Add File to Folder',
        'Remove File from Folder',
        'Open Folder Files',
        'Copy Folder Contents',
        'Rename Folder',
        'Delete Folder'
    ], {
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
        await vscode.commands.executeCommand(commandMap[selection], folder);
    }
}

// Helper function to check if folder is from current workspace
function isFromCurrentWorkspace(folder: Folder): boolean {
    const currentWorkspace = vscode.workspace.workspaceFolders?.[0];
    if (!currentWorkspace) {
        return !folder.workspaceFolder; // If no workspace, only folders without workspace info are current
    }

    if (!folder.workspaceFolder) {
        return true; // Legacy folders without workspace info are considered current
    }

    return folder.workspaceFolder === currentWorkspace.uri.fsPath;
}

// Function to open preview for file from clipboard
async function openClipboardFilePreview(file: ClipboardFile) {
    try {
        const document = await vscode.workspace.openTextDocument({
            content: file.content,
            language: getLanguageFromFileName(file.filePath)
        });

        await vscode.window.showTextDocument(document, {
            preview: true,
            viewColumn: vscode.ViewColumn.Beside
        });

        Logger.info(`Opened preview for clipboard file: ${file.filePath}`);
    } catch (error) {
        Logger.error(`Failed to open clipboard file preview: ${file.filePath}`, error);
        vscode.window.showErrorMessage(`Failed to open file preview: ${file.filePath}`);
    }
}

// Helper function to detect language from filename
function getLanguageFromFileName(filePath: string): string {
    const ext = path.extname(filePath.split(':')[0]).toLowerCase(); // Remove line range if present
    const languageMap: Record<string, string> = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.jsx': 'javascriptreact',
        '.tsx': 'typescriptreact',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.html': 'html',
        '.htm': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.json': 'json',
        '.xml': 'xml',
        '.md': 'markdown',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.txt': 'plaintext',
        '.log': 'plaintext',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.sh': 'shellscript',
        '.bash': 'shellscript',
        '.zsh': 'shellscript',
        '.ps1': 'powershell',
        '.sql': 'sql',
        '.r': 'r',
        '.R': 'r'
    };

    return languageMap[ext] || 'plaintext';
}