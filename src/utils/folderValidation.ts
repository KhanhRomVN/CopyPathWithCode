// src/utils/folderValidation.ts
import * as vscode from 'vscode';
import { state } from '../models/models';
import { Logger } from './logger';
import { saveFolders } from './folderUtils';

/**
 * Validates the existence of files in all folders and removes invalid ones
 */
export async function validateFolderFiles(context: vscode.ExtensionContext): Promise<void> {
    Logger.debug('Starting folder files validation');

    let totalRemovedFiles = 0;
    let foldersModified = 0;

    for (const folder of state.folders) {
        const originalFileCount = folder.files.length;
        const validFiles: string[] = [];

        for (const fileUri of folder.files) {
            try {
                const uri = vscode.Uri.parse(fileUri);

                // Check if file exists
                await vscode.workspace.fs.stat(uri);
                validFiles.push(fileUri);

            } catch (error) {
                Logger.warn(`File no longer exists, removing from folder "${folder.name}": ${fileUri}`);
                totalRemovedFiles++;
            }
        }

        // Update folder if files were removed
        if (validFiles.length !== originalFileCount) {
            folder.files = validFiles;
            foldersModified++;
        }
    }

    // Save changes if any modifications were made
    if (foldersModified > 0) {
        saveFolders(context);
        Logger.info(`Validation complete: ${totalRemovedFiles} invalid files removed from ${foldersModified} folders`);
    } else {
        Logger.debug('Validation complete: All files are valid');
    }
}