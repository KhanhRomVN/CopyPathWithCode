import * as vscode from 'vscode';
import * as path from 'path';
import { state } from '../models/models';
import { copyFolderContents } from '../utils/clipboardUtils';
import { Logger } from '../utils/logger';
import { isFolderFromCurrentWorkspace } from '../utils/workspaceUtils';
import { resolveFolder } from './folderManagementCommands';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';

export function registerFolderOperationsCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider
) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.openFolderFiles', (folder) => openFolderFiles(folder)),
        vscode.commands.registerCommand('copy-path-with-code.copyFolderContents', (folder) => copyFolderContents(folder))
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

export async function openFolderFiles(folderParam: any) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    // Check if folder is from different workspace
    if (!isFolderFromCurrentWorkspace(folder)) {
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