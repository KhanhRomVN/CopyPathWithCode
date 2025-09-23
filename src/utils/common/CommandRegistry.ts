/**
 * FILE: src/utils/common/CommandRegistry.ts
 * 
 * COMMAND REGISTRY - Prevents duplicate command registrations
 * 
 * This utility class tracks registered commands to prevent VSCode errors
 * when the same command is registered multiple times.
 */

import * as vscode from 'vscode';

export class CommandRegistry {
    private static registeredCommands: Set<string> = new Set();

    /**
     * Register a command if it hasn't been registered already
     */
    static registerCommand(
        context: vscode.ExtensionContext,
        command: string,
        handler: (...args: any[]) => any
    ): void {
        if (this.registeredCommands.has(command)) {
            console.warn(`Command already registered: ${command}. Skipping duplicate registration.`);
            return;
        }

        const disposable = vscode.commands.registerCommand(command, handler);
        context.subscriptions.push(disposable);
        this.registeredCommands.add(command);
    }

    /**
     * Register a text editor command if it hasn't been registered already
     */
    static registerTextEditorCommand(
        context: vscode.ExtensionContext,
        command: string,
        handler: (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => void
    ): void {
        if (this.registeredCommands.has(command)) {
            console.warn(`Text editor command already registered: ${command}. Skipping duplicate registration.`);
            return;
        }

        const disposable = vscode.commands.registerTextEditorCommand(command, handler);
        context.subscriptions.push(disposable);
        this.registeredCommands.add(command);
    }

    /**
     * Check if a command has been registered
     */
    static isRegistered(command: string): boolean {
        return this.registeredCommands.has(command);
    }

    /**
     * Get all registered commands
     */
    static getRegisteredCommands(): string[] {
        return Array.from(this.registeredCommands);
    }

    /**
     * Clear the registry (useful for testing or when deactivating extension)
     */
    static clear(): void {
        this.registeredCommands.clear();
    }

    /**
     * Get registration statistics
     */
    static getStats(): { total: number; commands: string[] } {
        return {
            total: this.registeredCommands.size,
            commands: Array.from(this.registeredCommands).sort()
        };
    }
}