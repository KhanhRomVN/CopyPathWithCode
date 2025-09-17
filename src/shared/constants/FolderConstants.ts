export const FOLDER_CONSTANTS = {
    // Context Values
    CONTEXT_VALUES: {
        FOLDER: 'folder',
        FILE: 'file',
        DIRECTORY: 'directory',
        FILE_MANAGEMENT_HEADER: 'fileManagementHeader',
        FILE_MANAGEMENT_FILE: 'fileManagementFile',
        FILE_MANAGEMENT_DIRECTORY: 'fileManagementDirectory',
        SELECT_ALL_FILES: 'selectAllFiles',
        DESELECT_ALL_FILES: 'deselectAllFiles',
        CONFIRM_FILE_MANAGEMENT: 'confirmFileManagement',
        CANCEL_FILE_MANAGEMENT: 'cancelFileManagement'
    },

    // View Modes
    VIEW_MODES: {
        WORKSPACE: 'workspace' as const,
        GLOBAL: 'global' as const
    },

    // File Management Modes
    FILE_MANAGEMENT_MODES: {
        NORMAL: 'normal' as const,
        ADD: 'add' as const,
        REMOVE: 'remove' as const
    },

    // Icons
    ICONS: {
        FOLDER: 'folder',
        FOLDER_OPENED: 'folder-opened',
        FOLDER_LIBRARY: 'folder-library',
        FILE: 'file',
        ADD: 'add',
        REMOVE: 'remove',
        CHECK: 'check',
        CHECK_ALL: 'check-all',
        CLOSE: 'close',
        CLOSE_ALL: 'close-all',
        COPY: 'copy',
        EDIT: 'edit',
        TRASH: 'trash',
        EYE: 'eye'
    },

    // Validation Rules
    VALIDATION: {
        MIN_FOLDER_NAME_LENGTH: 1,
        MAX_FOLDER_NAME_LENGTH: 100,
        FORBIDDEN_FOLDER_CHARS: /[<>:"/\\|?*]/,
        MAX_FILES_PER_FOLDER: 1000
    },

    // Commands
    COMMANDS: {
        CREATE_FOLDER: 'copy-path-with-code.createFolder',
        DELETE_FOLDER: 'copy-path-with-code.deleteFolder',
        RENAME_FOLDER: 'copy-path-with-code.renameFolder',
        ADD_FILE_TO_FOLDER: 'copy-path-with-code.addFileToFolder',
        REMOVE_FILE_FROM_FOLDER: 'copy-path-with-code.removeFileFromFolder',
        OPEN_FOLDER_FILES: 'copy-path-with-code.openFolderFiles',
        COPY_FOLDER_CONTENTS: 'copy-path-with-code.copyFolderContents',
        TOGGLE_VIEW_MODE: 'copy-path-with-code.toggleViewMode',
        REFRESH_FOLDER_VIEW: 'copy-path-with-code.refreshFolderView'
    }
};