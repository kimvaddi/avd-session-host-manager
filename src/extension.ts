import * as vscode from 'vscode';
import { AuthService } from './services/authService';
import { AvdService } from './services/avdService';
import { AvdTreeDataProvider } from './views/avdTreeDataProvider';
import { SessionHostCommands } from './commands/sessionHostCommands';
import { UserSessionCommands } from './commands/userSessionCommands';
import { ImageCommands } from './commands/imageCommands';
import { ScalingCommands } from './commands/scalingCommands';
import { DiagnosticsCommands } from './commands/diagnosticsCommands';

let authService: AuthService;
let avdService: AvdService;
let treeDataProvider: AvdTreeDataProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    authService = new AuthService(context);
    avdService = new AvdService(authService);
    treeDataProvider = new AvdTreeDataProvider(avdService, authService);

    const treeView = vscode.window.createTreeView('avdExplorer', {
        treeDataProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // Auth commands
    context.subscriptions.push(
        vscode.commands.registerCommand('avd.signIn', async () => {
            try {
                await authService.signIn();
                await vscode.commands.executeCommand('setContext', 'avd.signedIn', true);
                treeDataProvider.refresh();
                const config = vscode.workspace.getConfiguration('avd');
                const interval = config.get<number>('autoRefreshIntervalSeconds', 30);
                treeDataProvider.startAutoRefresh(interval);
                const account = authService.getAccountName() || '';
                vscode.window.showInformationMessage(`Signed in to Azure as ${account}.`);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Azure sign-in failed: ${message}`);
            }
        }),
        vscode.commands.registerCommand('avd.signOut', async () => {
            authService.signOut();
            treeDataProvider.stopAutoRefresh();
            await vscode.commands.executeCommand('setContext', 'avd.signedIn', false);
            treeDataProvider.refresh();
            vscode.window.showInformationMessage('Signed out from Azure.');
        }),
        vscode.commands.registerCommand('avd.selectSubscription', async () => {
            try {
                await authService.selectSubscription();
                treeDataProvider.refresh();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Subscription selection failed: ${message}`);
            }
        }),
        vscode.commands.registerCommand('avd.refresh', () => {
            treeDataProvider.refresh();
        })
    );

    // Session host commands
    const sessionHostCmds = new SessionHostCommands(avdService, treeDataProvider);
    sessionHostCmds.register(context);

    // User session commands
    const userSessionCmds = new UserSessionCommands(avdService, treeDataProvider);
    userSessionCmds.register(context);

    // Image management commands
    const imageCmds = new ImageCommands();
    imageCmds.register(context);

    // Scaling plan commands
    const scalingCmds = new ScalingCommands();
    scalingCmds.register(context);

    // Diagnostics commands
    const diagnosticsCmds = new DiagnosticsCommands(avdService);
    diagnosticsCmds.register(context);

    // Auto-refresh configuration
    const startAutoRefresh = () => {
        const config = vscode.workspace.getConfiguration('avd');
        const interval = config.get<number>('autoRefreshIntervalSeconds', 30);
        treeDataProvider.startAutoRefresh(interval);
    };

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('avd.autoRefreshIntervalSeconds')) {
                startAutoRefresh();
            }
        })
    );

    // Set initial auth state
    if (authService.isSignedIn()) {
        await vscode.commands.executeCommand('setContext', 'avd.signedIn', true);
        startAutoRefresh();
    }

    context.subscriptions.push({ dispose: () => treeDataProvider.dispose() });
}

export function deactivate(): void {
    // Cleanup handled by dispose
}
