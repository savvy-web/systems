/**
 * Lint rule: changeset-content-structure (CSH003).
 *
 * @remarks
 * Flags empty h2 sections, code fences without a language, and empty list
 * items. Findings are reported in three passes (headings, code, list items).
 *
 * @internal
 */

import type { MarkdownNode } from "@effected/markdown";
import { MarkdownVisitor, Mdast } from "@effected/markdown";
import { LintRule } from "@effected/markdown-lint";
import { RULE_DOCS } from "../constants.js";
import { TAGS, bodyChildren, reportAt } from "./shared.js";

/**
 * `changeset-content-structure` (CSH003): sections have content, code fences
 * name a language, and list items have text.
 *
 * @public
 */
export const ContentStructureRule: LintRule = LintRule.make({
	names: ["changeset-content-structure", "CSH003"],
	description: "Sections must have content, code blocks need languages, list items need text",
	tags: TAGS,
	information: RULE_DOCS.CSH003,
	check: (context, report) => {
		// Empty sections: an h2 at the top level followed by nothing or another h2.
		const children = bodyChildren(context.root);
		children.forEach((node, index) => {
			if (node.type !== "heading" || node.depth !== 2) return;
			const next = children[index + 1];
			if (!next || (next.type === "heading" && next.depth === 2)) {
				reportAt(
					context,
					report,
					node,
					`Empty section: heading has no content before the next section or end of file. Add a list of changes (e.g., "- Added feature X") under this heading, or remove the empty heading. See: ${RULE_DOCS.CSH003}`,
				);
			}
		});

		const codes: MarkdownNode[] = [];
		const items: MarkdownNode[] = [];
		for (const event of MarkdownVisitor.walk(context.root)) {
			if (event._tag !== "Enter") continue;
			const node = event.node;
			if (node.type === "code" && !node.lang) codes.push(node);
			else if (node.type === "listItem" && !Mdast.toText(node).trim()) items.push(node);
		}
		for (const node of codes) {
			reportAt(
				context,
				report,
				node,
				`Code block is missing a language identifier. Add a language after the opening fence (e.g., \`\`\`ts, \`\`\`json, \`\`\`bash). See: ${RULE_DOCS.CSH003}`,
			);
		}
		for (const node of items) {
			reportAt(
				context,
				report,
				node,
				`Empty list item. Each list item must contain descriptive text (e.g., "- Fixed login timeout issue"). See: ${RULE_DOCS.CSH003}`,
			);
		}
	},
});
