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
/* Command */
import { registerCoreCommands } from './clipboard/coreCommands';
import { registerFolderCommands } from './folder/folderCommands';
import { registerDirectoryCommands } from './folder/directoryCommands';
import { registerContextMenuCommands } from './clipboard/contextMenuCommands';
import { registerTempClipboardCommands } from './clipboard/tempClipboardCommands';

/* Provider */
import { FolderTreeDataProvider } from '../providers/folder/folderTreeDataProvider';
import { ClipboardTreeDataProvider } from '../providers/clipboard/clipboardTreeDataProvider';

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