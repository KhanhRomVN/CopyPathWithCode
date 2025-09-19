import * as vscode from 'vscode';
import { IClipboardSystemService } from '../../../domain/clipboard/services/ClipboardService';

export class VSCodeClipboardService implements IClipboardSystemService {
    async writeText(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }

    async readText(): Promise<string> {
        return await vscode.env.clipboard.readText();
    }
}