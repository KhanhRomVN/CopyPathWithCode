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

        // Lắng nghe message từ webview
        this.currentPanel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'requestFileList') {
                let files: string[];
                if (mode === 'add') {
                    const allUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                    const existing = new Set(folder.files);
                    files = allUris
                        .map(uri => uri.fsPath)
                        .filter(fsPath => !existing.has(vscode.Uri.file(fsPath).toString()));
                } else {
                    files = folder.files.map(fs => vscode.Uri.parse(fs).fsPath);
                }

                const treeData = this.buildTree(files);
                this.currentPanel?.webview.postMessage({
                    command: 'updateFileTree',
                    tree: treeData
                });
            }
        });
    }

    /** Build cây thư mục từ danh sách file path */
    private static buildTree(paths: string[]) {
        const root: any = {};
        for (const filePath of paths) {
            // Chuyển sang path tương đối để đẹp hơn
            const relPath = vscode.workspace.asRelativePath(filePath).replace(/\\/g, '/');
            const parts = relPath.split('/').filter(Boolean); // bỏ phần rỗng
            let current = root;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = { __children: {} };
                }
                current = current[part].__children;
            }
        }
        return root;
    }

    private static getWebviewContent(title: string, folder: Folder, mode: 'add' | 'remove'): string {
        return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${title}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family, Arial);
                    font-size: var(--vscode-font-size, 13px);
                    background-color: var(--vscode-editor-background, #1e1e1e);
                    color: var(--vscode-editor-foreground, #d4d4d4);
                    margin: 0;
                    padding: 10px;
                }
                h1 {
                    font-size: 16px;
                    margin-bottom: 10px;
                }
                ul {
                    list-style: none;
                    margin: 0;
                    padding-left: 16px;
                }
                .folder, .file {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                .folder:hover, .file:hover {
                    background-color: var(--vscode-list-hoverBackground, #2a2d2e);
                }
                .selected {
                    background-color: var(--vscode-list-activeSelectionBackground, #094771) !important;
                    color: var(--vscode-list-activeSelectionForeground, #ffffff);
                }
                .icon {
                    width: 16px;
                    height: 16px;
                    margin-right: 5px;
                    flex-shrink: 0;
                }
                .actions {
                    margin-top: 15px;
                }
                button {
                    background-color: var(--vscode-button-background, #0e639c);
                    color: var(--vscode-button-foreground, #fff);
                    border: none;
                    padding: 5px 10px;
                    margin-right: 5px;
                    border-radius: 2px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground, #1177bb);
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div id="file-tree"><p>Loading...</p></div>
            <div class="actions">
                <button id="confirm-btn">Confirm</button>
                <button id="cancel-btn">Cancel</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const fileTreeContainer = document.getElementById('file-tree');
                const confirmBtn = document.getElementById('confirm-btn');
                const cancelBtn = document.getElementById('cancel-btn');

                vscode.postMessage({ command: 'requestFileList', mode: '${mode}' });

                const folderIconClosed = "📁";
                const folderIconOpen = "📂";
                const fileIcon = "📄";

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'updateFileTree') {
                        fileTreeContainer.innerHTML = renderTree(message.tree, '');
                        attachEvents();
                    }
                });

                function renderTree(tree, parentPath) {
                    let html = '<ul>';
                    for (const name in tree) {
                        const fullPath = parentPath ? parentPath + '/' + name : name;
                        const children = tree[name].__children;
                        const isFolder = Object.keys(children).length > 0;
                        if (isFolder) {
                            html += \`
                                <li>
                                    <div class="folder" data-path="\${fullPath}" data-open="false">
                                        <span class="icon">\${folderIconClosed}</span>\${name}
                                    </div>
                                    <div class="children" style="display:none;">\${renderTree(children, fullPath)}</div>
                                </li>
                            \`;
                        } else {
                            html += \`
                                <li>
                                    <div class="file" data-path="\${fullPath}">
                                        <span class="icon">\${fileIcon}</span>\${name}
                                    </div>
                                </li>
                            \`;
                        }
                    }
                    html += '</ul>';
                    return html;
                }

                function attachEvents() {
                    document.querySelectorAll('.folder').forEach(folderEl => {
                        folderEl.addEventListener('click', e => {
                            e.stopPropagation();
                            const open = folderEl.getAttribute('data-open') === 'true';
                            folderEl.setAttribute('data-open', String(!open));
                            folderEl.querySelector('.icon').textContent = open ? folderIconClosed : folderIconOpen;
                            const childrenDiv = folderEl.nextElementSibling;
                            childrenDiv.style.display = open ? 'none' : 'block';
                            toggleSelect(folderEl);
                        });
                    });

                    document.querySelectorAll('.file').forEach(fileEl => {
                        fileEl.addEventListener('click', e => {
                            e.stopPropagation();
                            toggleSelect(fileEl);
                        });
                    });
                }

                const selectedPaths = new Set();
                function toggleSelect(el) {
                    const path = el.getAttribute('data-path');
                    if (selectedPaths.has(path)) {
                        selectedPaths.delete(path);
                        el.classList.remove('selected');
                    } else {
                        selectedPaths.add(path);
                        el.classList.add('selected');
                    }
                }

                confirmBtn.onclick = () => {
                    vscode.postMessage({ command: 'confirmSelection', paths: Array.from(selectedPaths) });
                };

                cancelBtn.onclick = () => {
                    vscode.postMessage({ command: 'cancel' });
                };
            </script>
        </body>
        </html>
        `;
    }
}
