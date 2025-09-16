import * as vscode from 'vscode';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { Logger } from '../utils/logger';
import path from 'path';
import { state } from '../models/models';
import { startAddFileMode } from './fileManagementCommands';

export function registerSearchCommands(
    context: vscode.ExtensionContext,
    treeDataProvider: FolderTreeDataProvider
) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.showSearchInput', async () => {
            await showSearchInput(treeDataProvider);
        }),
        vscode.commands.registerCommand('copy-path-with-code.clearSearch', () => {
            clearSearch(treeDataProvider);
        }),
        vscode.commands.registerCommand('copy-path-with-code.advancedSearch', async () => {
            await showAdvancedSearchOptions(treeDataProvider);
        })
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

async function showSearchInput(treeDataProvider: FolderTreeDataProvider) {
    if (!treeDataProvider.isInFileManagementMode()) {
        // Show warning with option to enter file management mode
        const choice = await vscode.window.showWarningMessage(
            'Search is only available in file management mode. Would you like to add files to a folder?',
            'Add Files', 'Cancel'
        );

        if (choice === 'Add Files') {
            // Show folder selection first
            if (state.folders.length === 0) {
                vscode.window.showInformationMessage('No folders available. Create a folder first.');
                return;
            }

            const folderChoices = state.folders.map(f => {
                const workspaceInfo = f.workspaceFolder ? ` (${path.basename(f.workspaceFolder)})` : '';
                return {
                    label: f.name + workspaceInfo,
                    folder: f
                };
            });

            const pick = await vscode.window.showQuickPick(folderChoices, {
                placeHolder: 'Select folder to add files to',
                title: 'Choose Folder for File Management'
            });

            if (pick) {
                await startAddFileMode(treeDataProvider, pick.folder);
            }
        }
        return;
    }

    await treeDataProvider.showSearchInput();
}

// NEW: Clear search function
function clearSearch(treeDataProvider: FolderTreeDataProvider) {
    if (!treeDataProvider.isInFileManagementMode()) {
        vscode.window.showWarningMessage('Search is only available in file management mode');
        return;
    }

    treeDataProvider.clearSearch();
}

async function showAdvancedSearchOptions(treeDataProvider: FolderTreeDataProvider) {
    if (!treeDataProvider.isInFileManagementMode()) {
        vscode.window.showWarningMessage('Advanced search is only available in file management mode');
        return;
    }

    const options = [
        {
            label: 'Search by File Extension',
            description: 'Filter files by extension (e.g., .js, .ts, .py)',
            action: 'extension'
        },
        {
            label: 'Search by File Name Pattern',
            description: 'Use patterns like *test*, *config*, etc.',
            action: 'pattern'
        },
        {
            label: 'Search in Specific Directories',
            description: 'Limit search to certain folders',
            action: 'directory'
        },
        {
            label: 'Exclude Common Directories',
            description: 'Automatically exclude node_modules, .git, etc.',
            action: 'exclude'
        }
    ];

    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Choose advanced search option',
        title: 'Advanced Search Options'
    });

    if (!selection) return;

    let searchTerm = '';

    switch (selection.action) {
        case 'extension':
            const ext = await vscode.window.showInputBox({
                prompt: 'Enter file extension (with or without dot)',
                placeHolder: '.js, .ts, py, etc.',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Extension cannot be empty';
                    }
                    return null;
                }
            });
            if (ext) {
                searchTerm = ext.startsWith('.') ? ext : `.${ext}`;
            }
            break;

        case 'pattern':
            searchTerm = await vscode.window.showInputBox({
                prompt: 'Enter search pattern',
                placeHolder: '*test*, config*, *util*',
                title: 'File Name Pattern Search'
            }) || '';
            break;

        case 'directory':
            searchTerm = await vscode.window.showInputBox({
                prompt: 'Enter directory path to search in',
                placeHolder: 'src/, components/, utils/',
                title: 'Directory-Specific Search'
            }) || '';
            break;

        case 'exclude':
            // Pre-defined exclusion patterns
            const excludePatterns = [
                'node_modules', '.git', 'dist', 'build',
                '.vscode', 'coverage', '.nyc_output'
            ];
            searchTerm = `!(${excludePatterns.join('|')})`;
            vscode.window.showInformationMessage('Excluding common build/config directories');
            break;
    }

    if (searchTerm) {
        treeDataProvider.updateSearchFilter(searchTerm);
    }
}