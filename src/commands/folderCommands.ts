import * as vscode from 'vscode';
import * as path from 'path';
import { state, Folder, ClipboardFile, CopiedFile } from '../models/models';
import { saveFolders } from '../utils/folderUtils';
import { copyFolderContents } from '../utils/clipboardUtils';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { ClipboardTreeDataProvider } from '../providers/clipboardTreeDataProvider';
import { getFolderById } from '../utils/folderUtils';
import { ClipboardDetector } from '../utils/clipboardDetector';
import { Logger } from '../utils/logger';
import { hasActiveWorkspace, getCurrentWorkspaceFolder, getFoldersForCurrentWorkspace } from '../utils/workspaceUtils';

// Constants for clipboard signature
const TRACKING_SIGNATURE = '<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->';

export function registerFolderCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider,
    clipboardTreeDataProvider: ClipboardTreeDataProvider
) {
    const clipboardDetector = ClipboardDetector.init(context);

    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.createFolder', () => createFolder(context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.addFileToFolder', (folderItem) => startAddFileMode(treeDataProvider, folderItem)),
        vscode.commands.registerCommand('copy-path-with-code.removeFileFromFolder', (folderItem) => startRemoveFileMode(treeDataProvider, folderItem)),
        vscode.commands.registerCommand('copy-path-with-code.openFolderFiles', (folder) => openFolderFiles(folder)),
        vscode.commands.registerCommand('copy-path-with-code.copyFolderContents', (folder) => copyFolderContents(folder)),
        vscode.commands.registerCommand('copy-path-with-code.deleteFolder', (folder) => deleteFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.renameFolder', (folder) => renameFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.showFolderMenu', (folder) => showFolderMenu(folder)),

        // Individual file copy command
        vscode.commands.registerCommand('copy-path-with-code.copyIndividualFile', (fileItem) => copyIndividualFile(fileItem)),

        // New inline file management commands
        vscode.commands.registerCommand('copy-path-with-code.toggleFileSelection', (filePath: string) => {
            treeDataProvider.toggleFileSelection(filePath);
        }),
        vscode.commands.registerCommand('copy-path-with-code.confirmFileManagement', () => confirmFileManagement(context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.cancelFileManagement', () => {
            treeDataProvider.exitFileManagementMode();
        }),

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

        // Add refresh command for folder tree
        vscode.commands.registerCommand('copy-path-with-code.refreshFolderView', () => {
            treeDataProvider.refresh();
        })
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

// Individual file copy function
async function copyIndividualFile(fileItem?: any) {
    try {
        Logger.debug('Starting individual file copy', fileItem);

        if (!fileItem || !fileItem.treeNode || !fileItem.treeNode.uri) {
            Logger.error('Invalid file item for individual copy');
            vscode.window.showErrorMessage('Invalid file selection for copying');
            return;
        }

        const treeNode = fileItem.treeNode;
        const uri = treeNode.uri as vscode.Uri;

        Logger.debug(`Copying individual file: ${uri.toString()}`);

        // Read the file content
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();

        // Calculate display path
        let displayPath = uri.fsPath;
        let basePath = uri.fsPath;

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            displayPath = vscode.workspace.asRelativePath(uri);
            basePath = displayPath;
        }

        // Format content
        const formattedContent = `${displayPath}:\n\`\`\`\n${content}\n\`\`\``;

        // Remove any existing file with same basePath
        const beforeCount = state.copiedFiles.length;
        state.copiedFiles = state.copiedFiles.filter(f => f.basePath !== basePath);
        const afterCount = state.copiedFiles.length;

        if (beforeCount !== afterCount) {
            Logger.debug(`Removed existing file entry for ${basePath}`);
        }

        // Add the new file
        const copiedFile: CopiedFile = {
            displayPath,
            basePath,
            content: formattedContent,
            format: 'normal'
        };

        state.copiedFiles.push(copiedFile);

        // Update clipboard with signature
        await updateClipboardWithSignature();

        const totalCount = state.copiedFiles.length;
        Logger.info(`Successfully copied file ${displayPath} (${totalCount} total files)`);

        // Show notification with file name instead of full path
        const fileName = path.basename(displayPath);
        vscode.window.showInformationMessage(
            `Copied "${fileName}" to clipboard (${totalCount} file${totalCount > 1 ? 's' : ''} total)`
        );

        // Update status bar
        updateStatusBar();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Failed to copy individual file', error);
        vscode.window.showErrorMessage(`Failed to copy file: ${errorMessage}`);
    }
}

// Helper function to update clipboard with signature
async function updateClipboardWithSignature() {
    const combined = state.copiedFiles
        .map(f => f.content)
        .join('\n\n---\n\n');

    const finalContent = combined + '\n' + TRACKING_SIGNATURE;
    await vscode.env.clipboard.writeText(finalContent);
}

// Helper function to update status bar
function updateStatusBar() {
    if (state.statusBarItem) {
        const count = state.copiedFiles.length;
        const tempText = state.tempClipboard.length > 0 ? ` | Temp: ${state.tempClipboard.length}` : '';
        state.statusBarItem.text = `$(clippy) ${count} file${count > 1 ? 's' : ''}${tempText}`;
        state.statusBarItem.show();
    }
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

// Updated createFolder function with view mode and workspace restrictions
async function createFolder(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        vscode.window.showWarningMessage('Cannot create folders in global view. Switch to workspace view.');
        return;
    }

    // Check if workspace is available
    if (!hasActiveWorkspace()) {
        vscode.window.showErrorMessage(
            'Cannot create folders without an active workspace. Please open a folder or workspace first.',
            'Open Folder'
        ).then(selection => {
            if (selection === 'Open Folder') {
                vscode.commands.executeCommand('workbench.action.files.openFolder');
            }
        });
        return;
    }

    // Exit file management mode if active
    if (treeDataProvider.isInFileManagementMode()) {
        treeDataProvider.exitFileManagementMode();
    }

    const name = await vscode.window.showInputBox({
        prompt: 'Enter folder name',
        placeHolder: 'My Code Folder',
        title: 'Create New Folder'
    });
    if (!name) { return; }

    // Filter out non-file schemes
    const fileEditors = vscode.window.visibleTextEditors.filter(editor => {
        return editor.document.uri.scheme === 'file';
    });

    Logger.info(`Found ${fileEditors.length} file editors`);

    // Give user choice
    const options = [
        {
            label: 'Create empty folder',
            description: 'Start with an empty folder',
            iconPath: new vscode.ThemeIcon('folder')
        },
        {
            label: `Add ${fileEditors.length} open file${fileEditors.length !== 1 ? 's' : ''}`,
            description: 'Include currently open files',
            iconPath: new vscode.ThemeIcon('folder-opened')
        }
    ];

    const choice = await vscode.window.showQuickPick(options, {
        placeHolder: 'Include files in folder?',
        title: `Creating folder "${name}"`
    });

    if (!choice) { return; }

    const openFiles = choice.label.includes('Add') ? fileEditors.map(e => e.document.uri.toString()) : [];

    // Store current workspace information (required now)
    const currentWorkspace = getCurrentWorkspaceFolder();
    if (!currentWorkspace) {
        vscode.window.showErrorMessage('Failed to get current workspace information');
        return;
    }

    const folder: Folder = {
        id: Date.now().toString(),
        name,
        files: openFiles,
        workspaceFolder: currentWorkspace
    };

    state.folders.push(folder);
    saveFolders(context);
    treeDataProvider.refresh();

    const workspaceInfo = ` in workspace "${path.basename(currentWorkspace)}"`;
    vscode.window.showInformationMessage(`Folder "${name}" created with ${openFiles.length} files${workspaceInfo}`);
}

async function startAddFileMode(treeDataProvider: FolderTreeDataProvider, folderParam?: any) {
    // Check view mode first
    if (treeDataProvider.getViewMode() === 'global') {
        vscode.window.showWarningMessage('Cannot add files in global view. Switch to workspace view.');
        return;
    }

    let folderItem = folderParam;
    if (!folderItem) {
        if (!state.folders.length) {
            vscode.window.showInformationMessage('No folders available. Create a folder first.');
            return;
        }

        // Filter folders to show workspace info - let VS Code handle folder icons  
        const folderChoices = state.folders.map(f => {
            const workspaceInfo = f.workspaceFolder ? ` (${path.basename(f.workspaceFolder)})` : '';
            const isCurrentWorkspace = isFromCurrentWorkspace(f);

            return {
                label: f.name + workspaceInfo,
                description: !isCurrentWorkspace ? 'From different workspace' : undefined,
                // Remove iconPath to let VS Code use default folder icons
                folder: f
            };
        });

        const pick = await vscode.window.showQuickPick(
            folderChoices,
            {
                placeHolder: 'Select folder to add files',
                title: 'Add Files to Folder'
            }
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
            {
                modal: true,
                detail: 'Files from the current workspace will be added to this folder.'
            },
            'Continue', 'Cancel'
        );
        if (choice !== 'Continue') {
            return;
        }
    }

    // Enter add file mode
    treeDataProvider.enterFileManagementMode(folder.id, 'add');
    vscode.window.showInformationMessage(`Adding files to "${folder.name}". Select files in the sidebar and click "Confirm Add Selected".`);
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

        // Filter folders to show workspace info with appropriate icons
        const folderChoices = state.folders.map(f => {
            const workspaceInfo = f.workspaceFolder ? ` (${path.basename(f.workspaceFolder)})` : '';
            const isCurrentWorkspace = isFromCurrentWorkspace(f);

            return {
                label: f.name + workspaceInfo,
                description: !isCurrentWorkspace ? 'From different workspace' : undefined,
                iconPath: isCurrentWorkspace ?
                    new vscode.ThemeIcon('folder-opened') :
                    new vscode.ThemeIcon('folder-library'),
                folder: f
            };
        });

        const pick = await vscode.window.showQuickPick(
            folderChoices,
            {
                placeHolder: 'Select folder to remove files',
                title: 'Remove Files from Folder'
            }
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

    if (folder.files.length === 0) {
        vscode.window.showInformationMessage(`No files to remove from "${folder.name}".`);
        return;
    }

    // Enter remove file mode
    treeDataProvider.enterFileManagementMode(folder.id, 'remove');
    vscode.window.showInformationMessage(`Removing files from "${folder.name}". Select files in the sidebar and click "Confirm Remove Selected".`);
}

async function confirmFileManagement(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const selectedFiles = treeDataProvider.getSelectedFiles();
    const folderId = (treeDataProvider as any).fileManagementState.folderId;
    const mode = (treeDataProvider as any).fileManagementState.mode;

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
        vscode.window.showWarningMessage('No files selected');
        return;
    }

    // Convert relative paths to URIs
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
    const selectedUris = selectedFiles.map(p =>
        vscode.Uri.file(path.join(workspaceRoot, p)).toString()
    );

    if (mode === 'add') {
        // Add files to folder
        const beforeCount = folder.files.length;
        folder.files = Array.from(new Set([...folder.files, ...selectedUris]));
        const addedCount = folder.files.length - beforeCount;

        vscode.window.showInformationMessage(`Added ${addedCount} file(s) to "${folder.name}"`);
        Logger.info(`Added ${addedCount} files to folder "${folder.name}"`);
    } else {
        // Remove files from folder
        const beforeCount = folder.files.length;
        folder.files = folder.files.filter(f => !selectedUris.includes(f));
        const removedCount = beforeCount - folder.files.length;

        vscode.window.showInformationMessage(`Removed ${removedCount} file(s) from "${folder.name}"`);
        Logger.info(`Removed ${removedCount} files from folder "${folder.name}"`);
    }

    // Save changes and exit file management mode
    saveFolders(context);
    treeDataProvider.exitFileManagementMode();
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
            {
                modal: true,
                detail: 'Files from different workspaces might not open correctly.'
            },
            'Continue', 'Cancel'
        );
        if (choice !== 'Continue') {
            return;
        }
    }

    const options = [
        {
            label: 'Close existing tabs',
            description: 'Close all open editors first',
            iconPath: new vscode.ThemeIcon('close-all')
        },
        {
            label: 'Keep existing tabs',
            description: 'Add to currently open files',
            iconPath: new vscode.ThemeIcon('add')
        }
    ];

    const sel = await vscode.window.showQuickPick(options, {
        placeHolder: 'Handle existing tabs?',
        title: `Opening ${folder.files.length} files from "${folder.name}"`
    });
    if (!sel) { return; }

    if (sel.label === 'Close existing tabs') {
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
        if (treeDataProvider.isInFileManagementMode() &&
            (treeDataProvider as any).fileManagementState.folderId === folder.id) {
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

    const isCurrentWorkspace = isFromCurrentWorkspace(folder);
    const workspaceInfo = folder.workspaceFolder ? ` (${path.basename(folder.workspaceFolder)})` : '';

    const menuOptions = [
        {
            label: 'Add File to Folder',
            description: 'Select files to add',
            iconPath: new vscode.ThemeIcon('add')
        },
        {
            label: 'Remove File from Folder',
            description: 'Remove existing files',
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