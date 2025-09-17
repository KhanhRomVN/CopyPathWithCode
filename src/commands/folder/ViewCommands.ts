import * as vscode from 'vscode';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { FolderProvider } from '../../providers/FolderProvider';
import { INotificationService } from '../../application/folder/service/FolderApplicationService';
import { IWorkspaceService } from '../../infrastructure/folder/workspace/WorkspaceService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';

export function registerViewCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const treeDataProvider = container.resolve<FolderProvider>('FolderProvider');
    const notificationService = container.resolve<INotificationService>('INotificationService');
    const workspaceService = container.resolve<IWorkspaceService>('IWorkspaceService');

    const commands = [
        // Refresh Commands
        {
            command: 'copy-path-with-code.refreshFolderView',
            handler: () => handleRefreshFolderView(treeDataProvider, notificationService)
        },

        // Search Commands
        {
            command: 'copy-path-with-code.showSearchInput',
            handler: () => handleShowSearchInput(treeDataProvider, notificationService)
        },

        {
            command: 'copy-path-with-code.clearSearch',
            handler: () => handleClearSearch(treeDataProvider, notificationService)
        }
    ];

    // Register commands with duplicate check
    commands.forEach(({ command, handler }) => {
        CommandRegistry.registerCommand(context, command, handler);
    });
}

// Rest of your handler functions remain the same...
function handleRefreshFolderView(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): void {
    try {
        // Clear any cached data
        treeDataProvider.clearCache();

        // Refresh the tree
        treeDataProvider.refresh();

        // Get current stats
        const currentMode = treeDataProvider.getViewMode();
        const folderCount = treeDataProvider.getFolderCount();

        const modeDisplay = currentMode === 'workspace' ? 'workspace' : 'global';
        notificationService.showInfo(`Folder view refreshed (${folderCount} folders in ${modeDisplay} view)`);

    } catch (error) {
        notificationService.showError(
            `Failed to refresh view: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

async function handleShowSearchInput(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): Promise<void> {
    const searchTerm = await vscode.window.showInputBox({
        prompt: 'Enter search term to filter files and folders',
        placeHolder: 'Search files and folders...',
        title: 'Search Files & Folders',
        value: treeDataProvider.getCurrentSearchTerm() || '',
        validateInput: (value) => {
            if (value && value.length > 100) {
                return 'Search term too long (max 100 characters)';
            }
            return null;
        }
    });

    if (searchTerm === undefined) {
        return;
    }

    if (!searchTerm.trim()) {
        handleClearSearch(treeDataProvider, notificationService);
        return;
    }

    try {
        const searchResults = treeDataProvider.setSearchFilter(searchTerm.trim());

        if (searchResults.totalMatches === 0) {
            notificationService.showInfo(`No results found for "${searchTerm}"`);
        } else {
            const fileText = searchResults.fileMatches === 1 ? 'file' : 'files';
            const folderText = searchResults.folderMatches === 1 ? 'folder' : 'folders';

            notificationService.showInfo(
                `Found ${searchResults.fileMatches} ${fileText} and ${searchResults.folderMatches} ${folderText} matching "${searchTerm}"`
            );
        }
    } catch (error) {
        notificationService.showError(
            `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

function handleClearSearch(
    treeDataProvider: FolderProvider,
    notificationService: INotificationService
): void {
    try {
        const hadSearch = treeDataProvider.hasActiveSearch();

        treeDataProvider.clearSearch();

        if (hadSearch) {
            notificationService.showInfo('Search filter cleared');
        } else {
            notificationService.showInfo('No active search to clear');
        }
    } catch (error) {
        notificationService.showError(
            `Failed to clear search: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}