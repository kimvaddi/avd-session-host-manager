import * as vscode from 'vscode';
import { AvdService } from '../services/avdService';
import { AvdTreeDataProvider, UserSessionTreeItem } from '../views/avdTreeDataProvider';

export class UserSessionCommands {
    constructor(
        private avdService: AvdService,
        private treeDataProvider: AvdTreeDataProvider
    ) {}

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('avd.logoffUserSession', (item: UserSessionTreeItem) =>
                this.logoff(item)
            ),
            vscode.commands.registerCommand('avd.disconnectUserSession', (item: UserSessionTreeItem) =>
                this.disconnect(item)
            ),
            vscode.commands.registerCommand('avd.sendMessage', (item: UserSessionTreeItem) =>
                this.sendMessage(item)
            ),
            vscode.commands.registerCommand('avd.viewUserSessionDetails', (item: UserSessionTreeItem) =>
                this.viewDetails(item)
            )
        );
    }

    private async logoff(item: UserSessionTreeItem): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to log off ${item.userName}?`,
            { modal: true },
            'Log Off'
        );
        if (confirm !== 'Log Off') {
            return;
        }

        try {
            await this.avdService.logoffUserSession(
                item.resourceGroup,
                item.hostPoolName,
                item.sessionHostName,
                item.sessionId
            );
            vscode.window.showInformationMessage(`User ${item.userName} logged off.`);
            this.treeDataProvider.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to log off user: ${message}`);
        }
    }

    private async disconnect(item: UserSessionTreeItem): Promise<void> {
        try {
            await this.avdService.disconnectUserSession(
                item.resourceGroup,
                item.hostPoolName,
                item.sessionHostName,
                item.sessionId
            );
            vscode.window.showInformationMessage(`User ${item.userName} disconnected.`);
            this.treeDataProvider.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to disconnect user: ${message}`);
        }
    }

    private async sendMessage(item: UserSessionTreeItem): Promise<void> {
        const title = await vscode.window.showInputBox({
            prompt: 'Message title',
            placeHolder: 'e.g., Maintenance Notice',
        });
        if (!title) {
            return;
        }

        const body = await vscode.window.showInputBox({
            prompt: 'Message body',
            placeHolder: 'e.g., The system will restart in 30 minutes.',
        });
        if (!body) {
            return;
        }

        try {
            await this.avdService.sendMessage(
                item.resourceGroup,
                item.hostPoolName,
                item.sessionHostName,
                item.sessionId,
                title,
                body
            );
            vscode.window.showInformationMessage(`Message sent to ${item.userName}.`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to send message: ${message}`);
        }
    }

    private async viewDetails(item: UserSessionTreeItem): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'avdUserSessionDetails',
            `Session: ${item.userName}`,
            vscode.ViewColumn.One,
            { enableScripts: false }
        );

        panel.webview.html = this.getDetailsHtml(item);
    }

    private getDetailsHtml(item: UserSessionTreeItem): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-sessionNonce';">
    <style nonce="sessionNonce">
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
        table { border-collapse: collapse; width: 100%; }
        td, th { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
        th { font-weight: bold; width: 200px; }
    </style>
</head>
<body>
    <h2>User Session Details</h2>
    <table>
        <tr><th>User</th><td>${this.escapeHtml(item.userName)}</td></tr>
        <tr><th>Session ID</th><td>${this.escapeHtml(item.sessionId)}</td></tr>
        <tr><th>Session Host</th><td>${this.escapeHtml(item.sessionHostName)}</td></tr>
        <tr><th>Host Pool</th><td>${this.escapeHtml(item.hostPoolName)}</td></tr>
        <tr><th>Resource Group</th><td>${this.escapeHtml(item.resourceGroup)}</td></tr>
    </table>
</body>
</html>`;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
