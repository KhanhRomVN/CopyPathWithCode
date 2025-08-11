import * as vscode from 'vscode';
import { copyPathWithContent, clearClipboard } from '../utils/clipboardUtils';

export function registerCoreCommands(context: vscode.ExtensionContext) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.copyPathWithContent', copyPathWithContent),
        vscode.commands.registerCommand('copy-path-with-code.clearClipboard', clearClipboard)
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}