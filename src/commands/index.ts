/**
 * FILE: src/commands/index.ts
 * 
 * ĐIỀU PHỐI LỆNH CHÍNH - TRUNG TÂM ĐĂNG KÝ COMMANDS
 * 
 * File này đóng vai trò là trung tâm đăng ký tất cả các lệnh cho extension.
 * Kết nối và đăng ký tất cả các module commands với VS Code extension context.
 * 
 * Chức năng chính:
 * - Đăng ký core commands (copy, clear clipboard)
 * - Đăng ký folder commands (quản lý thư mục)
 * - Đăng ký directory commands (thao tác với thư mục)
 * - Đăng ký context menu commands (menu ngữ cảnh)
 * - Đăng ký temp clipboard commands (lưu tạm clipboard)
 */

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