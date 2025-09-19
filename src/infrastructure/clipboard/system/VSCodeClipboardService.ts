import * as vscode from 'vscode';
import { IClipboardSystemService } from '../../../domain/clipboard/services/ClipboardService';

export class VSCodeClipboardService implements IClipboardSystemService {

    async readClipboard(): Promise<string> {
        return await vscode.env.clipboard.readText();
    }

    async writeClipboard(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }
}