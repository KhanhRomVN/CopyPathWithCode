import * as vscode from 'vscode';
import { ServiceContainer } from '../../infrastructure/di/ServiceContainer';
import { ClipboardApplicationService } from '../../application/clipboard/service/ClipboardApplicationService';
import { CommandRegistry } from '../../utils/common/CommandRegistry';

export function registerClipboardCommands(context: vscode.ExtensionContext): void {
    const container = ServiceContainer.getInstance();
    const clipboardApplicationService = container.resolve<ClipboardApplicationService>('ClipboardApplicationService');

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContent',
        () => clipboardApplicationService.copyPathWithContent()
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.copyPathWithContentAndError',
        () => clipboardApplicationService.copyPathWithContentAndError()
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.clearClipboard',
        () => clipboardApplicationService.clearClipboard()
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.saveClipboardToTemp',
        () => clipboardApplicationService.saveClipboardToTemp()
    );

    CommandRegistry.registerCommand(
        context,
        'copy-path-with-code.restoreClipboardFromTemp',
        () => clipboardApplicationService.restoreClipboardFromTemp()
    );
}