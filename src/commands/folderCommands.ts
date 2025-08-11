import * as vscode from 'vscode';
import { state, Folder } from '../models/models';
import { saveFolders } from '../utils/folderUtils';
import { updateActiveFolderStatus, updateTabDecorations } from '../utils/uiUtils';
import { copyFolderContents } from '../utils/clipboardUtils';
import { FolderWebview } from '../views/folderWebview';
import { FolderTreeDataProvider } from '../providers/folderTreeDataProvider';
import { getFolderById } from '../utils/folderUtils';

export function registerFolderCommands(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const commands = [
        vscode.commands.registerCommand('copy-path-with-code.createFolder', () => createFolder(context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.addFileToFolder', () => showAddFileWebview(context)),
        vscode.commands.registerCommand('copy-path-with-code.removeFileFromFolder', () => showRemoveFileWebview(context)),
        vscode.commands.registerCommand('copy-path-with-code.openFolderFiles', (folder) => openFolderFiles(folder)),
        vscode.commands.registerCommand('copy-path-with-code.copyFolderContents', (folder) => copyFolderContents(folder)),
        // wrapper để đảm bảo context và treeDataProvider luôn được truyền khi lệnh gọi
        vscode.commands.registerCommand('copy-path-with-code.deleteFolder', (folder) => deleteFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.toggleTracking', (folder) => toggleTracking(folder)),
        vscode.commands.registerCommand('copy-path-with-code.renameFolder', (folder) => renameFolder(folder, context, treeDataProvider)),
        vscode.commands.registerCommand('copy-path-with-code.showFolderMenu', (folder) => showFolderMenu(folder))
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

/** Resolve đầu vào có thể là TreeItem (từ TreeView) hoặc Folder (model) -> trả về Folder từ state */
function resolveFolder(folderOrItem: any): Folder | undefined {
    if (!folderOrItem) return undefined;
    // Nếu có id -> tìm trong state theo id
    if (typeof folderOrItem.id === 'string') {
        return getFolderById(folderOrItem.id);
    }
    // Nếu có name + files có thể là Folder-like object -> so khớp theo name
    if (typeof folderOrItem.name === 'string') {
        return state.folders.find(f => f.name === folderOrItem.name);
    }
    return undefined;
}

async function createFolder(context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const name = await vscode.window.showInputBox({ prompt: 'Enter folder name', placeHolder: 'My Code Folder' });
    if (!name) { return; }
    const openFiles = vscode.window.visibleTextEditors.map(e => e.document.uri.toString());
    const folder: Folder = { id: Date.now().toString(), name, files: openFiles };
    state.folders.push(folder);
    saveFolders(context);
    treeDataProvider.refresh();
    vscode.window.showInformationMessage(`Folder "${name}" created with ${openFiles.length} files`);
}

async function showAddFileWebview(context: vscode.ExtensionContext) {
    if (!state.folders.length) {
        vscode.window.showInformationMessage('No folders available. Create a folder first.');
        return;
    }

    const folderPick = await vscode.window.showQuickPick(
        state.folders.map(f => ({ label: f.name, folder: f })),
        { placeHolder: 'Select folder to add files' }
    );

    if (folderPick) {
        FolderWebview.show(context, folderPick.folder.id, 'add');
        // Note: actual adding happens when webview gửi confirm; webview currently chưa post xử lý confirm -> có thể bổ sung để update ngay
    }
}

async function showRemoveFileWebview(context: vscode.ExtensionContext) {
    if (!state.folders.length) {
        vscode.window.showInformationMessage('No folders available.');
        return;
    }

    const folderPick = await vscode.window.showQuickPick(
        state.folders.map(f => ({ label: f.name, folder: f })),
        { placeHolder: 'Select folder to remove files' }
    );

    if (folderPick) {
        FolderWebview.show(context, folderPick.folder.id, 'remove');
    }
}

async function openFolderFiles(folderParam: any) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const options = ['Close existing tabs', 'Keep existing tabs'];
    const sel = await vscode.window.showQuickPick(options, { placeHolder: 'Handle existing tabs?' });
    if (!sel) { return; }
    if (sel === options[0]) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    }
    const unique = Array.from(new Set(folder.files));
    for (const uri of unique) {
        await vscode.window.showTextDocument(vscode.Uri.parse(uri), { preview: false });
    }
    state.activeFolderId = folder.id;
    updateActiveFolderStatus();
    vscode.window.showInformationMessage(`Opened ${unique.length} files from "${folder.name}"`);
}

async function deleteFolder(folderParam: any, context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const confirm = await vscode.window.showQuickPick(
        ['Cancel', `Delete "${folder.name}"`],
        { placeHolder: `Are you sure you want to delete "${folder.name}"?` }
    );
    if (confirm === `Delete "${folder.name}"`) {
        state.folders = state.folders.filter(f => f.id !== folder.id);
        if (state.activeFolderId === folder.id) {
            state.activeFolderId = null;
            updateActiveFolderStatus();
        }
        saveFolders(context);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`Folder "${folder.name}" deleted`);
    }
}

async function toggleTracking(folderParam: any) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    state.activeFolderId = state.activeFolderId === folder.id ? null : folder.id;
    updateActiveFolderStatus();

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        updateTabDecorations(editor);
    }
}

async function renameFolder(folderParam: any, context: vscode.ExtensionContext, treeDataProvider: FolderTreeDataProvider) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const newName = await vscode.window.showInputBox({
        prompt: 'Enter new folder name',
        value: folder.name
    });

    if (newName && newName !== folder.name) {
        folder.name = newName;
        saveFolders(context);
        treeDataProvider.refresh();
        vscode.window.showInformationMessage(`Folder renamed to "${newName}"`);
    }
}

async function showFolderMenu(folderParam: any) {
    const folder = resolveFolder(folderParam);
    if (!folder) {
        vscode.window.showErrorMessage('Folder not found');
        return;
    }

    const selection = await vscode.window.showQuickPick([
        'Add File to Folder',
        'Remove File from Folder',
        'Open Folder Files',
        'Copy Folder Contents',
        'Toggle Tracking',
        'Rename Folder',
        'Delete Folder'
    ], {
        placeHolder: `Select action for "${folder.name}"`,
        title: 'Folder Actions'
    });

    if (selection) {
        const commandMap: Record<string, string> = {
            'Add File to Folder': 'copy-path-with-code.addFileToFolder',
            'Remove File from Folder': 'copy-path-with-code.removeFileFromFolder',
            'Open Folder Files': 'copy-path-with-code.openFolderFiles',
            'Copy Folder Contents': 'copy-path-with-code.copyFolderContents',
            'Toggle Tracking': 'copy-path-with-code.toggleTracking',
            'Rename Folder': 'copy-path-with-code.renameFolder',
            'Delete Folder': 'copy-path-with-code.deleteFolder'
        };

        // Gọi command và truyền vào Folder (không phải TreeItem)
        await vscode.commands.executeCommand(commandMap[selection], folder);
    }
}
