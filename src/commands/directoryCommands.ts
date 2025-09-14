import * as vscode from 'vscode';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';

export function registerDirectoryCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider
) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.expandAllDirectories', () => {
            // This would need to be implemented in the tree provider if needed
            // For now, it's handled by VS Code's built-in expand all functionality
            vscode.window.showInformationMessage('Expand all directories');
        }),

        vscode.commands.registerCommand('copy-path-with-code.collapseAllDirectories', () => {
            // This would need to be implemented in the tree provider if needed
            // For now, it's handled by VS Code's built-in collapse all functionality
            vscode.window.showInformationMessage('Collapse all directories');
        }),

        vscode.commands.registerCommand('copy-path-with-code.revealInExplorer', (item) => {
            if (item && item.resourceUri) {
                vscode.commands.executeCommand('revealInExplorer', item.resourceUri);
            }
        })
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}