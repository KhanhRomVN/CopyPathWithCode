import * as vscode from 'vscode';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';

export function registerDirectoryCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider
) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.expandAllDirectories', () => {
            // This will trigger expansion of all tree items
            vscode.commands.executeCommand('workbench.actions.treeView.folderManager.expandAll');
        }),

        vscode.commands.registerCommand('copy-path-with-code.collapseAllDirectories', () => {
            // This will trigger collapse of all tree items
            vscode.commands.executeCommand('workbench.actions.treeView.folderManager.collapseAll');
        }),

        vscode.commands.registerCommand('copy-path-with-code.revealInExplorer', (item) => {
            revealInExplorer(item);
        }),
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

async function revealInExplorer(item: any) {
    try {
        let uri: vscode.Uri | undefined;

        // Check if it's a file item with URI
        if (item.resourceUri) {
            uri = item.resourceUri;
        }
        // Check if it's a tree node with URI
        else if (item.treeNode && item.treeNode.uri) {
            uri = item.treeNode.uri;
        }
        // Check if it's a directory node - reveal the directory path
        else if (item.treeNode && !item.treeNode.isFile) {
            // For directories, we need to construct the URI from the path
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, item.treeNode.path);
                uri = fullPath;
            }
        }

        if (uri) {
            // Try to reveal in explorer
            await vscode.commands.executeCommand('revealInExplorer', uri);
        } else {
            vscode.window.showWarningMessage('Cannot reveal: File path not found');
        }
    } catch (error) {
        console.error('Error revealing in explorer:', error);
        vscode.window.showErrorMessage('Failed to reveal in explorer');
    }
}