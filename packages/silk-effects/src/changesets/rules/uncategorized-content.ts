/**
 * Lint rule: changeset-uncategorized-content (CSH004).
 *
 * @remarks
 * Kit rule. Flags substantive content before
 * the first h2; html nodes (comments) are ignored.
 *
 * @internal
 */

import { RULE_DOCS } from "../constants.js";
import type { LintRule, RuleFinding } from "./types.js";
import { finding } from "./types.js";

const RULE = "changeset-uncategorized-content";

/**
 * Detect content that appears before the first h2 heading.
 *
 * @internal
 */
export const uncategorizedContent: LintRule = (root) => {
	const findings: RuleFinding[] = [];

	for (const node of root.children) {
		if (node.type === "heading" && node.depth === 2) break;
		if (node.type === "heading" || node.type === "html") continue;
		findings.push(
			finding(
				RULE,
				`Content must be placed under a category heading (## heading). Move this content under an appropriate section like "## Features" or "## Bug Fixes". If it doesn't fit an existing category, use "## Other". See: ${RULE_DOCS.CSH004}`,
				node,
			),
		);
	}

	return findings;
};
