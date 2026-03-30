import * as vscode from 'vscode';
import { AvdService } from '../services/avdService';
import { AvdTreeDataProvider, SessionHostTreeItem } from '../views/avdTreeDataProvider';

export class SessionHostCommands {
    constructor(
        private avdService: AvdService,
        private treeDataProvider: AvdTreeDataProvider
    ) {}

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('avd.drainSessionHost', (item: SessionHostTreeItem) =>
                this.drain(item)
            ),
            vscode.commands.registerCommand('avd.undrainSessionHost', (item: SessionHostTreeItem) =>
                this.undrain(item)
            ),
            vscode.commands.registerCommand('avd.restartSessionHost', (item: SessionHostTreeItem) =>
                this.restart(item)
            ),
            vscode.commands.registerCommand('avd.deleteSessionHost', (item: SessionHostTreeItem) =>
                this.delete(item)
            ),
            vscode.commands.registerCommand('avd.viewSessionHostDetails', (item: SessionHostTreeItem) =>
                this.viewDetails(item)
            )
        );
    }

    private async drain(item: SessionHostTreeItem): Promise<void> {
        try {
            await this.avdService.updateSessionHostDrainMode(
                item.resourceGroup,
                item.hostPoolName,
                item.sessionHostName,
                false
            );
            vscode.window.showInformationMessage(`Drain mode enabled for ${item.sessionHostName}`);
            this.treeDataProvider.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to enable drain mode: ${message}`);
        }
    }

    private async undrain(item: SessionHostTreeItem): Promise<void> {
        try {
            await this.avdService.updateSessionHostDrainMode(
                item.resourceGroup,
                item.hostPoolName,
                item.sessionHostName,
                true
            );
            vscode.window.showInformationMessage(`Drain mode disabled for ${item.sessionHostName}`);
            this.treeDataProvider.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to disable drain mode: ${message}`);
        }
    }

    private async restart(item: SessionHostTreeItem): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to restart ${item.sessionHostName}? This will disconnect all active sessions.`,
            { modal: true },
            'Restart'
        );
        if (confirm !== 'Restart') {
            return;
        }

        try {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Restarting ${item.sessionHostName}...` },
                async () => {
                    await this.avdService.restartSessionHostVM(item.resourceGroup, item.hostPoolName, item.sessionHostName);
                }
            );
            vscode.window.showInformationMessage(`${item.sessionHostName} restart initiated.`);
            this.treeDataProvider.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to restart session host: ${message}`);
        }
    }

    private async delete(item: SessionHostTreeItem): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to DELETE session host ${item.sessionHostName}? This action cannot be undone.`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') {
            return;
        }

        try {
            await this.avdService.deleteSessionHost(
                item.resourceGroup,
                item.hostPoolName,
                item.sessionHostName
            );
            vscode.window.showInformationMessage(`Session host ${item.sessionHostName} deleted.`);
            this.treeDataProvider.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to delete session host: ${message}`);
        }
    }

    private async viewDetails(item: SessionHostTreeItem): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'avdSessionHostDetails',
            `Session Host: ${item.sessionHostName}`,
            vscode.ViewColumn.One,
            { enableScripts: false }
        );

        panel.webview.html = this.getDetailsHtml(item);
    }

    private getDetailsHtml(item: SessionHostTreeItem): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-detailsNonce';">
    <style nonce="detailsNonce">
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
        table { border-collapse: collapse; width: 100%; }
        td, th { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
        th { font-weight: bold; width: 200px; }
        .status-available { color: #4ec9b0; }
        .status-unavailable { color: #f44747; }
        .status-draining { color: #cca700; }
    </style>
</head>
<body>
    <h2>Session Host Details</h2>
    <table>
        <tr><th>Name</th><td>${this.escapeHtml(item.sessionHostName)}</td></tr>
        <tr><th>Host Pool</th><td>${this.escapeHtml(item.hostPoolName)}</td></tr>
        <tr><th>Resource Group</th><td>${this.escapeHtml(item.resourceGroup)}</td></tr>
        <tr><th>Status</th><td class="status-${item.status.toLowerCase()}">${this.escapeHtml(item.status)}</td></tr>
        <tr><th>Allow New Sessions</th><td>${item.allowNewSession ? 'Yes' : 'No (Draining)'}</td></tr>
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
