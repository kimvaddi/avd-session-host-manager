import { assert } from './testHelper';

// Direct unit tests for tree item construction — testing data model logic
// These tests validate that HostPoolTreeItem, SessionHostTreeItem, UserSessionTreeItem
// correctly parse Azure SDK response objects and set VS Code tree item properties.

describe('AVD Tree Items - Data Model Tests', () => {

    describe('HostPoolTreeItem', () => {
        it('should parse host pool name and resource group', () => {
            const { HostPoolTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new HostPoolTreeItem({
                hostPool: {
                    name: 'hp-prod-eastus',
                    id: '/subscriptions/sub1/resourceGroups/rg-avd/providers/Microsoft.DesktopVirtualization/hostpools/hp-prod-eastus',
                    hostPoolType: 'Pooled',
                    loadBalancerType: 'BreadthFirst',
                    maxSessionLimit: 10,
                },
                resourceGroup: 'rg-avd',
            });

            assert.strictEqual(item.hostPoolName, 'hp-prod-eastus');
            assert.strictEqual(item.resourceGroup, 'rg-avd');
            assert.strictEqual(item.poolType, 'Pooled');
            assert.strictEqual(item.contextValue, 'hostPool');
            assert.ok(item.description?.includes('Pooled'));
        });

        it('should handle missing optional fields gracefully', () => {
            const { HostPoolTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new HostPoolTreeItem({
                hostPool: { name: 'test-pool' },
                resourceGroup: 'rg-test',
            });

            assert.strictEqual(item.hostPoolName, 'test-pool');
            assert.strictEqual(item.poolType, 'Unknown');
        });
    });

    describe('SessionHostTreeItem', () => {
        it('should show available status with green icon', () => {
            const { SessionHostTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new SessionHostTreeItem({
                sessionHost: {
                    name: 'hp-prod-eastus/vm-avd-001.contoso.com',
                    status: 'Available',
                    allowNewSession: true,
                    sessions: 3,
                    lastHeartBeat: '2026-03-30T10:00:00Z',
                    osVersion: '10.0.22621',
                    agentVersion: '1.0.8431.1300',
                },
                hostPoolName: 'hp-prod-eastus',
                resourceGroup: 'rg-avd',
            });

            assert.strictEqual(item.sessionHostName, 'vm-avd-001.contoso.com');
            assert.strictEqual(item.status, 'Available');
            assert.strictEqual(item.allowNewSession, true);
            assert.strictEqual(item.contextValue, 'sessionHost-available');
            assert.strictEqual(item.description, 'Available');
        });

        it('should show draining status with orange icon', () => {
            const { SessionHostTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new SessionHostTreeItem({
                sessionHost: {
                    name: 'vm-avd-002.contoso.com',
                    status: 'Available',
                    allowNewSession: false,
                    sessions: 1,
                },
                hostPoolName: 'hp-prod-eastus',
                resourceGroup: 'rg-avd',
            });

            assert.strictEqual(item.contextValue, 'sessionHost-draining');
            assert.ok(item.description?.includes('Draining'));
        });

        it('should show unavailable status with red icon', () => {
            const { SessionHostTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new SessionHostTreeItem({
                sessionHost: {
                    name: 'vm-avd-003.contoso.com',
                    status: 'Unavailable',
                    allowNewSession: true,
                },
                hostPoolName: 'hp-prod-eastus',
                resourceGroup: 'rg-avd',
            });

            assert.strictEqual(item.contextValue, 'sessionHost-unavailable');
            assert.strictEqual(item.description, 'Unavailable');
        });

        it('should extract short name from full path', () => {
            const { SessionHostTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new SessionHostTreeItem({
                sessionHost: {
                    name: 'hostpool1/vm-test-001.domain.local',
                    status: 'Available',
                    allowNewSession: true,
                },
                hostPoolName: 'hostpool1',
                resourceGroup: 'rg-test',
            });

            assert.strictEqual(item.sessionHostName, 'vm-test-001.domain.local');
        });
    });

    describe('UserSessionTreeItem', () => {
        it('should parse user session fields', () => {
            const { UserSessionTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new UserSessionTreeItem({
                userSession: {
                    name: 'hp/sh/3',
                    activeDirectoryUserName: 'CONTOSO\\jdoe',
                    userPrincipalName: 'jdoe@contoso.com',
                    sessionState: 'Active',
                    applicationType: 'Desktop',
                    createTime: '2026-03-30T08:00:00Z',
                },
                sessionHostName: 'vm-avd-001.contoso.com',
                hostPoolName: 'hp-prod-eastus',
                resourceGroup: 'rg-avd',
            });

            assert.strictEqual(item.userName, 'CONTOSO\\jdoe');
            assert.strictEqual(item.sessionId, '3');
            assert.strictEqual(item.contextValue, 'userSession');
            assert.ok(item.description?.includes('Active'));
        });

        it('should fall back to userPrincipalName', () => {
            const { UserSessionTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new UserSessionTreeItem({
                userSession: {
                    name: 'hp/sh/5',
                    userPrincipalName: 'user@contoso.com',
                    sessionState: 'Disconnected',
                    applicationType: 'RemoteApp',
                },
                sessionHostName: 'vm-001',
                hostPoolName: 'hp1',
                resourceGroup: 'rg1',
            });

            assert.strictEqual(item.userName, 'user@contoso.com');
            assert.strictEqual(item.sessionId, '5');
        });
    });

    describe('SignInTreeItem', () => {
        it('should have sign-in command', () => {
            const { SignInTreeItem } = require('../../views/avdTreeDataProvider');
            const item = new SignInTreeItem();

            assert.ok(item.command);
            assert.strictEqual(item.command.command, 'avd.signIn');
        });
    });

    describe('AvdTreeDataProvider - Auto Refresh', () => {
        it('should expose startAutoRefresh and stopAutoRefresh methods', () => {
            const { AvdTreeDataProvider } = require('../../views/avdTreeDataProvider');
            const mockAvdService = {};
            const mockAuthService = { isSignedIn: () => false };
            const provider = new AvdTreeDataProvider(mockAvdService, mockAuthService);

            assert.strictEqual(typeof provider.startAutoRefresh, 'function');
            assert.strictEqual(typeof provider.stopAutoRefresh, 'function');
            assert.strictEqual(typeof provider.dispose, 'function');
        });

        it('should not throw when stopping auto-refresh that was never started', () => {
            const { AvdTreeDataProvider } = require('../../views/avdTreeDataProvider');
            const provider = new AvdTreeDataProvider({}, { isSignedIn: () => false });
            // Should not throw
            provider.stopAutoRefresh();
            provider.dispose();
        });

        it('should not throw when interval is 0 (disabled)', () => {
            const { AvdTreeDataProvider } = require('../../views/avdTreeDataProvider');
            const provider = new AvdTreeDataProvider({}, { isSignedIn: () => false });
            // 0 means disabled
            provider.startAutoRefresh(0);
            provider.dispose();
        });
    });
});
