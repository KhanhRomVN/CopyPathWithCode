import { IFolderTreeService } from '../../infrastructure/di/ServiceContainer';
import { FileNode } from '../../domain/folder/entities/FileNode';

export class SearchManager {
    private searchTerm: string = '';

    getCurrentSearchTerm(): string | null {
        return this.searchTerm || null;
    }

    setSearchFilter(
        searchTerm: string,
        folderTreeService: IFolderTreeService,
        viewMode: 'workspace' | 'global'
    ): { totalMatches: number; fileMatches: number; folderMatches: number } {
        this.searchTerm = searchTerm;
        return this.countSearchMatches(searchTerm, folderTreeService, viewMode);
    }

    hasActiveSearch(): boolean {
        return this.searchTerm.length > 0;
    }

    clearSearch(): void {
        this.searchTerm = '';
    }

    private countSearchMatches(
        searchTerm: string,
        folderTreeService: IFolderTreeService,
        viewMode: 'workspace' | 'global'
    ): { totalMatches: number; fileMatches: number; folderMatches: number } {
        let fileMatches = 0;
        let folderMatches = 0;

        try {
            const folders = viewMode === 'workspace'
                ? folderTreeService.getFoldersForWorkspace(folderTreeService.getCurrentWorkspaceFolder())
                : folderTreeService.getAllFolders();

            folders.forEach(folder => {
                // Check if folder name matches
                if (folder.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    folderMatches++;
                }

                // Check files in folder
                const fileTree = folderTreeService.buildFileTreeForFolder(folder.id);
                const matchingFiles = this.searchInFileTree(fileTree, searchTerm);
                fileMatches += matchingFiles;
            });
        } catch (error) {
            console.error('Error counting search matches:', error);
        }

        return {
            totalMatches: fileMatches + folderMatches,
            fileMatches,
            folderMatches
        };
    }

    private searchInFileTree(fileNodes: FileNode[], searchTerm: string): number {
        let matches = 0;
        const lowerSearchTerm = searchTerm.toLowerCase();

        const traverse = (nodes: FileNode[]) => {
            for (const node of nodes) {
                if (node.name.toLowerCase().includes(lowerSearchTerm)) {
                    if (node.isFile) {
                        matches++;
                    }
                }

                if (node.isDirectory) {
                    traverse(node.getChildrenArray());
                }
            }
        };

        traverse(fileNodes);
        return matches;
    }
}