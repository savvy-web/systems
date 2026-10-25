/**
 * Lint rule: changeset-content-structure (CSH003).
 *
 * @remarks
 * Kit rule. Flags empty h2 sections, code fences
 * without a language, and empty list items. Findings are emitted in three
 * passes (headings, code, list items) to match the markdownlint rule's order.
 *
 * @internal
 */

import { MarkdownVisitor, Mdast } from "@effected/markdown";
import { RULE_DOCS } from "../constants.js";
import type { LintRule, RuleFinding } from "./types.js";
import { finding } from "./types.js";

const RULE = "changeset-content-structure";

/**
 * Validate section and block content quality.
 *
 * @internal
 */
export const contentStructure: LintRule = (root) => {
	const findings: RuleFinding[] = [];

	// Empty sections: an h2 that is a direct root child followed by nothing or another h2.
	root.children.forEach((node, index) => {
		if (node.type !== "heading" || node.depth !== 2) return;
		const next = root.children[index + 1];
		if (!next || (next.type === "heading" && next.depth === 2)) {
			findings.push(
				finding(
					RULE,
					`Empty section: heading has no content before the next section or end of file. Add a list of changes (e.g., "- Added feature X") under this heading, or remove the empty heading. See: ${RULE_DOCS.CSH003}`,
					node,
				),
			);
		}
	});

	const codes: RuleFinding[] = [];
	const items: RuleFinding[] = [];
	for (const event of MarkdownVisitor.walk(root)) {
		if (event._tag !== "Enter") continue;
		const node = event.node;
		if (node.type === "code" && !node.lang) {
			codes.push(
				finding(
					RULE,
					`Code block is missing a language identifier. Add a language after the opening fence (e.g., \`\`\`ts, \`\`\`json, \`\`\`bash). See: ${RULE_DOCS.CSH003}`,
					node,
				),
			);
		} else if (node.type === "listItem" && !Mdast.toText(node).trim()) {
			items.push(
				finding(
					RULE,
					`Empty list item. Each list item must contain descriptive text (e.g., "- Fixed login timeout issue"). See: ${RULE_DOCS.CSH003}`,
					node,
				),
			);
		}
	}

	return [...findings, ...codes, ...items];
};
