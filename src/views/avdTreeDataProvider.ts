import * as vscode from 'vscode';
import { AvdService, HostPoolInfo, SessionHostInfo, UserSessionInfo } from '../services/avdService';
import { AuthService } from '../services/authService';

export type AvdTreeItem = HostPoolTreeItem | SessionHostTreeItem | UserSessionTreeItem | SignInTreeItem;

export class AvdTreeDataProvider implements vscode.TreeDataProvider<AvdTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AvdTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private autoRefreshTimer: ReturnType<typeof setInterval> | undefined;

    constructor(
        private avdService: AvdService,
        private authService: AuthService
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    startAutoRefresh(intervalSeconds: number): void {
        this.stopAutoRefresh();
        if (intervalSeconds > 0) {
            this.autoRefreshTimer = setInterval(() => {
                if (this.authService.isSignedIn()) {
                    this.refresh();
                }
            }, intervalSeconds * 1000);
        }
    }

    stopAutoRefresh(): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = undefined;
        }
    }

    dispose(): void {
        this.stopAutoRefresh();
    }

    getTreeItem(element: AvdTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AvdTreeItem): Promise<AvdTreeItem[]> {
        if (!this.authService.isSignedIn()) {
            return [new SignInTreeItem()];
        }

        try {
            if (!element) {
                return this.getHostPools();
            }

            if (element instanceof HostPoolTreeItem) {
                return this.getSessionHosts(element.resourceGroup, element.hostPoolName);
            }

            if (element instanceof SessionHostTreeItem) {
                return this.getUserSessions(
                    element.resourceGroup,
                    element.hostPoolName,
                    element.sessionHostName
                );
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`AVD Explorer error: ${message}`);
        }

        return [];
    }

    private async getHostPools(): Promise<HostPoolTreeItem[]> {
        const pools = await this.avdService.listHostPools();
        return pools.map(p => new HostPoolTreeItem(p));
    }

    private async getSessionHosts(resourceGroup: string, hostPoolName: string): Promise<SessionHostTreeItem[]> {
        const hosts = await this.avdService.listSessionHosts(resourceGroup, hostPoolName);
        return hosts.map(h => new SessionHostTreeItem(h));
    }

    private async getUserSessions(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string
    ): Promise<UserSessionTreeItem[]> {
        const sessions = await this.avdService.listUserSessions(resourceGroup, hostPoolName, sessionHostName);
        return sessions.map(s => new UserSessionTreeItem(s));
    }
}

export class SignInTreeItem extends vscode.TreeItem {
    constructor() {
        super('Sign in to Azure...', vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: 'avd.signIn',
            title: 'Sign In',
        };
        this.iconPath = new vscode.ThemeIcon('sign-in');
    }
}

export class HostPoolTreeItem extends vscode.TreeItem {
    public readonly resourceGroup: string;
    public readonly hostPoolName: string;
    public readonly poolType: string;

    constructor(info: HostPoolInfo) {
        const name = info.hostPool.name || 'Unknown';
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.hostPoolName = name;
        this.resourceGroup = info.resourceGroup;
        this.poolType = info.hostPool.hostPoolType || 'Unknown';

        this.contextValue = 'hostPool';
        this.description = `${this.poolType} | ${info.resourceGroup}`;
        this.tooltip = new vscode.MarkdownString(
            `**${name}**\n\n` +
            `- Type: ${this.poolType}\n` +
            `- Resource Group: ${info.resourceGroup}\n` +
            `- Load Balancer: ${info.hostPool.loadBalancerType || 'N/A'}\n` +
            `- Max Sessions: ${info.hostPool.maxSessionLimit || 'N/A'}\n` +
            `- Ring: ${info.hostPool.ring || 'N/A'}`
        );
        this.iconPath = new vscode.ThemeIcon('server-environment');
    }
}

export class SessionHostTreeItem extends vscode.TreeItem {
    public readonly sessionHostName: string;
    public readonly hostPoolName: string;
    public readonly resourceGroup: string;
    public readonly status: string;
    public readonly allowNewSession: boolean;

    constructor(info: SessionHostInfo) {
        const sh = info.sessionHost;
        // Session host name from the API includes the full path; extract just the name
        const fullName = sh.name || 'Unknown';
        const shortName = fullName.includes('/') ? fullName.split('/').pop()! : fullName;

        super(shortName, vscode.TreeItemCollapsibleState.Collapsed);
        this.sessionHostName = shortName;
        this.hostPoolName = info.hostPoolName;
        this.resourceGroup = info.resourceGroup;
        this.status = sh.status || 'Unknown';
        this.allowNewSession = sh.allowNewSession ?? true;

        // Determine health state and icon
        const isDraining = !this.allowNewSession;
        const isAvailable = this.status === 'Available';
        const isUnavailable = this.status === 'Unavailable';

        if (isDraining) {
            this.contextValue = 'sessionHost-draining';
            this.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.orange'));
            this.description = `Draining | ${this.status}`;
        } else if (isAvailable) {
            this.contextValue = 'sessionHost-available';
            this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
            this.description = 'Available';
        } else if (isUnavailable) {
            this.contextValue = 'sessionHost-unavailable';
            this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.red'));
            this.description = 'Unavailable';
        } else {
            this.contextValue = 'sessionHost-unknown';
            this.iconPath = new vscode.ThemeIcon('question');
            this.description = this.status;
        }

        const sessions = sh.sessions ?? 0;
        const lastHeartbeat = sh.lastHeartBeat
            ? new Date(sh.lastHeartBeat).toLocaleString()
            : 'N/A';

        this.tooltip = new vscode.MarkdownString(
            `**${shortName}**\n\n` +
            `- Status: ${this.status}\n` +
            `- Drain Mode: ${isDraining ? 'ON' : 'OFF'}\n` +
            `- Active Sessions: ${sessions}\n` +
            `- Last Heartbeat: ${lastHeartbeat}\n` +
            `- OS Version: ${sh.osVersion || 'N/A'}\n` +
            `- Agent Version: ${sh.agentVersion || 'N/A'}`
        );
    }
}

export class UserSessionTreeItem extends vscode.TreeItem {
    public readonly sessionId: string;
    public readonly sessionHostName: string;
    public readonly hostPoolName: string;
    public readonly resourceGroup: string;
    public readonly userName: string;

    constructor(info: UserSessionInfo) {
        const us = info.userSession;
        const userName = us.activeDirectoryUserName || us.userPrincipalName || 'Unknown User';
        super(userName, vscode.TreeItemCollapsibleState.None);

        this.userName = userName;
        this.sessionHostName = info.sessionHostName;
        this.hostPoolName = info.hostPoolName;
        this.resourceGroup = info.resourceGroup;

        // Extract session ID from the name (format: hostpool/sessionhost/sessionId)
        const nameParts = (us.name || '').split('/');
        this.sessionId = nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';

        this.contextValue = 'userSession';
        const sessionState = us.sessionState || 'Unknown';
        const applicationType = us.applicationType || 'Unknown';
        this.description = `${sessionState} | ${applicationType}`;

        const stateIcon = sessionState === 'Active'
            ? new vscode.ThemeColor('charts.green')
            : new vscode.ThemeColor('charts.yellow');
        this.iconPath = new vscode.ThemeIcon('person', stateIcon);

        this.tooltip = new vscode.MarkdownString(
            `**${userName}**\n\n` +
            `- Session State: ${sessionState}\n` +
            `- Application Type: ${applicationType}\n` +
            `- Session Host: ${info.sessionHostName}\n` +
            `- Session ID: ${this.sessionId}\n` +
            `- Created: ${us.createTime ? new Date(us.createTime).toLocaleString() : 'N/A'}`
        );
    }
}
