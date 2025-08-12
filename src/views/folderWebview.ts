import * as vscode from 'vscode';
import * as path from 'path';
import { getFolderById } from '../utils/folderUtils';
import { Folder } from '../models/models';
import { saveFolders } from '../utils/folderUtils.js';

export class FolderWebview {
    private static panels: Record<'add' | 'remove', vscode.WebviewPanel | undefined> = { add: undefined, remove: undefined };
    private static treeDataProvider: import('../providers/folderTreeDataProvider').FolderTreeDataProvider | undefined;

    static show(context: vscode.ExtensionContext, folderId: string, mode: 'add' | 'remove', treeDataProvider?: import('../providers/folderTreeDataProvider').FolderTreeDataProvider) {
        if (treeDataProvider) {
            this.treeDataProvider = treeDataProvider;
        }
        const folder = getFolderById(folderId);
        if (!folder) return;

        const title = mode === 'add'
            ? `Add Files to ${folder.name}`
            : `Remove Files from ${folder.name}`;

        // Use separate panel per mode
        let panel = FolderWebview.panels[mode];
        if (panel) {
            panel.title = title;
            panel.reveal();
        } else {
            panel = vscode.window.createWebviewPanel(
                'folderWebview',
                title,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [context.extensionUri],
                    retainContextWhenHidden: true
                }
            );
            panel.onDidDispose(() => {
                FolderWebview.panels[mode] = undefined;
            });
            FolderWebview.panels[mode] = panel;
        }

        const themeKind = vscode.window.activeColorTheme.kind;
        const isDarkTheme = themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;

        panel.webview.html = this.getWebviewContent(context, title, folder, mode, isDarkTheme);

        // Nhận message từ webview
        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'requestFileList') {
                let files: string[];
                if (mode === 'add') {
                    const allUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                    // Show all workspace files; existing ones will be pre-checked via initialSelectedPaths
                    files = allUris.map(uri => uri.fsPath);
                } else {
                    files = folder.files.map(fs => vscode.Uri.parse(fs).fsPath);
                }

                const treeData = this.buildTree(files);
                panel.webview.postMessage({
                    command: 'updateFileTree',
                    tree: treeData
                });
            }

            if (message.command === 'confirmSelection') {
                // Update folder model
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
                const selectedPaths = (message.paths as string[]).map(p =>
                    vscode.Uri.file(path.join(workspaceRoot, p)).toString()
                );

                if (mode === 'add') {
                    folder.files = Array.from(new Set([...folder.files, ...selectedPaths]));
                    vscode.window.showInformationMessage(`Added ${selectedPaths.length} file(s) to ${folder.name}`);
                } else {
                    folder.files = folder.files.filter(f => !selectedPaths.includes(f));
                    vscode.window.showInformationMessage(`Removed ${selectedPaths.length} file(s) from ${folder.name}`);
                }

                // Persist and refresh in-place
                saveFolders(context);
                // Refresh extension view
                this.treeDataProvider?.refresh();
                // Refresh file tree after update
                {
                    let files: string[];
                    if (mode === 'add') {
                        const allUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
                        // Show all workspace files; pre-check existing via initialSelectedPaths
                        files = allUris.map(uri => uri.fsPath);
                    } else {
                        files = folder.files.map(f => vscode.Uri.parse(f).fsPath);
                    }
                    const treeData = this.buildTree(files);
                    panel.webview.postMessage({ command: 'updateFileTree', tree: treeData });
                }
            }

            if (message.command === 'cancel') {
                panel.dispose();
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
        isDarkTheme: boolean
    ): string {
        return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${title}</title>
            <style>
                :root {
                    --vscode-button-height: 28px;
                    --vscode-input-height: 26px;
                    --vscode-border-radius: 4px;
                    --vscode-border-width: 1px;
                    --vscode-border: rgba(255,255,255,0.12);
                    --vscode-focusBorder: #0078d4;
                }
                
                body {
                    font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
                    font-size: 13px;
                    background-color: var(--vscode-editor-background, #1e1e1e);
                    color: var(--vscode-editor-foreground, #d4d4d4);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                
                .container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    padding: 15px;
                    box-sizing: border-box;
                    gap: 12px;
                }
                
                .header {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.2));
                }
                
                h1 {
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0;
                    color: var(--vscode-titleBar-activeForeground, #ffffff);
                }
                
                .folder-info {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground, #cccccc);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .folder-icon {
                    color: var(--vscode-icon-foreground, #c5c5c5);
                }
                
                .search-container {
                    position: relative;
                    margin-top: 5px;
                }
                
                #search-input {
                    width: 100%;
                    padding: 6px 10px 6px 30px;
                    box-sizing: border-box;
                    border: var(--vscode-border-width) solid var(--vscode-input-border, rgba(255,255,255,0.1));
                    background-color: var(--vscode-input-background, #3c3c3c);
                    color: var(--vscode-input-foreground, #cccccc);
                    border-radius: var(--vscode-border-radius);
                    font-size: 13px;
                    outline: none;
                    height: var(--vscode-input-height);
                }
                
                #search-input:focus {
                    border-color: var(--vscode-focusBorder);
                    outline: 1px solid var(--vscode-focusBorder);
                }
                
                .search-icon {
                    position: absolute;
                    left: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--vscode-input-placeholderForeground, #7f7f7f);
                    pointer-events: none;
                }
                
                .file-tree-container {
                    flex: 1;
                    overflow: auto;
                    border: var(--vscode-border-width) solid var(--vscode-border);
                    border-radius: var(--vscode-border-radius);
                    background-color: var(--vscode-sideBar-background, #252526);
                    position: relative;
                }
                
                #file-tree {
                    padding: 8px 0;
                }
                
                .tree-placeholder {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: var(--vscode-disabledForeground, #6c6c6c);
                    text-align: center;
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
                    padding: 4px 8px;
                    border-radius: 3px;
                    user-select: none;
                    transition: background-color 0.1s ease;
                }
                
                .folder:hover, .file:hover {
                    background-color: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.08));
                }
                
                .folder:focus, .file:focus {
                    background-color: var(--vscode-list-focusBackground, rgba(255, 255, 255, 0.1));
                    outline: 1px solid var(--vscode-focusBorder);
                }
                
                .icon {
                    width: 20px;
                    height: 20px;
                    margin-right: 6px;
                    flex-shrink: 0;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    line-height: 20px;
                }
                
                .folder-icon {
                    color: var(--vscode-icon-foreground, #c5c5c5);
                }
                
                .file-icon {
                    color: var(--vscode-icon-foreground, #c5c5c5);
                }
                
                .checkbox-container {
                    position: relative;
                    margin-right: 6px;
                }
                
                input[type="checkbox"] {
                    opacity: 0;
                    position: absolute;
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    z-index: 1;
                }
                
                .custom-checkbox {
                    width: 18px;
                    height: 18px;
                    border: 1px solid var(--vscode-checkbox-border, rgba(255, 255, 255, 0.4));
                    border-radius: 3px;
                    background-color: var(--vscode-checkbox-background, #3c3c3c);
                    display: inline-block;
                    position: relative;
                    margin-right: 4px;
                }
                
                input[type="checkbox"]:checked + .custom-checkbox {
                    background-color: var(--vscode-checkbox-selectBackground, #0078d4);
                    border-color: var(--vscode-checkbox-selectBackground, #0078d4);
                }
                
                input[type="checkbox"]:checked + .custom-checkbox::after {
                    content: '';
                    position: absolute;
                    left: 6px;
                    top: 2px;
                    width: 5px;
                    height: 10px;
                    border: solid white;
                    border-width: 0 2px 2px 0;
                    transform: rotate(45deg);
                }
                
                input[type="checkbox"]:indeterminate + .custom-checkbox {
                    background-color: var(--vscode-checkbox-selectBackground, #0078d4);
                    border-color: var(--vscode-checkbox-selectBackground, #0078d4);
                }
                
                input[type="checkbox"]:indeterminate + .custom-checkbox::after {
                    content: '';
                    position: absolute;
                    left: 4px;
                    top: 8px;
                    width: 10px;
                    height: 2px;
                    background-color: white;
                }
                
                .children {
                    overflow: hidden;
                }
                
                .file-path {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground, #999999);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }
                
                .file-name {
                    flex: 0 0 auto;
                }
                
                .match-highlight {
                    background-color: ${isDarkTheme ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 204, 0, 0.5)'};
                    border-radius: 2px;
                    padding: 0 2px;
                }
                
                .actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    padding-top: 10px;
                    border-top: 1px solid var(--vscode-sideBarSectionHeader-border, rgba(128, 128, 128, 0.2));
                }
                
                button {
                    height: var(--vscode-button-height);
                    padding: 0 12px;
                    border: none;
                    border-radius: var(--vscode-border-radius);
                    font-size: 13px;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }
                
                #confirm-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                
                #confirm-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                #cancel-btn {
                    background-color: transparent;
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-secondaryBackground);
                }
                
                #cancel-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${title}</h1>
                    <div class="folder-info">
                        <span class="icon">📁</span>
                        <span>Folder ID: ${folder.id}</span>
                    </div>
                    <div class="search-container">
                        <span class="search-icon">🔍</span>
                        <input id="search-input" type="text" placeholder="Search files..." autocomplete="off">
                    </div>
                </div>
                
                <div class="file-tree-container">
                    <div id="file-tree"><p class="tree-placeholder">Loading file structure...</p></div>
                </div>
                
                <div class="actions">
                    <button id="cancel-btn">Cancel</button>
                    <button id="confirm-btn">${mode === 'add' ? 'Add Selected' : 'Remove Selected'}</button>
                </div>
            </div>

            <script>
                // Pre-check in "add" mode: existing folder files are checked by default
                const initialSelectedPaths = ${JSON.stringify(
            mode === 'add'
                ? folder.files.map(fs => {
                    const fsPath = vscode.Uri.parse(fs).fsPath;
                    return vscode.workspace.asRelativePath(fsPath).replace(/\\/g, '/');
                })
                : []
        )};
                const vscode = acquireVsCodeApi();
                const fileTreeContainer = document.getElementById('file-tree');
                const searchInput = document.getElementById('search-input');
                const confirmBtn = document.getElementById('confirm-btn');
                const cancelBtn = document.getElementById('cancel-btn');
                let currentTreeData = null;
                let searchTerm = '';

                vscode.postMessage({ command: 'requestFileList', mode: '${mode}' });

                function getFileIcon(fileName) {
                    const ext = fileName.split('.').pop().toLowerCase();
                    const iconMap = {
                        // Programming languages
                        'js': '🟨', 'ts': '🟦', 'jsx': '⚛️', 'tsx': '⚛️',
                        'json': '📜', 'md': '📝', 'html': '🌐', 'htm': '🌐',
                        'css': '🎨', 'scss': '🎨', 'sass': '🎨', 'less': '🎨',
                        'php': '🐘', 'py': '🐍', 'rb': '💎', 'java': '☕', 'kt': '🔷', 'dart': '🎯',
                        'c': '🔧', 'cpp': '🔧', 'h': '🔧', 'hpp': '🔧', 'cs': '⚔️', 'swift': '🐦', 'go': '🐹',
                        'sql': '💾', 'pl': '🐪', 'lua': '🌙', 'rs': '🦀', 'sh': '💻', 'bat': '🪟', 'ps1': '💻',
                        
                        // Data formats
                        'xml': '📄', 'yml': '⚙️', 'yaml': '⚙️', 'toml': '⚙️', 'ini': '⚙️', 'cfg': '⚙️', 'conf': '⚙️',
                        'csv': '📊', 'tsv': '📊', 'xls': '📊', 'xlsx': '📊', 'ods': '📊',
                        
                        // Media files
                        'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'svg': '✒️', 'ico': '🖼️', 'webp': '🖼️',
                        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'ogg': '🎵', 'm4a': '🎵',
                        'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'mkv': '🎬', 'webm': '🎬', 'flv': '🎬',
                        
                        // Documents
                        'pdf': '📕', 'doc': '📄', 'docx': '📄', 'rtf': '📄', 'odt': '📄', 'txt': '📄', 'log': '📃',
                        'ppt': '📊', 'pptx': '📊', 'odp': '📊',
                        
                        // Archives
                        'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦', 'bz2': '📦', 'xz': '📦',
                        
                        // Executables
                        'exe': '⚙️', 'dll': '⚙️', 'so': '⚙️', 'dmg': '🍎', 'pkg': '🍎', 'deb': '🐧', 'rpm': '🐧',
                        'apk': '📱', 'ipa': '📱',
                        
                        // Configuration
                        'env': '⚙️', 'gitignore': '📁', 'dockerfile': '🐳', 'makefile': '⚙️', 'lock': '🔒'
                    };
                    
                    return iconMap[ext] || '📄';
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'updateFileTree') {
                        currentTreeData = message.tree;
                        fileTreeContainer.innerHTML = renderTree(currentTreeData, '');
                        attachEvents();
                        applySearchFilter();
                    }
                });

                function highlightMatches(text, term) {
                    if (!term) return text;
                    
                    const regex = new RegExp(escapeRegExp(term), 'gi');
                    return text.replace(regex, '<span class="match-highlight">$1</span>');
                }

                function escapeRegExp(string) {
                    return string.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
                }

                function renderTree(tree, parentPath) {
                    if (!tree || Object.keys(tree).length === 0) {
                        return '<p class="tree-placeholder">No files found</p>';
                    }
                    
                    let html = '<ul>';
                    for (const name in tree) {
                        const fullPath = parentPath ? parentPath + '/' + name : name;
                        const children = tree[name].__children;
                        const isFolder = Object.keys(children).length > 0;
                        const isVisible = searchTerm === '' || fullPath.toLowerCase().includes(searchTerm.toLowerCase());
                        
                        if (!isVisible) continue;
                        
                        if (isFolder) {
                            html += \`
                                <li>
                                    <div class="folder" data-path="\${fullPath}" data-open="true" tabindex="0">
                                        <span class="checkbox-container">
                                            <input type="checkbox" class="select-box" data-path="\${fullPath}" \${initialSelectedPaths.includes(fullPath) ? 'checked' : ''}>
                                            <span class="custom-checkbox"></span>
                                        </span>
                                        <span class="icon">📂</span>
                                        <span class="file-name">\${highlightMatches(name, searchTerm)}</span>
                                        <span class="file-path">/\${name}</span>
                                    </div>
                                    <div class="children">\${renderTree(children, fullPath)}</div>
                                </li>
                            \`;
                        } else {
                            html += \`
                                <li>
                                    <div class="file" data-path="\${fullPath}" tabindex="0">
                                        <span class="checkbox-container">
                                            <input type="checkbox" class="select-box" data-path="\${fullPath}" \${initialSelectedPaths.includes(fullPath) ? 'checked' : ''}>
                                            <span class="custom-checkbox"></span>
                                        </span>
                                        <span class="icon">\${getFileIcon(name)}</span>
                                        <span class="file-name">\${highlightMatches(name, searchTerm)}</span>
                                        <span class="file-path">\${fullPath}</span>
                                    </div>
                                </li>
                            \`;
                        }
                    }
                    html += '</ul>';
                    return html;
                }

                function applySearchFilter() {
                    searchTerm = searchInput.value.trim().toLowerCase();
                    
                    if (currentTreeData) {
                        fileTreeContainer.innerHTML = renderTree(currentTreeData, '');
                        attachEvents();
                    }
                }

                function attachEvents() {
                    // Folder toggle
                    document.querySelectorAll('.folder').forEach(folderEl => {
                        folderEl.addEventListener('click', e => {
                            if (e.target.closest('.checkbox-container')) return;
                            e.stopPropagation();
                            toggleFolder(folderEl);
                        });
                        
                        folderEl.addEventListener('keydown', e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleFolder(folderEl);
                            }
                        });
                    });
                    
                    // Checkbox handling
                    document.querySelectorAll('.select-box').forEach(box => {
                        box.addEventListener('change', () => {
                            handleCheckboxChange(box);
                        });
                    });
                    
                    // Focus styles
                    document.querySelectorAll('.folder, .file').forEach(el => {
                        el.addEventListener('focus', () => {
                            el.classList.add('focused');
                        });
                        
                        el.addEventListener('blur', () => {
                            el.classList.remove('focused');
                        });
                    });
                }
                
                function toggleFolder(folderEl) {
                    const open = folderEl.getAttribute('data-open') === 'true';
                    folderEl.setAttribute('data-open', String(!open));
                    const iconEl = folderEl.querySelector('.icon');
                    if (iconEl) iconEl.textContent = open ? '📁' : '📂';
                    const childrenDiv = folderEl.nextElementSibling;
                    if (childrenDiv) childrenDiv.style.display = open ? 'none' : 'block';
                }

                function handleCheckboxChange(box) {
                    const isChecked = box.checked;
                    const parentLi = box.closest('li');
                    
                    if (parentLi) {
                        // Update children
                        parentLi.querySelectorAll('.select-box').forEach(cb => {
                            cb.checked = isChecked;
                            cb.indeterminate = false;
                        });
                    }
                    
                    updateParentStates(box);
                }

                function updateParentStates(box) {
                    let parentUl = box.closest('ul');
                    while (parentUl) {
                        const parentLi = parentUl.closest('li');
                        if (!parentLi) break;
                        
                        const parentFolder = parentLi.querySelector('> .folder');
                        if (!parentFolder) {
                            parentUl = parentLi.closest('ul');
                            continue;
                        }
                        
                        const parentCheckbox = parentFolder.querySelector('.select-box');
                        const childCheckboxes = parentLi.querySelectorAll('.children .select-box');
                        
                        if (childCheckboxes.length === 0) {
                            parentUl = parentLi.closest('ul');
                            continue;
                        }
                        
                        const checkedCount = Array.from(childCheckboxes).filter(cb => cb.checked).length;
                        const indeterminateCount = Array.from(childCheckboxes).filter(cb => cb.indeterminate).length;
                        
                        if (checkedCount === 0 && indeterminateCount === 0) {
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

                // Search functionality
                searchInput.addEventListener('input', () => {
                    applySearchFilter();
                });
                
                searchInput.addEventListener('keydown', e => {
                    if (e.key === 'Escape') {
                        searchInput.value = '';
                        applySearchFilter();
                    }
                });

                confirmBtn.onclick = () => {
                    const selectedPaths = Array.from(document.querySelectorAll('.select-box:checked'))
                        .map(cb => cb.getAttribute('data-path'));
                    vscode.postMessage({ command: 'confirmSelection', paths: selectedPaths });
                };

                cancelBtn.onclick = () => {
                    vscode.postMessage({ command: 'cancel' });
                };
                
                // Set focus to search input
                setTimeout(() => {
                    searchInput.focus();
                }, 100);
            </script>
        </body>
        </html>
        `;
    }
}