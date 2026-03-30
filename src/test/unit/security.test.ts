import { assert } from './testHelper';

describe('Security Tests', () => {

    describe('HTML Escaping', () => {
        it('should escape XSS payloads in session host details', () => {
            const { SessionHostCommands } = require('../../commands/sessionHostCommands');
            const cmds = new SessionHostCommands({} as any, {} as any);

            // Access private escapeHtml
            const escape = (cmds as any).escapeHtml.bind(cmds);

            assert.strictEqual(escape('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            assert.strictEqual(escape('a&b'), 'a&amp;b');
            assert.strictEqual(escape("it's"), 'it&#039;s');
            assert.strictEqual(escape('normal text'), 'normal text');
        });

        it('should escape XSS payloads in user session details', () => {
            const { UserSessionCommands } = require('../../commands/userSessionCommands');
            const cmds = new UserSessionCommands({} as any, {} as any);

            const escape = (cmds as any).escapeHtml.bind(cmds);
            assert.strictEqual(escape('<img onerror=alert(1) src=x>'), '&lt;img onerror=alert(1) src=x&gt;');
        });

        it('should escape XSS payloads in diagnostics logs', () => {
            const { DiagnosticsCommands } = require('../../commands/diagnosticsCommands');
            const cmds = new DiagnosticsCommands({} as any);

            const escape = (cmds as any).escapeHtml.bind(cmds);
            assert.strictEqual(escape('"><script>'), '&quot;&gt;&lt;script&gt;');
        });
    });

    describe('Webview Content Security Policy', () => {
        it('session host detail webview should have CSP header', () => {
            const { SessionHostCommands } = require('../../commands/sessionHostCommands');
            const cmds = new SessionHostCommands({} as any, {} as any);

            const html = (cmds as any).getDetailsHtml({
                sessionHostName: 'test',
                hostPoolName: 'hp',
                resourceGroup: 'rg',
                status: 'Available',
                allowNewSession: true,
            });

            assert.ok(html.includes('Content-Security-Policy'), 'Should have CSP meta tag');
            assert.ok(html.includes("default-src 'none'"), 'Should restrict default-src to none');
        });

        it('user session detail webview should have CSP header', () => {
            const { UserSessionCommands } = require('../../commands/userSessionCommands');
            const cmds = new UserSessionCommands({} as any, {} as any);

            const html = (cmds as any).getDetailsHtml({
                userName: 'test',
                sessionId: '1',
                sessionHostName: 'sh',
                hostPoolName: 'hp',
                resourceGroup: 'rg',
            });

            assert.ok(html.includes('Content-Security-Policy'), 'Should have CSP meta tag');
        });
    });
});
