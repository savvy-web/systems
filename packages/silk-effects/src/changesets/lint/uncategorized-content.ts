/**
 * Lint rule: changeset-uncategorized-content (CSH004).
 *
 * @remarks
 * Flags substantive content before the first h2; html nodes (comments) and
 * the front matter block are ignored.
 *
 * @internal
 */

import { LintRule } from "@effected/markdown-lint";
import { RULE_DOCS } from "../constants.js";
import { TAGS, bodyChildren, reportAt } from "./shared.js";

/**
 * `changeset-uncategorized-content` (CSH004): no content before the first h2 heading.
 *
 * @public
 */
export const UncategorizedContentRule: LintRule = LintRule.make({
	names: ["changeset-uncategorized-content", "CSH004"],
	description: "All content must be placed under a category heading (## heading)",
	tags: TAGS,
	information: RULE_DOCS.CSH004,
	check: (context, report) => {
		for (const node of bodyChildren(context.root)) {
			if (node.type === "heading" && node.depth === 2) break;
			if (node.type === "heading" || node.type === "html") continue;
			reportAt(
				context,
				report,
				node,
				`Content must be placed under a category heading (## heading). Move this content under an appropriate section like "## Features" or "## Bug Fixes". If it doesn't fit an existing category, use "## Other". See: ${RULE_DOCS.CSH004}`,
			);
		}
	},
});
