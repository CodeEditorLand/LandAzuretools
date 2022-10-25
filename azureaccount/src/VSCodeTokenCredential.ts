/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccessToken, TokenCredential } from '@azure/core-auth';
import type { Environment } from '@azure/ms-rest-azure-env';
import { Buffer } from 'buffer';
import * as vscode from 'vscode';

export const msAuthProviderId: string = 'microsoft';

const msAuthProviderTenantScopeId: string = 'VSCODE_TENANT';
const defaultScope: string = 'https://management.azure.com/.default';

/**
 * A credential that implements {@link TokenCredential} and acquires its token through
 * the VSCode authentication provider API.
 */
export class VSCodeTokenCredential implements TokenCredential {
    // TODO: environment is not supported by VSCode's auth provider: https://github.com/microsoft/vscode/issues/162539
    public constructor(private readonly environment: Environment, private readonly tenantId?: string) { }

    public async getToken(scopes: string | string[]): Promise<AccessToken> {
        let scopesArray: string[];
        if (typeof scopes === 'string') {
            scopesArray = [scopes];
        } else if (Array.isArray(scopes)) {
            scopesArray = scopes;
        } else {
            scopesArray = [];
        }

        const scopeSet = new Set<string>(scopesArray);

        // Add the default scope
        scopeSet.add(defaultScope);

        // Add the tenant scope if needed
        if (this.tenantId) {
            scopeSet.add(`${msAuthProviderTenantScopeId}:${this.tenantId}`);
        }

        const session = await vscode.authentication.getSession(msAuthProviderId, Array.from(scopeSet), { createIfNone: true });
        return {
            token: session.accessToken,
            expiresOnTimestamp: this.getExpirationTimestamp(session.accessToken),
        };
    }

    private getExpirationTimestamp(token: string): number {
        try {
            // The token is a JWT. The string is three base64 strings separated by '.'. The second string is the actual token.
            // 1. Get the second string
            const tokenBody = token.split('.')[1];

            // 2. Decode from base64
            const decodedToken = Buffer.from(tokenBody, 'base64').toString('utf8');

            // 3. Parse the JSON
            const parsedToken = JSON.parse(decodedToken) as { exp: number };

            // 4. Return the expiration timestamp * 1000 (to convert to milliseconds)
            return parsedToken.exp * 1000;
        } catch {
            throw new Error('Unable to parse token expiration');
        }
    }
}
