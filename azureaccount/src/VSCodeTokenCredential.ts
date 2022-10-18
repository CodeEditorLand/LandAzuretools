/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';
import { defaultScope, msAuthProviderId } from './constants';

export class VSCodeTokenCredential implements TokenCredential {
    public async getToken(scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken | null> {
        let scopesArray: string[];
        if (typeof scopes === 'string') {
            scopesArray = [scopes];
        } else if (Array.isArray(scopes)) {
            scopesArray = scopes;
        } else {
            scopesArray = [];
        }

        // TODO: how should the default scope be added?
        if (scopesArray.length === 0) {
            scopesArray = [defaultScope];
        }

        const session = await vscode.authentication.getSession(msAuthProviderId, scopesArray, { createIfNone: true });
        return {
            token: session.accessToken,
            expiresOnTimestamp: getExpirationTimestamp(session.accessToken),
        };
    }
}

function getExpirationTimestamp(token: string): number {
    const decoded = decode(token);
    return decoded.exp * 1000;
}
