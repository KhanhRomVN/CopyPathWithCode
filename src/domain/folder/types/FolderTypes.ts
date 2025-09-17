export interface FolderViewMode {
    mode: 'workspace' | 'global';
}

export interface FileManagementState {
    mode: 'normal' | 'add' | 'remove';
    folderId: string | null;
    selectedFiles: Set<string>;
    selectedFolders: Set<string>;
}

export interface TreeItemData {
    id: string;
    label: string;
    folderId?: string;
    treeNode?: any;
    contextValue: string;
    isFileManagementHeader?: boolean;
}

export interface FolderStatistics {
    totalFolders: number;
    totalFiles: number;
    averageFilesPerFolder: number;
    emptyFolders: number;
    foldersPerWorkspace: Map<string, number>;
}