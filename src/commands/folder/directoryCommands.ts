/**
 * FILE: src/commands/folder/directoryCommands.ts - Updated with CommandRegistry
 * 
 * DIRECTORY COMMANDS - LỆNH THAO TÁC VỚI THƯ MỤC
 * 
 * Các lệnh liên quan đến thao tác với cấu trúc thư mục trong tree view.
 * 
 * Chức năng chính:
 * - expandAllDirectories: Mở rộng tất cả thư mục
 * - collapseAllDirectories: Thu gọn tất cả thư mục
 * - revealInExplorer: Hiển thị trong file explorer
 */

import * as vscode from 'vscode';
import { FolderProvider } from '../../providers/FolderProvider';
import { CommandRegistry } from '../../utils/common/CommandRegistry';

export function registerDirectoryCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderProvider
) {
    // Register directory commands using CommandRegistry
    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.expandAllDirectories',
        () => {
            // This would need to be implemented in the tree provider if needed
            // For now, it's handled by VS Code's built-in expand all functionality
            vscode.window.showInformationMessage('Expand all directories');
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.collapseAllDirectories',
        () => {
            // This would need to be implemented in the tree provider if needed
            // For now, it's handled by VS Code's built-in collapse all functionality
            vscode.window.showInformationMessage('Collapse all directories');
        }
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.revealInExplorer',
        (item) => {
            if (item && item.resourceUri) {
                vscode.commands.executeCommand('revealInExplorer', item.resourceUri);
            }
        }
    );
}