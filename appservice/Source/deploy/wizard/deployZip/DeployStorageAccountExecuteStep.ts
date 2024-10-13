/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deployToStorageAccount } from "../../deployToStorageAccount";
import { InnerDeployContext } from "../../IDeployContext";
import { DeployZipBaseExecuteStep } from "./DeployZipBaseExecuteStep";

export class DeployStorageAccountExecuteStep extends DeployZipBaseExecuteStep {
	public async deployZip(context: InnerDeployContext): Promise<void> {
		return await deployToStorageAccount(
			context,
			context.fsPath,
			context.site,
		);
	}
}
