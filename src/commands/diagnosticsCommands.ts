import * as vscode from 'vscode';
import { AvdService } from '../services/avdService';
import { HostPoolTreeItem } from '../views/avdTreeDataProvider';
import { LogsQueryResultStatus, LogsTable } from '@azure/monitor-query';

export class DiagnosticsCommands {
    constructor(private avdService: AvdService) {}

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('avd.viewSessionLogs', (item?: HostPoolTreeItem) =>
                this.viewSessionLogs(item)
            ),
            vscode.commands.registerCommand('avd.analyzeDisconnects', (item?: HostPoolTreeItem) =>
                this.analyzeDisconnects(item)
            )
        );
    }

    private async getWorkspaceId(): Promise<string | undefined> {
        // Check if workspace ID is configured in settings
        const config = vscode.workspace.getConfiguration('avd');
        const savedId = config.get<string>('logAnalyticsWorkspaceId', '').trim();
        if (savedId) {
            return savedId;
        }

        const workspaceId = await vscode.window.showInputBox({
            prompt: 'Enter the Log Analytics Workspace ID (or set avd.logAnalyticsWorkspaceId in settings)',
            placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            validateInput: (v) => {
                const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return guidPattern.test(v) ? null : 'Enter a valid GUID';
            },
        });
        return workspaceId;
    }

    private async viewSessionLogs(item?: HostPoolTreeItem): Promise<void> {
        const workspaceId = await this.getWorkspaceId();
        if (!workspaceId) {
            return;
        }

        const hostPoolName = item?.hostPoolName || await vscode.window.showInputBox({
            prompt: 'Enter host pool name',
            placeHolder: 'hp-prod-eastus',
        });
        if (!hostPoolName) {
            return;
        }

        try {
            const result = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Querying session logs...' },
                async () => this.avdService.querySessionLogs(workspaceId, hostPoolName)
            );

            if (result.status === LogsQueryResultStatus.Success && result.tables.length > 0) {
                const html = this.renderLogsTable(result.tables[0], `Session Logs: ${hostPoolName}`);
                this.showWebviewPanel(`Session Logs: ${hostPoolName}`, html);
            } else {
                vscode.window.showInformationMessage('No session logs found for the specified parameters.');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to query session logs: ${message}`);
        }
    }

    private async analyzeDisconnects(item?: HostPoolTreeItem): Promise<void> {
        const workspaceId = await this.getWorkspaceId();
        if (!workspaceId) {
            return;
        }

        const hostPoolName = item?.hostPoolName || await vscode.window.showInputBox({
            prompt: 'Enter host pool name',
            placeHolder: 'hp-prod-eastus',
        });
        if (!hostPoolName) {
            return;
        }

        try {
            const result = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Analyzing disconnect reasons...' },
                async () => this.avdService.queryDisconnectReasons(workspaceId, hostPoolName)
            );

            if (result.status === LogsQueryResultStatus.Success && result.tables.length > 0) {
                const html = this.renderLogsTable(result.tables[0], `Disconnect Analysis: ${hostPoolName}`);
                this.showWebviewPanel(`Disconnect Analysis: ${hostPoolName}`, html);
            } else {
                vscode.window.showInformationMessage('No disconnect data found for the specified parameters.');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to analyze disconnects: ${message}`);
        }
    }

    private renderLogsTable(table: LogsTable, title: string): string {
        const headers = table.columnDescriptors.map(c => `<th>${this.escapeHtml(c.name ?? 'unknown')}</th>`).join('');
        const rows = table.rows.map(row => {
            const cells = row.map(cell => `<td>${this.escapeHtml(String(cell ?? ''))}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-logsNonce';">
    <style nonce="logsNonce">
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
        h2 { margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th { background: var(--vscode-editor-background); position: sticky; top: 0; padding: 8px; text-align: left; border-bottom: 2px solid var(--vscode-panel-border); }
        td { padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
        tr:hover { background: var(--vscode-list-hoverBackground); }
        .count { color: var(--vscode-charts-blue); font-weight: bold; }
    </style>
</head>
<body>
    <h2>${this.escapeHtml(title)}</h2>
    <p>Rows returned: ${table.rows.length}</p>
    <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
    </table>
</body>
</html>`;
    }

    private showWebviewPanel(title: string, html: string): void {
        const panel = vscode.window.createWebviewPanel(
            'avdDiagnostics',
            title,
            vscode.ViewColumn.One,
            { enableScripts: false }
        );
        panel.webview.html = html;
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
