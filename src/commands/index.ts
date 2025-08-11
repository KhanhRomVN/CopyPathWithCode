import * as vscode from 'vscode';
import { registerCoreCommands } from './coreCommands';
import { registerFolderCommands } from './folderCommands';

export function registerAllCommands(context: vscode.ExtensionContext) {
    registerCoreCommands(context);
    registerFolderCommands(context);
}