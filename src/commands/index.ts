// src/commands/index.ts
import * as vscode from 'vscode';
import { registerCoreCommands } from './coreCommands';
import { registerFolderCommands } from './folderCommands';
import { registerDirectoryCommands } from './directoryCommands';
import { registerContextMenuCommands } from './contextMenuCommands';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { ClipboardTreeDataProvider } from '../providers/clipboardTreeDataProvider';
import { registerTempClipboardCommands } from './tempClipboardCommands';

export function registerAllCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider,
    clipboardTreeDataProvider: ClipboardTreeDataProvider
) {
    registerCoreCommands(context);
    registerFolderCommands(context, treeDataProvider);
    registerDirectoryCommands(context, treeDataProvider);
    registerTempClipboardCommands(context);
    registerContextMenuCommands(context);
}