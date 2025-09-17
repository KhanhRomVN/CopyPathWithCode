/**
 * FILE: src/utils/fileWatcher.ts
 * 
 * FILE WATCHER - THEO DÕI THAY ĐỔI FILE
 * 
 * Theo dõi sự thay đổi của file system và xử lý khi file bị xóa.
 * 
 * Chức năng chính:
 * - Theo dõi sự kiện xóa file trong workspace
 * - Tự động xóa file đã bị xóa khỏi các thư mục trong extension
 * - Cập nhật UI khi có thay đổi
 * - Singleton pattern để đảm bảo chỉ có 1 instance
 */

import * as vscode from 'vscode';
import { state } from '../models/models';
import { saveFolders } from './folderUtils';
import { Logger } from './logger';

export class FileWatcher {
    private static instance: FileWatcher;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];

    static init(context: vscode.ExtensionContext): FileWatcher {
        if (!this.instance) {
            this.instance = new FileWatcher(context);
        }
        return this.instance;
    }

    private constructor(private context: vscode.ExtensionContext) {
        this.setupFileWatcher();
    }

    private setupFileWatcher() {
        // Watch for file deletions in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

        this.disposables.push(
            this.fileWatcher.onDidDelete((uri) => {
                this.handleFileDeleted(uri);
            })
        );

        Logger.info('File watcher initialized');
    }

    private handleFileDeleted(deletedUri: vscode.Uri) {
        const deletedUriString = deletedUri.toString();
        Logger.info(`File deleted: ${deletedUriString}`);

        let hasChanges = false;

        // Check all folders for the deleted file
        for (const folder of state.folders) {
            const beforeCount = folder.files.length;
            folder.files = folder.files.filter(fileUri => fileUri !== deletedUriString);
            const afterCount = folder.files.length;

            if (beforeCount !== afterCount) {
                hasChanges = true;
                Logger.info(`Removed deleted file from folder "${folder.name}": ${deletedUriString}`);
            }
        }

        // Save changes if any files were removed
        if (hasChanges) {
            saveFolders(this.context);
            // Refresh folder tree view
            vscode.commands.executeCommand('copy-path-with-code.refreshFolderView');

            vscode.window.showInformationMessage(
                'Removed deleted files from folders automatically'
            );
        }
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        Logger.info('File watcher disposed');
    }
}