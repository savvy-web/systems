/**
 * Remark-lint rule: changeset-required-sections (CSH002)
 *
 * Validates that all h2 headings in changeset files match a known category
 * heading from the category system.
 *
 * @remarks
 * The Silk Suite defines 13 section categories (Breaking Changes, Features,
 * Bug Fixes, Performance, Documentation, Refactoring, Tests, Build System, CI,
 * Dependencies, Maintenance, Reverts, Other). This rule checks every h2 heading
 * in the document against that list using case-insensitive comparison.
 *
 * Unrecognized headings are reported with the full list of valid options so
 * that authors can quickly correct typos or choose the right category.
 *
 * The rule ID registered with unified-lint-rule is
 * `"remark-lint:changeset-required-sections"`.
 *
 * @example
 * ```typescript
 * import { RequiredSectionsRule } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified().use(remarkParse).use(RequiredSectionsRule);
 *
 * // Valid: recognized heading
 * const valid = processor.processSync(new VFile("## Features\n\n- Added X\n"));
 * console.log(valid.messages.length); // 0
 *
 * // Invalid: unrecognized heading
 * const invalid = processor.processSync(new VFile("## Misc\n\n- Changed Y\n"));
 * console.log(invalid.messages[0].reason); // 'Unknown section "Misc"...'
 * ```
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH002.md | CSH002 rule documentation}
 * @see {@link HeadingHierarchyRule} for validating heading depth structure
 * @see {@link UncategorizedContentRule} for detecting content outside of sections
 *
 * @public
 */

import type { Heading, Root } from "mdast";
import { toString as nodeToString } from "mdast-util-to-string";
import { lintRule } from "unified-lint-rule";
import { visit } from "unist-util-visit";
import { allHeadings, isValidHeading } from "../../categories/index.js";
import { RULE_DOCS } from "../../constants.js";

export const RequiredSectionsRule = lintRule("remark-lint:changeset-required-sections", (tree: Root, file) => {
	visit(tree, "heading", (node: Heading) => {
		if (node.depth !== 2) {
			return;
		}

		const text = nodeToString(node);

		if (!isValidHeading(text)) {
			file.message(
				`Unknown section "${text}". Valid h2 headings are: ${allHeadings().join(", ")}. Heading comparison is case-insensitive. See: ${RULE_DOCS.CSH002}`,
				node,
			);
		}
	});
});
