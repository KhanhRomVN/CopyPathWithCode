/**
 * FILE: src/utils/clipboardDetector.ts
 * 
 * CLIPBOARD DETECTOR - PHÁT HIỆN NỘI DUNG CLIPBOARD
 * 
 * Phát hiện và phân tích nội dung clipboard để tìm các file được copy.
 * 
 * Chức năng chính:
 * - Theo dõi thay đổi clipboard theo thời gian thực
 * - Phân tích nội dung clipboard để detect các file
 * - Hỗ trợ multiple patterns để nhận diện định dạng file
 * - Toggle detection (bật/tắt chức năng detect)
 * - Clear queue: xóa danh sách file đã detect
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { state, ClipboardFile } from '../../models/models';
import { Logger } from '../common/logger';

export class ClipboardDetector {
    private static instance: ClipboardDetector;
    private disposables: vscode.Disposable[] = [];
    private updateInterval: NodeJS.Timeout | null = null;
    private lastClipboardContent: string = '';

    static init(context: vscode.ExtensionContext) {
        if (!this.instance) {
            this.instance = new ClipboardDetector(context);
            Logger.info('Clipboard detector initialized');
        }
        return this.instance;
    }

    private constructor(private context: vscode.ExtensionContext) {
        this.startDetection();
    }

    startDetection() {
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

    stopDetection() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            Logger.debug('Clipboard detection stopped');
        }
    }

    async checkClipboard() {
        if (!state.isClipboardDetectionEnabled) {
            return;
        }

        try {
            const clipboardText = await vscode.env.clipboard.readText();

            // Only process if clipboard content has changed
            if (clipboardText !== this.lastClipboardContent) {
                this.lastClipboardContent = clipboardText;
                Logger.debug('Clipboard content changed, parsing...');
                this.parseClipboardContent(clipboardText);
            }
        } catch (error) {
            Logger.debug('Failed to read clipboard content', error);
        }
    }

    private parseClipboardContent(text: string) {
        if (!text || text.trim().length === 0) {
            Logger.debug('Empty clipboard content, clearing clipboard files');
            if (state.clipboardFiles.length > 0) {
                state.clipboardFiles = [];
                vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
            }
            return;
        }

        Logger.debug('Parsing clipboard content:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));

        // Parse multiple files separated by ---
        const sections = text.split(/\n\s*---\s*\n/).filter(section => section.trim());
        const detectedFiles: ClipboardFile[] = [];

        for (const section of sections) {
            const file = this.parseFileSection(section.trim());
            if (file) {
                detectedFiles.push(file);
            }
        }

        // Update state if we found files
        if (detectedFiles.length > 0) {
            state.clipboardFiles = detectedFiles;
            Logger.info(`Detected ${detectedFiles.length} file(s) in clipboard:`, detectedFiles.map(f => f.filePath));
        } else {
            // If no valid files found but clipboard has content, clear the files list
            if (state.clipboardFiles.length > 0) {
                Logger.debug('No valid files detected, clearing clipboard files');
                state.clipboardFiles = [];
            }
        }

        // Always trigger UI update
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
    }

    private parseFileSection(section: string): ClipboardFile | null {
        // More flexible pattern matching for file content
        // Pattern 1: FILENAME:\n```\nCONTENT\n```
        let match = section.match(/^([^:\n]+):\s*\n```\s*\n([\s\S]*?)\n```\s*$/);

        if (match) {
            const filePath = match[1].trim();
            const content = match[2];

            Logger.debug(`Found file pattern 1: ${filePath}`);

            if (this.isValidFilePath(filePath) && content) {
                return {
                    filePath,
                    content,
                    detectedAt: Date.now()
                };
            }
        }

        // Pattern 2: FILENAME:\n```language\nCONTENT\n```
        match = section.match(/^([^:\n]+):\s*\n```\w*\s*\n([\s\S]*?)\n```\s*$/);

        if (match) {
            const filePath = match[1].trim();
            const content = match[2];

            Logger.debug(`Found file pattern 2: ${filePath}`);

            if (this.isValidFilePath(filePath) && content) {
                return {
                    filePath,
                    content,
                    detectedAt: Date.now()
                };
            }
        }

        // Pattern 3: Handle line ranges like filename.ext:1-10
        match = section.match(/^([^:\n]+:\d+-\d+):\s*\n```\s*\n([\s\S]*?)\n```\s*$/);

        if (match) {
            const fullPath = match[1].trim();
            const content = match[2];

            Logger.debug(`Found file pattern 3 (with line range): ${fullPath}`);

            if (content) {
                return {
                    filePath: fullPath,
                    content,
                    detectedAt: Date.now()
                };
            }
        }

        Logger.debug('No valid file pattern found in section:', section.substring(0, 100));
        return null;
    }

    private isValidFilePath(filePath: string): boolean {
        if (!filePath || filePath.trim().length === 0) {
            return false;
        }

        // Remove line range if present (e.g., "file.js:1-10" -> "file.js")
        const cleanPath = filePath.split(':')[0];

        // Check if it looks like a file (has extension or common filename patterns)
        const hasExtension = /\.[a-zA-Z0-9]+$/.test(cleanPath);
        const isCommonFile = /^(Makefile|Dockerfile|README|LICENSE|CHANGELOG)$/i.test(path.basename(cleanPath));

        return hasExtension || isCommonFile;
    }

    clearQueue() {
        const count = state.clipboardFiles.length;
        state.clipboardFiles = [];
        this.lastClipboardContent = ''; // Reset last content to force re-parse
        Logger.info(`Cleared ${count} file(s) from clipboard queue`);
        vscode.commands.executeCommand('copy-path-with-code.refreshClipboardView');
    }

    toggleDetection(enabled: boolean) {
        state.isClipboardDetectionEnabled = enabled;
        if (enabled) {
            this.startDetection();
        } else {
            this.stopDetection();
        }
        Logger.info(`Clipboard detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    dispose() {
        this.stopDetection();
        this.disposables.forEach(d => d.dispose());
        Logger.info('Clipboard detector disposed');
    }
}