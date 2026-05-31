/**
 * Remark-lint rule: changeset-uncategorized-content (CSH004)
 *
 * Detects content that appears before the first h2 heading in a changeset file.
 *
 * @remarks
 * All content in a changeset must be placed under a categorized section
 * (an h2 heading like `## Features` or `## Bug Fixes`). Content before the
 * first h2 heading is uncategorized and cannot be assigned to a changelog
 * section during formatting.
 *
 * HTML comment nodes (e.g., changeset front-matter comments) are ignored and
 * do not trigger a warning.
 *
 * The rule iterates children of the root node from the top and stops at the
 * first h2 heading. Any content node encountered before that point is flagged.
 *
 * The rule ID registered with unified-lint-rule is
 * `"remark-lint:changeset-uncategorized-content"`.
 *
 * @example
 * ```typescript
 * import { UncategorizedContentRule } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified().use(remarkParse).use(UncategorizedContentRule);
 *
 * // Valid: all content is under a heading
 * const valid = processor.processSync(
 *   new VFile("## Features\n\n- Added search\n"),
 * );
 * console.log(valid.messages.length); // 0
 *
 * // Invalid: paragraph before the first heading
 * const invalid = processor.processSync(
 *   new VFile("Some orphan text\n\n## Features\n\n- Added search\n"),
 * );
 * console.log(invalid.messages[0].reason); // "Content must be placed under a category heading..."
 * ```
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH004.md | CSH004 rule documentation}
 * @see {@link RequiredSectionsRule} for validating that h2 headings match known categories
 * @see {@link ContentStructureRule} for validating section content quality
 *
 * @public
 */

import type { Root, RootContent } from "mdast";
import { lintRule } from "unified-lint-rule";
import { RULE_DOCS } from "../../constants.js";

/**
 * Node types to ignore when detecting uncategorized content (e.g., HTML comments).
 *
 * @internal
 */
const IGNORED_TYPES = new Set(["html"]);

/**
 * Determine whether a node is substantive content (not a heading or ignored type).
 *
 * @param node - The AST node to check
 * @returns `true` if the node is content that should be under a heading
 *
 * @internal
 */
function isContentNode(node: RootContent): boolean {
	if (node.type === "heading") {
		return false;
	}
	return !IGNORED_TYPES.has(node.type);
}

export const UncategorizedContentRule = lintRule("remark-lint:changeset-uncategorized-content", (tree: Root, file) => {
	for (const node of tree.children) {
		// Stop at the first h2 — everything after is categorized
		if (node.type === "heading" && node.depth === 2) {
			break;
		}

		if (isContentNode(node)) {
			file.message(
				`Content must be placed under a category heading (## heading). Move this content under an appropriate section like "## Features" or "## Bug Fixes". If it doesn't fit an existing category, use "## Other". See: ${RULE_DOCS.CSH004}`,
				node,
			);
		}
	}
});
