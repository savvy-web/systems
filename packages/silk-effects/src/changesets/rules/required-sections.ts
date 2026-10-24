/**
 * Lint rule: changeset-required-sections (CSH002).
 *
 * @remarks
 * Kit twin of `RequiredSectionsRule`. Every h2 must match a known category
 * heading (case-insensitive).
 *
 * @internal
 */

import { MarkdownVisitor, Mdast } from "@effected/markdown";
import { allHeadings, isValidHeading } from "../categories/index.js";
import { RULE_DOCS } from "../constants.js";
import type { LintRule, RuleFinding } from "./types.js";
import { finding } from "./types.js";

const RULE = "changeset-required-sections";

/**
 * Validate that h2 headings are known categories.
 *
 * @internal
 */
export const requiredSections: LintRule = (root) => {
	const findings: RuleFinding[] = [];

	for (const event of MarkdownVisitor.walk(root)) {
		if (event._tag !== "Enter" || event.node.type !== "heading") continue;
		const node = event.node;
		if (node.depth !== 2) continue;

		const text = Mdast.toText(node);
		if (!isValidHeading(text)) {
			findings.push(
				finding(
					RULE,
					`Unknown section "${text}". Valid h2 headings are: ${allHeadings().join(", ")}. Heading comparison is case-insensitive. See: ${RULE_DOCS.CSH002}`,
					node,
				),
			);
		}
	}

	return findings;
};
