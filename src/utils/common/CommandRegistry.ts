/**
 * FILE: src/utils/common/CommandRegistry.ts
 * 
 * COMMAND REGISTRY UTILITY
 * 
 * Prevents duplicate command registration by tracking registered commands
 */

import * as vscode from 'vscode';
import { Logger } from './logger';

export class CommandRegistry {
    private static registeredCommands = new Set<string>();

    static registerCommand(
        context: vscode.ExtensionContext,
        command: string,
        callback: (...args: any[]) => any,
        thisArg?: any
    ): void {
        if (this.registeredCommands.has(command)) {
            Logger.warn(`Command '${command}' is already registered. Skipping duplicate registration.`);
            return;
        }

        try {
            const disposable = vscode.commands.registerCommand(command, callback, thisArg);
            context.subscriptions.push(disposable);
            this.registeredCommands.add(command);
            Logger.debug(`Successfully registered command: ${command}`);
        } catch (error) {
            Logger.error(`Failed to register command '${command}'`, error);
            throw error;
        }
    }

    static isRegistered(command: string): boolean {
        return this.registeredCommands.has(command);
    }

    static getRegisteredCommands(): string[] {
        return Array.from(this.registeredCommands);
    }

    static clear(): void {
        this.registeredCommands.clear();
        Logger.debug('Command registry cleared');
    }
}