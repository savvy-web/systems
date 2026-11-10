/**
 * Lint rule: changeset-required-sections (CSH002).
 *
 * @remarks
 * Every h2 must match a known category heading (case-insensitive).
 *
 * @internal
 */

import { MarkdownVisitor, Mdast } from "@effected/markdown";
import { LintRule } from "@effected/markdown-lint";
import { allHeadings, isValidHeading } from "../categories/index.js";
import { RULE_DOCS } from "../constants.js";
import { TAGS, reportAt } from "./shared.js";

/**
 * `changeset-required-sections` (CSH002): every h2 heading names a known category.
 *
 * @public
 */
export const RequiredSectionsRule: LintRule = LintRule.make({
	names: ["changeset-required-sections", "CSH002"],
	description: "Section headings must match known changeset categories",
	tags: TAGS,
	information: RULE_DOCS.CSH002,
	check: (context, report) => {
		for (const event of MarkdownVisitor.walk(context.root)) {
			if (event._tag !== "Enter" || event.node.type !== "heading") continue;
			const node = event.node;
			if (node.depth !== 2) continue;

			const text = Mdast.toText(node);
			if (!isValidHeading(text)) {
				reportAt(
					context,
					report,
					node,
					`Unknown section "${text}". Valid h2 headings are: ${allHeadings().join(", ")}. Heading comparison is case-insensitive. See: ${RULE_DOCS.CSH002}`,
				);
			}
		}
	},
});
