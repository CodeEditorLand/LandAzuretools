/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtResourceType } from "@microsoft/vscode-azureresources-api";
import * as vscode from "vscode";

import * as types from "../../../index";
import { AzureResourceQuickPickWizardContext } from "../../../index";
import { AzureWizardPromptStep } from "../../wizard/AzureWizardPromptStep";
import { CompatibilityRecursiveQuickPickStep } from "../contextValue/compatibility/CompatibilityRecursiveQuickPickStep";
import { RecursiveQuickPickStep } from "../contextValue/RecursiveQuickPickStep";
import { QuickPickAzureResourceStep } from "../quickPickAzureResource/QuickPickAzureResourceStep";
import { QuickPickAzureSubscriptionStep } from "../quickPickAzureResource/QuickPickAzureSubscriptionStep";
import { QuickPickGroupStep } from "../quickPickAzureResource/QuickPickGroupStep";
import { ResourceGroupsItem } from "../quickPickAzureResource/tempTypes";
import { runQuickPickWizard } from "../runQuickPickWizard";

export interface InternalAzureResourceExperienceOptions
	extends types.PickExperienceContext {
	v1Compatibility?: boolean;
}

export async function azureResourceExperience<TPick>(
	context: InternalAzureResourceExperienceOptions,
	tdp: vscode.TreeDataProvider<ResourceGroupsItem>,
	resourceTypes?: AzExtResourceType | AzExtResourceType[],
	childItemFilter?: types.ContextValueFilter,
): Promise<TPick> {
	const promptSteps: AzureWizardPromptStep<AzureResourceQuickPickWizardContext>[] =
		[
			new QuickPickAzureSubscriptionStep(tdp),
			new QuickPickGroupStep(tdp, {
				groupType: resourceTypes
					? Array.isArray(resourceTypes)
						? resourceTypes
						: [resourceTypes]
					: undefined,
			}),
			new QuickPickAzureResourceStep(tdp, {
				resourceTypes: resourceTypes
					? Array.isArray(resourceTypes)
						? resourceTypes
						: [resourceTypes]
					: undefined,
				skipIfOne: false,
			}),
		];

	if (childItemFilter) {
		promptSteps.push(
			context.v1Compatibility
				? new CompatibilityRecursiveQuickPickStep(tdp, {
						contextValueFilter: childItemFilter,
						skipIfOne: true,
					})
				: new RecursiveQuickPickStep<AzureResourceQuickPickWizardContext>(
						tdp,
						{
							contextValueFilter: childItemFilter,
							skipIfOne: false,
						},
					),
		);
	}

	return await runQuickPickWizard(context, {
		hideStepCount: true,
		promptSteps: promptSteps,
		showLoadingPrompt: true,
	});
}
