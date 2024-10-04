/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from "../../../index";
import { getLastNode } from "../getLastNode";
import { ContextValueQuickPickStep } from "./ContextValueQuickPickStep";

export class RecursiveQuickPickStep<
	TContext extends types.QuickPickWizardContext,
> extends ContextValueQuickPickStep<
	TContext,
	types.ContextValueFilterQuickPickOptions
> {
	hideStepCount: boolean = true;

	public async getSubWizard(
		wizardContext: TContext,
	): Promise<types.IWizardOptions<TContext> | undefined> {
		const lastPickedItem = getLastNode(wizardContext);

		if (!lastPickedItem) {
			// Something went wrong, no node was chosen
			throw new Error("No node was set after prompt step.");
		}

		if (
			this.pickFilter.isFinalPick(
				await this.treeDataProvider.getTreeItem(lastPickedItem),
				lastPickedItem,
			)
		) {
			// The last picked node matches the expected filter
			// No need to continue prompting
			return undefined;
		} else {
			// Need to keep going because the last picked node is not a match
			return {
				promptSteps: [
					new RecursiveQuickPickStep(
						this.treeDataProvider,
						this.pickOptions,
					),
				],
			};
		}
	}
}
