/**
 * \@savvy-web/changesets/markdownlint
 *
 * markdownlint custom rules for validating changeset file structure.
 *
 * Provides the same validation as the remark-lint rules but using
 * markdownlint's micromark token API for integration with
 * markdownlint-cli2 and the VS Code markdownlint extension.
 *
 * Rules included:
 * - {@link HeadingHierarchyRule | changeset-heading-hierarchy} (CSH001): Enforce h2 start, no h1, no depth skips
 * - {@link RequiredSectionsRule | changeset-required-sections} (CSH002): Validate section headings match known categories
 * - {@link ContentStructureRule | changeset-content-structure} (CSH003): Content quality validation
 * - {@link UncategorizedContentRule | changeset-uncategorized-content} (CSH004): Reject content before first h2 heading
 * - {@link DependencyTableFormatRule | changeset-dependency-table-format} (CSH005): Validate dependency table structure
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH001.md | CSH001 docs}
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH002.md | CSH002 docs}
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH003.md | CSH003 docs}
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH004.md | CSH004 docs}
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH005.md | CSH005 docs}
 *
 * @packageDocumentation
 */

import type { Rule } from "markdownlint";

import { ContentStructureRule } from "./rules/content-structure.js";
import { DependencyTableFormatRule } from "./rules/dependency-table-format.js";
import { HeadingHierarchyRule } from "./rules/heading-hierarchy.js";
import { RequiredSectionsRule } from "./rules/required-sections.js";
import { UncategorizedContentRule } from "./rules/uncategorized-content.js";

export {
	/** {@inheritDoc ContentStructureRule} @public */
	ContentStructureRule,
	/** {@inheritDoc DependencyTableFormatRule} @public */
	DependencyTableFormatRule,
	/** {@inheritDoc HeadingHierarchyRule} @public */
	HeadingHierarchyRule,
	/** {@inheritDoc RequiredSectionsRule} @public */
	RequiredSectionsRule,
	/** {@inheritDoc UncategorizedContentRule} @public */
	UncategorizedContentRule,
};

/**
 * All changeset rules as an array for markdownlint-cli2 `customRules` config.
 *
 * @example
 * ```json
 * {
 *   "customRules": ["@savvy-web/changesets/markdownlint"]
 * }
 * ```
 *
 * @public
 */
const SilkChangesetsRules: Rule[] = [
	HeadingHierarchyRule,
	RequiredSectionsRule,
	ContentStructureRule,
	UncategorizedContentRule,
	DependencyTableFormatRule,
];

export default SilkChangesetsRules;
