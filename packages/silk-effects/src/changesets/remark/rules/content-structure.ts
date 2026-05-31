/**
 * Remark-lint rule: changeset-content-structure (CSH003)
 *
 * Validates content quality in changeset files.
 *
 * @remarks
 * This rule checks three aspects of content structure:
 *
 * - **Empty sections** -- An h2 heading followed immediately by another h2 or
 *   the end of the file has no content. Every section must contain at least one
 *   list item describing a change.
 * - **Code fence language** -- Fenced code blocks must specify a language
 *   identifier (e.g., `ts`, `json`, `bash`). This ensures syntax highlighting
 *   in rendered changelogs.
 * - **Empty list items** -- List items must contain meaningful descriptive text.
 *   A bare `-` with no content is flagged.
 *
 * The rule ID registered with unified-lint-rule is
 * `"remark-lint:changeset-content-structure"`.
 *
 * @example
 * ```typescript
 * import { ContentStructureRule } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified().use(remarkParse).use(ContentStructureRule);
 *
 * // Valid: section with content
 * const valid = processor.processSync(
 *   new VFile("## Features\n\n- Added dark mode support\n"),
 * );
 * console.log(valid.messages.length); // 0
 *
 * // Invalid: empty section
 * const invalid = processor.processSync(
 *   new VFile("## Features\n\n## Bug Fixes\n\n- Fixed crash\n"),
 * );
 * console.log(invalid.messages[0].reason); // "Empty section..."
 * ```
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH003.md | CSH003 rule documentation}
 * @see {@link HeadingHierarchyRule} for validating heading depth structure
 * @see {@link RequiredSectionsRule} for validating recognized section headings
 *
 * @public
 */

import type { Code, Heading, ListItem, Root } from "mdast";
import { toString as nodeToString } from "mdast-util-to-string";
import { lintRule } from "unified-lint-rule";
import { visit } from "unist-util-visit";
import { RULE_DOCS } from "../../constants.js";

export const ContentStructureRule = lintRule("remark-lint:changeset-content-structure", (tree: Root, file) => {
	// Check for empty sections (h2 followed by h2 or end of file)
	visit(tree, "heading", (node: Heading, index, parent) => {
		if (node.depth !== 2 || parent == null || index == null) {
			return;
		}

		const next = parent.children[index + 1];
		if (!next || (next.type === "heading" && (next as Heading).depth === 2)) {
			file.message(
				`Empty section: heading has no content before the next section or end of file. Add a list of changes (e.g., "- Added feature X") under this heading, or remove the empty heading. See: ${RULE_DOCS.CSH003}`,
				node,
			);
		}
	});

	// Check code blocks for language identifier
	visit(tree, "code", (node: Code) => {
		if (!node.lang) {
			file.message(
				`Code block is missing a language identifier. Add a language after the opening fence (e.g., \`\`\`ts, \`\`\`json, \`\`\`bash). See: ${RULE_DOCS.CSH003}`,
				node,
			);
		}
	});

	// Check list items for content
	visit(tree, "listItem", (node: ListItem) => {
		const text = nodeToString(node).trim();
		if (!text) {
			file.message(
				`Empty list item. Each list item must contain descriptive text (e.g., "- Fixed login timeout issue"). See: ${RULE_DOCS.CSH003}`,
				node,
			);
		}
	});
});
