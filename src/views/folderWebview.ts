import * as vscode from 'vscode';
import * as path from 'path';
import { getFolderById } from '../utils/folderUtils';
import { Folder } from '../models/models';
import { saveFolders } from '../utils/folderUtils.js';

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
                { enableScripts: true, localResourceRoots: [context.extensionUri] }
            );

            this.currentPanel.onDidDispose(() => {
                this.currentPanel = undefined;
            });
        }

        // Lấy icon theme hiện tại
        const iconTheme = vscode.workspace.getConfiguration('workbench').get<string>('iconTheme') || '';

        this.currentPanel.webview.html = this.getWebviewContent(context, title, folder, mode, iconTheme);

        // Nhận message từ webview
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

            if (message.command === 'confirmSelection') {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
                const selectedPaths: string[] = message.paths.map((p: string) => vscode.Uri.file(
                    path.join(workspaceRoot, p)
                ).toString());

                if (mode === 'add') {
                    // Merge file mới
                    const existing = new Set(folder.files);
                    for (const file of selectedPaths) {
                        existing.add(file);
                    }
                    folder.files = Array.from(existing);
                    vscode.window.showInformationMessage(`Added ${selectedPaths.length} file(s) to ${folder.name}`);
                }
                else if (mode === 'remove') {
                    // Xóa file đã chọn
                    folder.files = folder.files.filter(f => !selectedPaths.includes(f));
                    vscode.window.showInformationMessage(`Removed ${selectedPaths.length} file(s) from ${folder.name}`);
                }

                // Lưu lại sau khi cập nhật
                saveFolders(context);
            }

            if (message.command === 'cancel') {
                this.currentPanel?.dispose();
            }
        });

    }

    /** Build cây thư mục từ danh sách file path */
    private static buildTree(paths: string[]) {
        const root: any = {};
        for (const filePath of paths) {
            const relPath = vscode.workspace.asRelativePath(filePath).replace(/\\/g, '/');
            const parts = relPath.split('/').filter(Boolean);
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

    private static getWebviewContent(
        context: vscode.ExtensionContext,
        title: string,
        folder: Folder,
        mode: 'add' | 'remove',
        iconTheme: string
    ): string {
        const codiconUri = this.currentPanel!.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'media', 'codicon.css')
        );

        return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${title}</title>
            <link rel="stylesheet" href="${codiconUri}">
            <style>
                body {
                    font-family: var(--vscode-font-family, Arial);
                    font-size: 14px;
                    background-color: var(--vscode-editor-background, #1e1e1e);
                    color: var(--vscode-editor-foreground, #d4d4d4);
                    margin: 0;
                    padding: 10px;
                }
                h1 {
                    font-size: 17px;
                    margin-bottom: 10px;
                }
                ul {
                    list-style: none;
                    margin: 0;
                    padding-left: 18px;
                }
                .folder, .file {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 3px;
                    user-select: none;
                }
                .folder:hover, .file:hover {
                    background-color: var(--vscode-list-hoverBackground, #2a2d2e);
                }
                .icon {
                    width: 20px;
                    height: 20px;
                    margin-right: 6px;
                    flex-shrink: 0;
                    text-align: center;
                }
                input[type="checkbox"] {
                    margin-right: 6px;
                    cursor: pointer;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 5px 10px;
                    margin-right: 5px;
                    border-radius: 3px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div id="file-tree"><p>Loading...</p></div>
            <div class="actions" style="margin-top: 15px;">
                <button id="confirm-btn">Confirm</button>
                <button id="cancel-btn">Cancel</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const fileTreeContainer = document.getElementById('file-tree');
                const confirmBtn = document.getElementById('confirm-btn');
                const cancelBtn = document.getElementById('cancel-btn');
                const usingTheme = "${iconTheme}" !== "";

                vscode.postMessage({ command: 'requestFileList', mode: '${mode}' });

                const folderIconClosed = usingTheme
                    ? '<span class="codicon codicon-folder"></span>'
                    : '📁';
                const folderIconOpen = usingTheme
                    ? '<span class="codicon codicon-folder-opened"></span>'
                    : '📂';

                function getFileIcon(fileName) {
                    if (usingTheme) {
                        return '<span class="codicon codicon-file"></span>';
                    }
                    const ext = fileName.split('.').pop().toLowerCase();
                    switch(ext) {
                        case 'js': return '🟨';
                        case 'ts': return '🟦';
                        case 'json': return '📜';
                        case 'md': return '📝';
                        case 'html': return '🌐';
                        case 'css': return '🎨';
                        case 'png':
                        case 'jpg':
                        case 'jpeg':
                        case 'gif': return '🖼️';
                        case 'svg': return '✒️';
                        case 'pdf': return '📕';
                        case 'zip':
                        case 'rar': return '📦';
                        default: return '📄';
                    }
                }

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
                                        <input type="checkbox" class="select-box" data-path="\${fullPath}">
                                        <span class="icon">\${folderIconClosed}</span>\${name}
                                    </div>
                                    <div class="children" style="display:none;">\${renderTree(children, fullPath)}</div>
                                </li>
                            \`;
                        } else {
                            html += \`
                                <li>
                                    <div class="file" data-path="\${fullPath}">
                                        <input type="checkbox" class="select-box" data-path="\${fullPath}">
                                        <span class="icon">\${getFileIcon(name)}</span>\${name}
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
                            if (e.target.tagName.toLowerCase() === 'input') return;
                            e.stopPropagation();
                            const open = folderEl.getAttribute('data-open') === 'true';
                            folderEl.setAttribute('data-open', String(!open));
                            const iconEl = folderEl.querySelector('.icon');
                            iconEl.innerHTML = open ? folderIconClosed : folderIconOpen;
                            const childrenDiv = folderEl.nextElementSibling;
                            childrenDiv.style.display = open ? 'none' : 'block';
                        });
                    });

                    document.querySelectorAll('.select-box').forEach(box => {
                        box.addEventListener('change', () => {
                            handleCheckboxChange(box);
                        });
                    });
                }

                function handleCheckboxChange(box) {
                    const isChecked = box.checked;
                    const parentLi = box.closest('li');
                    if (parentLi) {
                        parentLi.querySelectorAll('.select-box').forEach(cb => {
                            cb.checked = isChecked;
                        });
                    }
                    updateParentStates(box);
                }

                function updateParentStates(box) {
                    let parentUl = box.closest('ul');
                    while (parentUl) {
                        const parentLi = parentUl.closest('li');
                        if (!parentLi) break;
                        const parentCheckbox = parentLi.querySelector('> .folder .select-box');
                        const childCheckboxes = parentLi.querySelectorAll('.children .select-box');
                        const checkedCount = Array.from(childCheckboxes).filter(cb => cb.checked).length;
                        if (checkedCount === 0) {
                            parentCheckbox.checked = false;
                            parentCheckbox.indeterminate = false;
                        } else if (checkedCount === childCheckboxes.length) {
                            parentCheckbox.checked = true;
                            parentCheckbox.indeterminate = false;
                        } else {
                            parentCheckbox.checked = false;
                            parentCheckbox.indeterminate = true;
                        }
                        parentUl = parentLi.closest('ul');
                    }
                }

                confirmBtn.onclick = () => {
                    const selectedPaths = Array.from(document.querySelectorAll('.select-box:checked'))
                        .map(cb => cb.getAttribute('data-path'));
                    vscode.postMessage({ command: 'confirmSelection', paths: selectedPaths });
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
