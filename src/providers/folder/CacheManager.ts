import * as vscode from 'vscode';

export class CacheManager {
    private treeCache: Map<string, vscode.TreeItem[]> = new Map();

    has(key: string): boolean {
        return this.treeCache.has(key);
    }

    get(key: string): vscode.TreeItem[] | undefined {
        return this.treeCache.get(key);
    }

    set(key: string, items: vscode.TreeItem[]): void {
        this.treeCache.set(key, items);
    }

    clearCache(): void {
        this.treeCache.clear();
    }

    getCacheSize(): number {
        return this.treeCache.size;
    }

    getCacheKeys(): string[] {
        return Array.from(this.treeCache.keys());
    }

    remove(key: string): boolean {
        return this.treeCache.delete(key);
    }

    // Clear cache entries matching a pattern
    clearCacheByPattern(pattern: RegExp): number {
        let removed = 0;
        for (const key of this.treeCache.keys()) {
            if (pattern.test(key)) {
                this.treeCache.delete(key);
                removed++;
            }
        }
        return removed;
    }
}