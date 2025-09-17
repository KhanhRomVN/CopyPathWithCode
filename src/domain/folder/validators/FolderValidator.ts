import { FOLDER_CONSTANTS } from '../../../shared/constants/FolderConstants';
import {
    FolderNameInvalidError,
    InvalidFileUriError
} from '../../../shared/errors/FolderErrors';

export class FolderValidator {

    validateFolderName(name: string): void {
        if (!name || typeof name !== 'string') {
            throw new FolderNameInvalidError(name, 'Name is required');
        }

        const trimmedName = name.trim();

        if (trimmedName.length === 0) {
            throw new FolderNameInvalidError(name, 'Name cannot be empty');
        }

        if (trimmedName.length < FOLDER_CONSTANTS.VALIDATION.MIN_FOLDER_NAME_LENGTH) {
            throw new FolderNameInvalidError(
                name,
                `Name must be at least ${FOLDER_CONSTANTS.VALIDATION.MIN_FOLDER_NAME_LENGTH} character(s)`
            );
        }

        if (trimmedName.length > FOLDER_CONSTANTS.VALIDATION.MAX_FOLDER_NAME_LENGTH) {
            throw new FolderNameInvalidError(
                name,
                `Name cannot exceed ${FOLDER_CONSTANTS.VALIDATION.MAX_FOLDER_NAME_LENGTH} characters`
            );
        }

        if (FOLDER_CONSTANTS.VALIDATION.FORBIDDEN_FOLDER_CHARS.test(trimmedName)) {
            throw new FolderNameInvalidError(
                name,
                'Name contains forbidden characters: < > : " / \\ | ? *'
            );
        }

        // Check for reserved names (Windows)
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4',
            'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2',
            'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];

        if (reservedNames.includes(trimmedName.toUpperCase())) {
            throw new FolderNameInvalidError(name, 'Name is reserved by the system');
        }
    }

    validateFileUri(fileUri: string): void {
        if (!fileUri || typeof fileUri !== 'string') {
            throw new InvalidFileUriError(fileUri);
        }

        try {
            const uri = new URL(fileUri);
            if (uri.protocol !== 'file:') {
                throw new InvalidFileUriError(fileUri);
            }
        } catch {
            throw new InvalidFileUriError(fileUri);
        }
    }

    validateFileUris(fileUris: string[]): void {
        if (!Array.isArray(fileUris)) {
            throw new Error('File URIs must be an array');
        }

        fileUris.forEach(uri => this.validateFileUri(uri));
    }

    validateFolderFileCount(currentCount: number, addingCount: number): void {
        const newCount = currentCount + addingCount;

        if (newCount > FOLDER_CONSTANTS.VALIDATION.MAX_FILES_PER_FOLDER) {
            throw new Error(
                `Folder would exceed maximum file limit of ${FOLDER_CONSTANTS.VALIDATION.MAX_FILES_PER_FOLDER} files`
            );
        }
    }
}