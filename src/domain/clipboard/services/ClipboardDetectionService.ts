import { ClipboardFileEntity } from '../entities/ClipboardFile';

export class ClipboardDetectionService {
    parseClipboardContent(text: string): ClipboardFileEntity[] {
        if (!text || text.trim().length === 0) {
            return [];
        }

        const sections = text.split(/\n\s*---\s*\n/).filter(section => section.trim());
        const detectedFiles: ClipboardFileEntity[] = [];

        for (const section of sections) {
            const file = this.parseFileSection(section.trim());
            if (file) {
                detectedFiles.push(file);
            }
        }

        return detectedFiles;
    }

    private parseFileSection(section: string): ClipboardFileEntity | null {
        // Pattern 1: FILENAME:\n```\nCONTENT\n```
        let match = section.match(/^([^:\n]+):\s*\n```\s*\n([\s\S]*?)\n```\s*$/);

        if (match) {
            const filePath = match[1].trim();
            const content = match[2];

            if (this.isValidFilePath(filePath) && content) {
                return ClipboardFileEntity.create(filePath, content);
            }
        }

        // Pattern 2: FILENAME:\n```language\nCONTENT\n```
        match = section.match(/^([^:\n]+):\s*\n```\w*\s*\n([\s\S]*?)\n```\s*$/);

        if (match) {
            const filePath = match[1].trim();
            const content = match[2];

            if (this.isValidFilePath(filePath) && content) {
                return ClipboardFileEntity.create(filePath, content);
            }
        }

        // Pattern 3: Handle line ranges like filename.ext:1-10
        match = section.match(/^([^:\n]+:\d+-\d+):\s*\n```\s*\n([\s\S]*?)\n```\s*$/);

        if (match) {
            const fullPath = match[1].trim();
            const content = match[2];

            if (content) {
                return ClipboardFileEntity.create(fullPath, content);
            }
        }

        return null;
    }

    private isValidFilePath(filePath: string): boolean {
        if (!filePath || filePath.trim().length === 0) {
            return false;
        }

        const cleanPath = filePath.split(':')[0];
        const hasExtension = /\.[a-zA-Z0-9]+$/.test(cleanPath);
        const isCommonFile = /^(Makefile|Dockerfile|README|LICENSE|CHANGELOG)$/i.test(
            cleanPath.split('/').pop() || ''
        );

        return hasExtension || isCommonFile;
    }
}