import { FOLDER_CONSTANTS } from '../../shared/constants/FolderConstants';

export class ViewModeManager {
    private viewMode: 'workspace' | 'global' = FOLDER_CONSTANTS.VIEW_MODES.WORKSPACE;

    getViewMode(): 'workspace' | 'global' {
        return this.viewMode;
    }

    setViewMode(mode: 'workspace' | 'global'): void {
        this.viewMode = mode;
    }

    isWorkspaceMode(): boolean {
        return this.viewMode === FOLDER_CONSTANTS.VIEW_MODES.WORKSPACE;
    }

    isGlobalMode(): boolean {
        return this.viewMode === FOLDER_CONSTANTS.VIEW_MODES.GLOBAL;
    }

    toggleViewMode(): 'workspace' | 'global' {
        this.viewMode = this.viewMode === FOLDER_CONSTANTS.VIEW_MODES.WORKSPACE
            ? FOLDER_CONSTANTS.VIEW_MODES.GLOBAL
            : FOLDER_CONSTANTS.VIEW_MODES.WORKSPACE;

        return this.viewMode;
    }
}