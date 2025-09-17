export class ValidationUtils {

    static isNonEmptyString(value: any): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }

    static isValidArray<T>(value: any, itemValidator?: (item: any) => item is T): value is T[] {
        if (!Array.isArray(value)) {
            return false;
        }

        if (itemValidator) {
            return value.every(itemValidator);
        }

        return true;
    }

    static isValidUri(value: any): boolean {
        if (!this.isNonEmptyString(value)) {
            return false;
        }

        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    static isValidFileUri(value: any): boolean {
        if (!this.isValidUri(value)) {
            return false;
        }

        try {
            const url = new URL(value);
            return url.protocol === 'file:';
        } catch {
            return false;
        }
    }

    static sanitizeString(value: string, maxLength?: number): string {
        let sanitized = value.trim();

        if (maxLength && sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }

        return sanitized;
    }

    static isValidId(value: any): value is string {
        return this.isNonEmptyString(value) && /^[a-zA-Z0-9_-]+$/.test(value);
    }
}