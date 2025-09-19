/**
 * FILE: src/utils/clipboard/clipboardDetector.ts
 * 
 * CLIPBOARD DETECTOR - REFACTORED FOR CLEAN ARCHITECTURE
 * 
 * Fully integrated with clean architecture - no direct state manipulation.
 * Uses ServiceContainer to access ClipboardService and ClipboardDetectionService.
 */

import * as vscode from 'vscode';
import { Logger } from '../common/logger';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { ClipboardService } from '../../domain/clipboard/services/ClipboardService';
import { ClipboardDetectionService } from '../../domain/clipboard/services/ClipboardDetectionService';

export class ClipboardDetector {
    private static instance: ClipboardDetector;
    private updateInterval: NodeJS.Timeout | null = null;
    private lastClipboardContent: string = '';
    private clipboardService: ClipboardService;
    private detectionService: ClipboardDetectionService;
    private isDetectionEnabled: boolean = true;

    static init(context: vscode.ExtensionContext): ClipboardDetector {
        if (!this.instance) {
            this.instance = new ClipboardDetector(context);
            Logger.info('Clipboard detector initialized with clean architecture');
        }
        return this.instance;
    }

    private constructor(private context: vscode.ExtensionContext) {
        // Get services from ServiceContainer
        const container = ServiceContainer.getInstance();
        this.clipboardService = container.resolve<ClipboardService>('ClipboardService');
        this.detectionService = container.resolve<ClipboardDetectionService>('ClipboardDetectionService');

        this.startDetection();
    }

    private startDetection(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.checkClipboard();
        }, 1000); // Check every 1 second

        Logger.debug('Clipboard detection started');

        // Initial check
        this.checkClipboard();
    }

    private stopDetection(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            Logger.debug('Clipboard detection stopped');
        }
    }

    private async checkClipboard(): Promise<void> {
        // Check if detection is enabled
        if (!this.isDetectionEnabled) {
            return;
        }

        try {
            const clipboardText = await vscode.env.clipboard.readText();

            // Only process if clipboard content has changed
            if (clipboardText !== this.lastClipboardContent) {
                this.lastClipboardContent = clipboardText;
                Logger.debug('Clipboard content changed, parsing...');
                await this.parseClipboardContent(clipboardText);
            }
        } catch (error) {
            Logger.debug('Failed to read clipboard content', error);
        }
    }

    private async parseClipboardContent(text: string): Promise<void> {
        if (!text || text.trim().length === 0) {
            Logger.debug('Empty clipboard content, clearing detected files');
            // Use ClipboardService instead of direct state manipulation
            await this.clipboardService.clearDetectedFiles();
            this.refreshClipboardView();
            return;
        }

        Logger.debug('Parsing clipboard content:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));

        try {
            // Use the DetectionService to parse clipboard content
            const detectedFiles = this.detectionService.parseClipboardContent(text);

            if (detectedFiles.length > 0) {
                // Use ClipboardService to update detected files
                await this.clipboardService.updateDetectedFiles(detectedFiles);
                Logger.info(`Detected ${detectedFiles.length} file(s) in clipboard:`,
                    detectedFiles.map(f => f.filePath));
            } else {
                // If no valid files found but clipboard has content, clear the files list
                const currentDetectedFiles = this.clipboardService.getDetectedFiles();
                if (currentDetectedFiles.length > 0) {
                    Logger.debug('No valid files detected, clearing clipboard files');
                    await this.clipboardService.clearDetectedFiles();
                }
            }
        } catch (error) {
            Logger.error('Failed to parse clipboard content', error);
            // Clear detected files on parse error
            await this.clipboardService.clearDetectedFiles();
        }

        // Always trigger UI update
        this.refreshClipboardView();
    }

    private refreshClipboardView(): void {
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
    }

    // Public methods for external control
    public toggleDetection(enabled: boolean): void {
        this.isDetectionEnabled = enabled;

        if (enabled) {
            this.startDetection();
        } else {
            this.stopDetection();
        }
        Logger.info(`Clipboard detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    public async clearQueue(): Promise<void> {
        const currentFiles = this.clipboardService.getDetectedFiles();
        const count = currentFiles.length;

        await this.clipboardService.clearDetectedFiles();
        this.lastClipboardContent = ''; // Reset last content to force re-parse

        Logger.info(`Cleared ${count} file(s) from clipboard queue`);
        this.refreshClipboardView();
    }

    public getDetectionStatus(): boolean {
        return this.isDetectionEnabled;
    }

    public dispose(): void {
        this.stopDetection();
        Logger.info('Clipboard detector disposed');
    }

    // Static method to get the instance (for command access)
    public static getInstance(): ClipboardDetector | undefined {
        return this.instance;
    }
}