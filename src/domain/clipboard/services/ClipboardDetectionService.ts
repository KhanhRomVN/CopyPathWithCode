/**
 * FILE: src/domain/clipboard/services/ClipboardDetectionService.ts
 * 
 * CLIPBOARD DETECTION SERVICE - Standardized clipboard content parsing
 * 
 * This service handles parsing clipboard content to detect file information
 * using standardized patterns and data structures.
 */

import * as path from 'path';

export interface DetectedFile {
    filePath: string;
    content: string;
    detectedAt: number;
}

export class ClipboardDetectionService {

    /**
     * Parse clipboard content and return detected files
     */
    parseClipboardContent(text: string): DetectedFile[] {
        if (!text || text.trim().length === 0) {
            return [];
        }

        // Parse multiple files separated by ---
        const sections = text.split(/\n\s*---\s*\n/).filter(section => section.trim());
        const detectedFiles: DetectedFile[] = [];

        for (const section of sections) {
            const file = this.parseFileSection(section.trim());
            if (file) {
                detectedFiles.push(file);
            }
        }

        return detectedFiles;
    }

    /**
     * Parse a single section of clipboard content to extract file information
     */
    private parseFileSection(section: string): DetectedFile | null {
        // Pattern 1: FILENAME:\n```\nCONTENT\n```
        let match = section.match(/^([^:\n]+):\s*\n```\s*\n([\s\S]*?)\n```\s*$/);

        if (match) {
            const filePath = match[1].trim();
            const content = match[2];

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

            if (content) {
                return {
                    filePath: fullPath,
                    content,
                    detectedAt: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * Check if a string looks like a valid file path
     */
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
}