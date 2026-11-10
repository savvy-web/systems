/**
 * \@savvy-web/silk/changesets/markdownlint
 *
 * markdownlint custom rules for validating changeset file structure.
 *
 * Each rule is the same `\@effected/markdown-lint` definition
 * {@link ChangesetLinter} runs, exported to markdownlint through
 * `MarkdownlintAdapter`, so markdownlint-cli2 and the VS Code markdownlint
 * extension report the same findings, on the same lines, as
 * `savvy changeset lint` and the `changeset_validate` MCP tool.
 *
 * Rules included:
 * - {@link HeadingHierarchyRule | changeset-heading-hierarchy} (CSH001): Enforce h2 start, no h1, no depth skips
 * - {@link RequiredSectionsRule | changeset-required-sections} (CSH002): Validate section headings match known categories
 * - {@link ContentStructureRule | changeset-content-structure} (CSH003): Content quality validation
 * - {@link UncategorizedContentRule | changeset-uncategorized-content} (CSH004): Reject content before first h2 heading
 * - {@link DependencyTableFormatRule | changeset-dependency-table-format} (CSH005): Validate dependency table structure
 *
 * @see {@link https://github.com/savvy-web/systems/blob/main/packages/silk-effects/docs/rules/CSH001.md | CSH001 docs}
 * @see {@link https://github.com/savvy-web/systems/blob/main/packages/silk-effects/docs/rules/CSH002.md | CSH002 docs}
 * @see {@link https://github.com/savvy-web/systems/blob/main/packages/silk-effects/docs/rules/CSH003.md | CSH003 docs}
 * @see {@link https://github.com/savvy-web/systems/blob/main/packages/silk-effects/docs/rules/CSH004.md | CSH004 docs}
 * @see {@link https://github.com/savvy-web/systems/blob/main/packages/silk-effects/docs/rules/CSH005.md | CSH005 docs}
 *
 */

import type { MarkdownlintRule } from "@effected/markdown-lint";
import { MarkdownlintAdapter } from "@effected/markdown-lint";
import * as Rules from "../lint/index.js";

/**
 * markdownlint rule `changeset-heading-hierarchy` (CSH001).
 *
 * @public
 */
export const HeadingHierarchyRule: MarkdownlintRule = MarkdownlintAdapter.rule(Rules.HeadingHierarchyRule);

/**
 * markdownlint rule `changeset-required-sections` (CSH002).
 *
 * @public
 */
export const RequiredSectionsRule: MarkdownlintRule = MarkdownlintAdapter.rule(Rules.RequiredSectionsRule);

/**
 * markdownlint rule `changeset-content-structure` (CSH003).
 *
 * @public
 */
export const ContentStructureRule: MarkdownlintRule = MarkdownlintAdapter.rule(Rules.ContentStructureRule);

/**
 * markdownlint rule `changeset-uncategorized-content` (CSH004).
 *
 * @public
 */
export const UncategorizedContentRule: MarkdownlintRule = MarkdownlintAdapter.rule(Rules.UncategorizedContentRule);

/**
 * markdownlint rule `changeset-dependency-table-format` (CSH005).
 *
 * @public
 */
export const DependencyTableFormatRule: MarkdownlintRule = MarkdownlintAdapter.rule(Rules.DependencyTableFormatRule);

/**
 * All changeset rules as an array for markdownlint-cli2 `customRules` config.
 *
 * @example
 * ```json
 * {
 *   "customRules": ["@savvy-web/silk/changesets/markdownlint"]
 * }
 * ```
 *
 * @public
 */
const SilkChangesetsRules: MarkdownlintRule[] = [
	HeadingHierarchyRule,
	RequiredSectionsRule,
	ContentStructureRule,
	UncategorizedContentRule,
	DependencyTableFormatRule,
];

export default SilkChangesetsRules;
