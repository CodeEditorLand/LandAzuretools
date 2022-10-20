import * as arm from '@azure/arm-subscriptions';
import * as vscode from 'vscode';

export interface AzureSubscription {
    readonly displayName: string;
    readonly id: string;

    getSession(scopes?: string[]): vscode.ProviderResult<vscode.AuthenticationSession>;
}

export type AzureSubscriptionsResult = {
    readonly allSubscriptions: AzureSubscription[];
    readonly selectedSubscriptions: AzureSubscription[];
}

export interface AzureSubscriptionProvider {
    getSubscriptions(): Promise<AzureSubscriptionsResult>;

    logIn(): Promise<void>;
    logOut(): Promise<void>;
    selectSubscriptions(subscriptionIds: string[] | undefined): Promise<void>;

    onSubscriptionsChanged: vscode.Event<void>;
}

export class VSCodeAzureSubscriptionProvider extends vscode.Disposable implements AzureSubscriptionProvider {
    private readonly _onSubscriptionsChanged = new vscode.EventEmitter<void>();

    constructor() {
        super(() => this._onSubscriptionsChanged.dispose());
    }

    async getSubscriptions(): Promise<AzureSubscriptionsResult> {
        const allSubscriptions: AzureSubscription[] = [];

        const defaultTenantSubscriptions = await this.getSubscriptionsFromTenant();

        allSubscriptions.push(...defaultTenantSubscriptions.subscriptions);

        // For now, only fetch subscriptions from individual tenants if none were found in the default tenant...
        if (allSubscriptions.length === 0) {
            for await (const tenant of defaultTenantSubscriptions.client.tenants.list()) {
                const tenantSubscriptions = await this.getSubscriptionsFromTenant(tenant.tenantId);
                allSubscriptions.push(...tenantSubscriptions.subscriptions);
            }
        }

        const selectedSubscriptionIds = vscode.workspace.getConfiguration('azure').get<string[] | undefined>('selectedSubscriptions');
        const selectedSubscriptions = allSubscriptions.filter(s => selectedSubscriptionIds === undefined || selectedSubscriptionIds.includes(s.id));

        return {
            allSubscriptions,
            selectedSubscriptions
        };
    }

    async selectSubscriptions(subscriptionIds: string[] | undefined): Promise<void> {
        await this.updateSelectedSubscriptions(subscriptionIds);

        this._onSubscriptionsChanged.fire();
    }

    readonly onSubscriptionsChanged = this._onSubscriptionsChanged.event;

    private async getSession(options?: { createNew?: boolean, scopes?: string | string[], tenantId?: string }): Promise<vscode.AuthenticationSession> {
        const scopeSet = new Set<string>(['https://management.azure.com/.default']);

        if (options) {
            if (typeof options.scopes === 'string') {
                scopeSet.add(options.scopes);
            }

            if (Array.isArray(options.scopes)) {
                for (const scope of options.scopes) {
                    scopeSet.add(scope);
                }
            }

            if (options.tenantId) {
                scopeSet.add(`VSCODE_TENANT:${options.tenantId}`);
            }
        }

        const session = await vscode.authentication.getSession(
            'microsoft',
            Array.from(scopeSet),
            {
                clearSessionPreference: options?.createNew,
                createIfNone: options?.createNew
            });

        if (!session) {
            throw new Error('Unable to obtain Azure authentication session.');
        }

        return session;
    }

    private async updateSelectedSubscriptions(subscriptionsIds: string[] | undefined): Promise<void> {
        return await vscode.workspace.getConfiguration('azure').update('selectedSubscriptions', subscriptionsIds);
    }

    private async getSubscriptionsFromTenant(tenantId?: string): Promise<{ client: arm.SubscriptionClient, subscriptions: AzureSubscription[] }> {
        let session: vscode.AuthenticationSession | undefined;

        const client: arm.SubscriptionClient = new arm.SubscriptionClient(
            {
                getToken: async scopes => {
                    session = await this.getSession({ scopes, tenantId });

                    if (session) {
                        return {
                            token: session.accessToken,
                            expiresOnTimestamp: 0
                        };
                    }

                    return null;
                },
            });

        const subscriptions: arm.Subscription[] = [];

        for await (const subscription of client.subscriptions.list()) {
            subscriptions.push(subscription);
        }

        return {
            client,
            subscriptions: subscriptions.map(s => ({ displayName: s.displayName ?? 'name', id: s.subscriptionId ?? 'id', getSession: () => session }))
        };
    }
}
