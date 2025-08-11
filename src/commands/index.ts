import * as vscode from 'vscode';
import { registerCoreCommands } from './coreCommands';
import { registerFolderCommands } from './folderCommands';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';

export function registerAllCommands(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    registerCoreCommands(context);
    registerFolderCommands(context, treeDataProvider);
}
