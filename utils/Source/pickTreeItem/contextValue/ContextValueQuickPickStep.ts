/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem } from "vscode";

import * as types from "../../../index";
import { parseContextValue } from "../../utils/contextUtils";
import { GenericQuickPickStep } from "../GenericQuickPickStep";
import { PickFilter } from "../PickFilter";

export class ContextValueQuickPickStep<
	TContext extends types.QuickPickWizardContext,
	TOptions extends types.ContextValueFilterQuickPickOptions,
> extends GenericQuickPickStep<TContext, TOptions> {
	protected readonly pickFilter: PickFilter = new ContextValuePickFilter(
		this.pickOptions,
	);
}

export class ContextValuePickFilter implements PickFilter {
	constructor(
		protected readonly pickOptions: types.ContextValueFilterQuickPickOptions,
	) {}

	isFinalPick(node: TreeItem): boolean {
		const includeOption = this.pickOptions.contextValueFilter.include;

		const excludeOption = this.pickOptions.contextValueFilter.exclude;

		const includeArray: (string | RegExp)[] = Array.isArray(includeOption)
			? includeOption
			: [includeOption];

		const excludeArray: (string | RegExp)[] = excludeOption
			? Array.isArray(excludeOption)
				? excludeOption
				: [excludeOption]
			: [];

		const nodeContextValues: string[] = parseContextValue(
			node.contextValue,
		);

		return (
			includeArray.some((i) =>
				this.matchesSingleFilter(i, nodeContextValues),
			) &&
			!excludeArray.some((e) =>
				this.matchesSingleFilter(e, nodeContextValues),
			)
		);
	}

	isAncestorPick(treeItem: TreeItem, _element: unknown): boolean {
		// `TreeItemCollapsibleState.None` and `undefined` are both falsy, and indicate that a `TreeItem` cannot have children--and therefore, cannot be an ancestor pick
		return !!treeItem.collapsibleState;
	}

	private matchesSingleFilter(
		matcher: string | RegExp,
		nodeContextValues: string[],
	): boolean {
		return nodeContextValues.some((c) => {
			if (matcher instanceof RegExp) {
				return matcher.test(c);
			}

			// Context value matcher is a string, do full equality (same as old behavior)
			return c === matcher;
		});
	}
}
