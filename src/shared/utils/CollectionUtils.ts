export class CollectionUtils {

    static removeDuplicates<T>(array: T[], keySelector?: (item: T) => any): T[] {
        if (!keySelector) {
            return [...new Set(array)];
        }

        const seen = new Set();
        return array.filter(item => {
            const key = keySelector(item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    static groupBy<T, K>(array: T[], keySelector: (item: T) => K): Map<K, T[]> {
        const groups = new Map<K, T[]>();

        for (const item of array) {
            const key = keySelector(item);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        }

        return groups;
    }

    static partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
        const truthy: T[] = [];
        const falsy: T[] = [];

        for (const item of array) {
            if (predicate(item)) {
                truthy.push(item);
            } else {
                falsy.push(item);
            }
        }

        return [truthy, falsy];
    }

    static chunk<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];

        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }

        return chunks;
    }

    static findDifference<T>(array1: T[], array2: T[]): { added: T[], removed: T[] } {
        const set1 = new Set(array1);
        const set2 = new Set(array2);

        const added = array2.filter(item => !set1.has(item));
        const removed = array1.filter(item => !set2.has(item));

        return { added, removed };
    }
}