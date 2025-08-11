import * as vscode from 'vscode';
import * as path from 'path';
import { getFolderById } from '../utils/folderUtils';
import { Folder } from '../models/models';

export class FolderWebview {
    private static currentPanel: vscode.WebviewPanel | undefined;

    static show(context: vscode.ExtensionContext, folderId: string, mode: 'add' | 'remove') {
        const folder = getFolderById(folderId);
        if (!folder) return;

        const title = mode === 'add'
            ? `Add Files to ${folder.name}`
            : `Remove Files from ${folder.name}`;

        if (this.currentPanel) {
            this.currentPanel.reveal();
        } else {
            this.currentPanel = vscode.window.createWebviewPanel(
                'folderWebview',
                title,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            this.currentPanel.onDidDispose(() => {
                this.currentPanel = undefined;
            });
        }

        this.currentPanel.webview.html = this.getWebviewContent(title, folder, mode);
        // Handle messages from the webview for initial file list requests
        this.currentPanel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'requestFileList') {
                let files: { path: string }[];
                if (mode === 'add') {
                    const allUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                    const existing = new Set(folder.files);
                    files = allUris
                        .map(uri => uri.fsPath)
                        .filter(fsPath => !existing.has(vscode.Uri.file(fsPath).toString()))
                        .map(p => ({ path: p }));
                } else {
                    files = folder.files.map(fs => ({ path: vscode.Uri.parse(fs).fsPath }));
                }
                this.currentPanel?.webview.postMessage({ command: 'updateFileList', files });
            }
        });
    }

    private static getWebviewContent(title: string, folder: Folder, mode: 'add' | 'remove'): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                }
                h1 {
                    font-size: 18px;
                    margin-bottom: 20px;
                }
                .file-item {
                    padding: 5px 0;
                    cursor: pointer;
                }
                .file-item:hover {
                    background-color: #f0f0f0;
                }
                .actions {
                    margin-top: 20px;
                }
                button {
                    padding: 5px 10px;
                    margin-right: 10px;
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div id="file-tree">
                <!-- File list will be populated by JavaScript -->
                <p>.....</p>
            </div>
            <div class="actions">
                <button id="confirm-btn">Confirm</button>
                <button id="cancel-btn">Cancel</button>
            </div>
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    const fileTree = document.getElementById('file-tree');
                    const confirmBtn = document.getElementById('confirm-btn');
                    const cancelBtn = document.getElementById('cancel-btn');
                    
                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateFileList':
                                renderFileList(message.files);
                                break;
                        }
                    });
                    
                    // Request initial file list
                    vscode.postMessage({
                        command: 'requestFileList',
                        mode: '${mode}'
                    });
                    
                    function renderFileList(files) {
                        fileTree.innerHTML = '';
                        files.forEach(file => {
                            const item = document.createElement('div');
                            item.className = 'file-item';
                            item.textContent = file.path;
                            item.onclick = () => {
                                item.classList.toggle('selected');
                            };
                            fileTree.appendChild(item);
                        });
                    }
                    
                    confirmBtn.onclick = () => {
                        const selectedItems = Array.from(document.querySelectorAll('.file-item.selected'));
                        const selectedPaths = selectedItems.map(item => item.textContent);
                        vscode.postMessage({
                            command: 'confirmSelection',
                            paths: selectedPaths
                        });
                    };
                    
                    cancelBtn.onclick = () => {
                        vscode.postMessage({ command: 'cancel' });
                    };
                })();
            </script>
        </body>
        </html>`;
    }
}