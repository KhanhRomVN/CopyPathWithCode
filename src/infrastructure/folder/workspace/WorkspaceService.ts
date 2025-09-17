import * as vscode from 'vscode';
import * as path from 'path';

export interface IWorkspaceService {
    getCurrentWorkspaceFolder(): string | undefined;
    hasActiveWorkspace(): boolean;
    getAllWorkspaceFolders(): string[];
    getRelativePath(uri: string): string;
    isFileInWorkspace(uri: string): boolean;
    findFiles(pattern: string, exclude?: string): Promise<string[]>;
}

export class VSCodeWorkspaceService implements IWorkspaceService {

    getCurrentWorkspaceFolder(): string | undefined {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder?.uri.fsPath;
    }

    hasActiveWorkspace(): boolean {
        return vscode.workspace.workspaceFolders !== undefined &&
            vscode.workspace.workspaceFolders.length > 0;
    }

    getAllWorkspaceFolders(): string[] {
        return vscode.workspace.workspaceFolders?.map(wf => wf.uri.fsPath) || [];
    }

    getRelativePath(uri: string): string {
        const vscodeUri = vscode.Uri.parse(uri);
        return vscode.workspace.asRelativePath(vscodeUri);
    }

    isFileInWorkspace(uri: string): boolean {
        if (!this.hasActiveWorkspace()) {
            return false;
        }

        const vscodeUri = vscode.Uri.parse(uri);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscodeUri);
        return workspaceFolder !== undefined;
    }

    async findFiles(pattern: string, exclude?: string): Promise<string[]> {
        const excludePattern = exclude ? new vscode.RelativePattern('**', exclude) : undefined;
        const uris = await vscode.workspace.findFiles(pattern, excludePattern);
        return uris.map(uri => uri.toString());
    }

    getWorkspaceDisplayName(workspacePath?: string): string {
        if (!workspacePath) {
            return 'No Workspace';
        }
        return path.basename(workspacePath);
    }
}