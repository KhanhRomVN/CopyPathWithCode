export class PathUtils {

    static normalizeForTree(path: string): string {
        return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    }

    static getFileExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

        if (lastDot > lastSlash && lastDot > 0) {
            return filePath.substring(lastDot + 1).toLowerCase();
        }

        return '';
    }

    static getFileName(filePath: string): string {
        const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        return filePath.substring(lastSlash + 1);
    }

    static getFileNameWithoutExtension(filePath: string): string {
        const fileName = PathUtils.getFileName(filePath);
        const lastDot = fileName.lastIndexOf('.');

        if (lastDot > 0) {
            return fileName.substring(0, lastDot);
        }

        return fileName;
    }

    static getParentPath(filePath: string): string {
        const normalized = PathUtils.normalizeForTree(filePath);
        const lastSlash = normalized.lastIndexOf('/');

        if (lastSlash > 0) {
            return normalized.substring(0, lastSlash);
        }

        return '';
    }

    static isValidPath(path: string): boolean {
        if (!path || typeof path !== 'string') {
            return false;
        }

        // Basic validation - no empty components, no dangerous patterns
        const normalized = PathUtils.normalizeForTree(path);
        const parts = normalized.split('/');

        return parts.every(part =>
            part.length > 0 &&
            part !== '.' &&
            part !== '..' &&
            !part.includes(':') // Avoid colon in paths (like "output:tasks")
        );
    }

    static splitPath(path: string): string[] {
        const normalized = PathUtils.normalizeForTree(path);
        return normalized.split('/').filter(part => part.length > 0);
    }

    static joinPaths(...parts: string[]): string {
        return parts
            .map(part => PathUtils.normalizeForTree(part))
            .filter(part => part.length > 0)
            .join('/');
    }
}