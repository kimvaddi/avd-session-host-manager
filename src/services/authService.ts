import * as vscode from 'vscode';
import { AccessToken, TokenCredential } from '@azure/identity';
import { SubscriptionClient, Subscription } from '@azure/arm-subscriptions';

/**
 * Wraps a VS Code authentication session as an Azure SDK TokenCredential.
 * This lets all Azure SDK clients use the token from VS Code's built-in
 * Microsoft Entra ID sign-in (browser-based, MFA/Conditional Access compatible).
 */
class VsCodeTokenCredential implements TokenCredential {
    constructor(private getSessionFn: () => Promise<vscode.AuthenticationSession>) {}

    async getToken(): Promise<AccessToken> {
        const session = await this.getSessionFn();
        // VS Code session tokens don't expose expiry; set a short expiry
        // so the SDK will call getToken() frequently and we always re-fetch
        // a fresh session (VS Code handles caching/refresh internally).
        return {
            token: session.accessToken,
            expiresOnTimestamp: Date.now() + 5 * 60 * 1000,
        };
    }
}

export class AuthService {
    private credential: TokenCredential | undefined;
    private session: vscode.AuthenticationSession | undefined;
    private subscriptionId: string | undefined;
    private subscriptionName: string | undefined;
    private context: vscode.ExtensionContext;

    private static readonly SCOPES = ['https://management.azure.com/.default'];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.subscriptionId = context.globalState.get<string>('avd.subscriptionId');
        this.subscriptionName = context.globalState.get<string>('avd.subscriptionName');
    }

    /**
     * Sign in using VS Code's built-in Microsoft authentication provider.
     * This opens a browser window for Entra ID (Azure AD) sign-in.
     * It supports MFA, Conditional Access, and any enterprise security policy.
     */
    async signIn(): Promise<void> {
        const session = await vscode.authentication.getSession(
            'microsoft',
            AuthService.SCOPES,
            { createIfNone: true }
        );

        this.session = session;
        this.credential = new VsCodeTokenCredential(async () => {
            // On each token request, silently get the current session.
            // VS Code refreshes tokens behind the scenes.
            const refreshed = await vscode.authentication.getSession(
                'microsoft',
                AuthService.SCOPES,
                { createIfNone: false }
            );
            if (!refreshed) {
                throw new Error('Azure session expired. Please sign in again.');
            }
            return refreshed;
        });

        await this.selectSubscription();
    }

    signOut(): void {
        this.credential = undefined;
        this.session = undefined;
        this.subscriptionId = undefined;
        this.subscriptionName = undefined;
        this.context.globalState.update('avd.subscriptionId', undefined);
        this.context.globalState.update('avd.subscriptionName', undefined);
    }

    isSignedIn(): boolean {
        return this.credential !== undefined && this.session !== undefined;
    }

    getCredential(): TokenCredential {
        if (!this.credential) {
            throw new Error('Not signed in to Azure. Please sign in first.');
        }
        return this.credential;
    }

    getSubscriptionId(): string {
        if (!this.subscriptionId) {
            throw new Error('No subscription selected. Please select a subscription first.');
        }
        return this.subscriptionId;
    }

    getSubscriptionName(): string | undefined {
        return this.subscriptionName;
    }

    getAccountName(): string | undefined {
        return this.session?.account.label;
    }

    async selectSubscription(): Promise<void> {
        const credential = this.getCredential();
        const subscriptionClient = new SubscriptionClient(credential);
        const subscriptions: Subscription[] = [];

        for await (const sub of subscriptionClient.subscriptions.list()) {
            subscriptions.push(sub);
        }

        if (subscriptions.length === 0) {
            throw new Error('No Azure subscriptions found for this account.');
        }

        if (subscriptions.length === 1) {
            const sub = subscriptions[0];
            this.subscriptionId = sub.subscriptionId!;
            this.subscriptionName = sub.displayName;
            await this.context.globalState.update('avd.subscriptionId', this.subscriptionId);
            await this.context.globalState.update('avd.subscriptionName', this.subscriptionName);
            vscode.window.showInformationMessage(`Selected subscription: ${this.subscriptionName}`);
            return;
        }

        const items = subscriptions.map(sub => ({
            label: sub.displayName || 'Unknown',
            description: sub.subscriptionId || '',
            subscriptionId: sub.subscriptionId!,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an Azure subscription',
            canPickMany: false,
        });

        if (!selected) {
            throw new Error('No subscription selected.');
        }

        this.subscriptionId = selected.subscriptionId;
        this.subscriptionName = selected.label;
        await this.context.globalState.update('avd.subscriptionId', this.subscriptionId);
        await this.context.globalState.update('avd.subscriptionName', this.subscriptionName);
    }

    async listSubscriptions(): Promise<Subscription[]> {
        const credential = this.getCredential();
        const subscriptionClient = new SubscriptionClient(credential);
        const subscriptions: Subscription[] = [];
        for await (const sub of subscriptionClient.subscriptions.list()) {
            subscriptions.push(sub);
        }
        return subscriptions;
    }
}
