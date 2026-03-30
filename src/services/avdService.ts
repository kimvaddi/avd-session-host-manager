import {
    DesktopVirtualizationAPIClient,
    HostPool,
    SessionHost,
    UserSession,
    ScalingPlan,
} from '@azure/arm-desktopvirtualization';
import { ComputeManagementClient } from '@azure/arm-compute';
import { LogsQueryClient, LogsQueryResult } from '@azure/monitor-query';
import { AuthService } from './authService';

export interface HostPoolInfo {
    hostPool: HostPool;
    resourceGroup: string;
}

export interface SessionHostInfo {
    sessionHost: SessionHost;
    hostPoolName: string;
    resourceGroup: string;
}

export interface UserSessionInfo {
    userSession: UserSession;
    sessionHostName: string;
    hostPoolName: string;
    resourceGroup: string;
}

export class AvdService {
    private authService: AuthService;

    constructor(authService: AuthService) {
        this.authService = authService;
    }

    private getClient(): DesktopVirtualizationAPIClient {
        return new DesktopVirtualizationAPIClient(
            this.authService.getCredential(),
            this.authService.getSubscriptionId()
        );
    }

    private getComputeClient(): ComputeManagementClient {
        return new ComputeManagementClient(
            this.authService.getCredential(),
            this.authService.getSubscriptionId()
        );
    }

    // ──────────── Host Pools ────────────

    async listHostPools(): Promise<HostPoolInfo[]> {
        const client = this.getClient();
        const results: HostPoolInfo[] = [];
        for await (const hp of client.hostPools.list()) {
            // Extract resource group from the host pool ID
            const rgMatch = hp.id?.match(/\/resourceGroups\/([^/]+)\//i);
            const resourceGroup = rgMatch ? rgMatch[1] : '';
            results.push({ hostPool: hp, resourceGroup });
        }
        return results;
    }

    async getHostPool(resourceGroup: string, hostPoolName: string): Promise<HostPool> {
        const client = this.getClient();
        return client.hostPools.get(resourceGroup, hostPoolName);
    }

    // ──────────── Session Hosts ────────────

    async listSessionHosts(resourceGroup: string, hostPoolName: string): Promise<SessionHostInfo[]> {
        const client = this.getClient();
        const results: SessionHostInfo[] = [];
        for await (const sh of client.sessionHosts.list(resourceGroup, hostPoolName)) {
            results.push({ sessionHost: sh, hostPoolName, resourceGroup });
        }
        return results;
    }

    async updateSessionHostDrainMode(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string,
        allowNewSession: boolean
    ): Promise<SessionHost> {
        const client = this.getClient();
        return client.sessionHosts.update(resourceGroup, hostPoolName, sessionHostName, {
            sessionHost: { allowNewSession },
        });
    }

    async deleteSessionHost(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string
    ): Promise<void> {
        const client = this.getClient();
        await client.sessionHosts.delete(resourceGroup, hostPoolName, sessionHostName);
    }

    async restartSessionHostVM(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string
    ): Promise<void> {
        // Resolve the actual VM resource ID from the session host properties
        const client = this.getClient();
        const sh = await client.sessionHosts.get(resourceGroup, hostPoolName, sessionHostName);
        const vmResourceId = sh.resourceId; // e.g. /subscriptions/.../resourceGroups/rg-vms/providers/Microsoft.Compute/virtualMachines/vm-001

        const computeClient = this.getComputeClient();

        if (vmResourceId) {
            // Parse the actual VM resource group and name from the full resource ID
            const vmRgMatch = vmResourceId.match(/\/resourceGroups\/([^/]+)\//i);
            const vmNameMatch = vmResourceId.match(/\/virtualMachines\/([^/]+)$/i);
            if (vmRgMatch && vmNameMatch) {
                await computeClient.virtualMachines.beginRestartAndWait(vmRgMatch[1], vmNameMatch[1]);
                return;
            }
        }

        // Fallback: derive VM name from session host FQDN, use host pool RG
        const vmName = sessionHostName.split('.')[0];
        await computeClient.virtualMachines.beginRestartAndWait(resourceGroup, vmName);
    }

    // ──────────── User Sessions ────────────

    async listUserSessions(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string
    ): Promise<UserSessionInfo[]> {
        const client = this.getClient();
        const results: UserSessionInfo[] = [];
        for await (const us of client.userSessions.list(resourceGroup, hostPoolName, sessionHostName)) {
            results.push({ userSession: us, sessionHostName, hostPoolName, resourceGroup });
        }
        return results;
    }

    async logoffUserSession(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string,
        sessionId: string
    ): Promise<void> {
        const client = this.getClient();
        await client.userSessions.delete(resourceGroup, hostPoolName, sessionHostName, sessionId, {
            force: true,
        });
    }

    async disconnectUserSession(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string,
        sessionId: string
    ): Promise<void> {
        const client = this.getClient();
        await client.userSessions.disconnect(resourceGroup, hostPoolName, sessionHostName, sessionId);
    }

    async sendMessage(
        resourceGroup: string,
        hostPoolName: string,
        sessionHostName: string,
        sessionId: string,
        messageTitle: string,
        messageBody: string
    ): Promise<void> {
        const client = this.getClient();
        await client.userSessions.sendMessage(
            resourceGroup,
            hostPoolName,
            sessionHostName,
            sessionId,
            { sendMessage: { messageTitle, messageBody } }
        );
    }

    // ──────────── Scaling Plans ────────────

    async listScalingPlans(resourceGroup: string): Promise<ScalingPlan[]> {
        const client = this.getClient();
        const results: ScalingPlan[] = [];
        for await (const sp of client.scalingPlans.listByResourceGroup(resourceGroup)) {
            results.push(sp);
        }
        return results;
    }

    // ──────────── Diagnostics / Log Analytics ────────────

    async querySessionLogs(
        workspaceId: string,
        hostPoolName: string,
        hoursBack: number = 24
    ): Promise<LogsQueryResult> {
        const logsClient = new LogsQueryClient(this.authService.getCredential());
        const query = `
WVDConnections
| where TimeGenerated > ago(${hoursBack}h)
| where _ResourceId contains "${hostPoolName}"
| project TimeGenerated, UserName, SessionHostName, State, 
          CorrelationId, ClientOS, ClientVersion, ClientType
| order by TimeGenerated desc
| take 200
        `.trim();

        return logsClient.queryWorkspace(workspaceId, query, {
            duration: `PT${hoursBack}H`,
        });
    }

    async queryDisconnectReasons(
        workspaceId: string,
        hostPoolName: string,
        hoursBack: number = 24
    ): Promise<LogsQueryResult> {
        const logsClient = new LogsQueryClient(this.authService.getCredential());
        const query = `
let connections = WVDConnections
| where TimeGenerated > ago(${hoursBack}h)
| where _ResourceId contains "${hostPoolName}"
| where State == "Started" or State == "Completed" or State == "Failed";
let failures = WVDErrors
| where TimeGenerated > ago(${hoursBack}h)
| where _ResourceId contains "${hostPoolName}"
| project TimeGenerated, CorrelationId, CodeSymbolic, Message, Source;
connections
| join kind=leftouter (failures) on CorrelationId
| summarize
    ConnectionCount=count(),
    FailureCount=countif(State == "Failed"),
    SampleError=take_any(CodeSymbolic),
    SampleMessage=take_any(Message)
    by State, ClientOS, ClientType
| order by FailureCount desc, ConnectionCount desc
        `.trim();

        return logsClient.queryWorkspace(workspaceId, query, {
            duration: `PT${hoursBack}H`,
        });
    }
}
