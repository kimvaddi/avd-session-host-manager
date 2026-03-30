import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration Tests', () => {
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('KimVaddi.avd-session-host-manager'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('KimVaddi.avd-session-host-manager');
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });

    test('All commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const avdCommands = [
            'avd.signIn',
            'avd.signOut',
            'avd.selectSubscription',
            'avd.refresh',
            'avd.drainSessionHost',
            'avd.undrainSessionHost',
            'avd.restartSessionHost',
            'avd.deleteSessionHost',
            'avd.viewSessionHostDetails',
            'avd.logoffUserSession',
            'avd.sendMessage',
            'avd.disconnectUserSession',
            'avd.viewUserSessionDetails',
            'avd.scaffoldPackerTemplate',
            'avd.scaffoldAIBTemplate',
            'avd.generateScalingPlan',
            'avd.viewSessionLogs',
            'avd.analyzeDisconnects',
        ];

        for (const cmd of avdCommands) {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });
});
