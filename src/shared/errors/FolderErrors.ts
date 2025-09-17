export class FolderError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'FolderError';
    }
}

export class FolderNotFoundError extends FolderError {
    constructor(folderId: string) {
        super(`Folder not found: ${folderId}`, 'FOLDER_NOT_FOUND');
    }
}

export class FolderNameInvalidError extends FolderError {
    constructor(name: string, reason: string) {
        super(`Invalid folder name "${name}": ${reason}`, 'FOLDER_NAME_INVALID');
    }
}

export class FolderAlreadyExistsError extends FolderError {
    constructor(name: string) {
        super(`Folder "${name}" already exists`, 'FOLDER_ALREADY_EXISTS');
    }
}

export class FileNotFoundError extends FolderError {
    constructor(fileUri: string) {
        super(`File not found: ${fileUri}`, 'FILE_NOT_FOUND');
    }
}

export class FileAlreadyInFolderError extends FolderError {
    constructor(fileUri: string) {
        super(`File already in folder: ${fileUri}`, 'FILE_ALREADY_IN_FOLDER');
    }
}

export class InvalidFileUriError extends FolderError {
    constructor(fileUri: string) {
        super(`Invalid file URI: ${fileUri}`, 'INVALID_FILE_URI');
    }
}

export class WorkspaceNotActiveError extends FolderError {
    constructor() {
        super('No active workspace found', 'WORKSPACE_NOT_ACTIVE');
    }
}
