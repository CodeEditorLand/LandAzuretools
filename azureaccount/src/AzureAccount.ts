/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TenantIdDescription, Subscription, SubscriptionClient } from '@azure/arm-subscriptions';
import type { TokenCredential } from '@azure/core-auth';
import { Environment } from '@azure/ms-rest-azure-env';
import * as vscode from 'vscode';
import { msAuthProviderId, VSCodeTokenCredential } from './VSCodeTokenCredential';

/**
 * An Azure session for a specific tenant in a specific Azure {@link Environment}
 */
export interface AzureSession {
    /**
     * The Azure {@link Environment} that the tenant is in
     */
    environment: Environment;

    /**
     * The {@link TenantIdDescription} for this session
     */
    tenant: TenantIdDescription;

    /**
     * A {@link TokenCredential} that can be used for authentication
     */
    credential: TokenCredential;

    /**
     * A list of all the {@link Subscription}s accessible from this session
     */
    subscriptions: Subscription[];
}

/**
 * Gets all the {@link AzureSession}s accessible to a user within a specific Azure {@link Environment}. The user will be
 * prompted to sign in if they are not already signed in.
 * @param environment (Optional) The Azure {@link Environment} to get sessions for. If not specified, the default
 * Azure public cloud is used.
 * @returns A list of all {@link AzureSession}s accessible within the Azure {@link Environment}
 */
export async function getAzureSessions(environment: Environment = Environment.AzureCloud): Promise<AzureSession[]> {
    const allSessions: AzureSession[] = [];

    for (const tenantSession of await getTenantSessions(environment)) {
        allSessions.push(
            {
                ...tenantSession,
                subscriptions: await getSubscriptionsForTenantSession(environment, tenantSession),
            }
        );
    }

    return allSessions;
}

/**
 * An event that is fired when changes may have occurred to the user's Azure sessions
 * @param listener A listener that will be called whenever the user's Azure sessions may have changed.
 * The consumer should call {@link getAzureSessions} again to get the latest sessions.
 * @returns An event registration that can be disposed to stop listening for changes
 */
export const onDidChangeAzureSessions: vscode.Event<void> = (listener: () => void) => {
    return vscode.authentication.onDidChangeSessions((sessionChangeEvent: vscode.AuthenticationSessionsChangeEvent) => {
        // Only forward the session change event if it's for the Microsoft auth provider
        if (sessionChangeEvent.provider.id === msAuthProviderId) {
            listener();
        }
    });
};

type TenantSession = Omit<AzureSession, 'subscriptions'>;

async function getTenantSessions(environment: Environment): Promise<TenantSession[]> {
    const defaultTenantCredential = new VSCodeTokenCredential(environment);
    const subscriptionClient = new SubscriptionClient(defaultTenantCredential, { endpoint: environment.resourceManagerEndpointUrl });

    const environmentTenants: TenantIdDescription[] = [];
    for await (const tenant of subscriptionClient.tenants.list()) {
        environmentTenants.push(tenant);
    }

    return environmentTenants.map(tenant => (
        {
            environment: environment,
            tenant: tenant,
            credential: new VSCodeTokenCredential(environment, tenant.tenantId),
        }
    ));
}

async function getSubscriptionsForTenantSession(environment: Environment, tenant: TenantSession): Promise<Subscription[]> {
    const subscriptionClient = new SubscriptionClient(tenant.credential, { endpoint: environment.resourceManagerEndpointUrl });

    const tenantSubscriptions: Subscription[] = [];
    for await (const subscription of subscriptionClient.subscriptions.list()) {
        tenantSubscriptions.push(subscription);
    }

    return tenantSubscriptions;
}
