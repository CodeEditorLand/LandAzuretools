/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient, TenantIdDescription as TenantId } from '@azure/arm-subscriptions';
import { VSCodeTokenCredential } from './VSCodeTokenCredential';

export interface AzureAccount {
    readonly tenantId: string;
}

export async function getAzureAccount(): Promise<AzureAccount> {
    const subscriptionClient = new SubscriptionClient(new VSCodeTokenCredential());
    const tenants: TenantId[] = [];

    for await (const tenantId of subscriptionClient.tenants.list()) {
        tenants.push(tenantId);
    }

    return {
        tenantId: tenants[0].tenantId as string,
    };
}
