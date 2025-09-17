/**
 * FILE: src/commands/coreCommands.ts
 * 
 * CORE COMMANDS - LỆNH CỐT LÕI CỦA EXTENSION
 * 
 * Chứa các lệnh cơ bản nhất của extension liên quan đến copy và quản lý clipboard.
 * 
 * Chức năng chính:
 * - copyPathWithContent: Copy đường dẫn file kèm nội dung
 * - copyPathWithContentAndError: Copy đường dẫn file kèm nội dung và thông tin lỗi
 * - clearClipboard: Xóa toàn bộ nội dung đã copy trong clipboard
 */

import * as vscode from 'vscode';
import { copyPathWithContent, clearClipboard, copyPathWithContentAndError } from '../utils/clipboardUtils';

export function registerCoreCommands(context: vscode.ExtensionContext) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.copyPathWithContent', copyPathWithContent),
        vscode.commands.registerCommand('copy-path-with-code.clearClipboard', clearClipboard),
        vscode.commands.registerCommand('copy-path-with-code.copyPathWithContentAndError', copyPathWithContentAndError)
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}   