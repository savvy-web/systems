/**
 * The CSH changeset lint rules, defined once as `@effected/markdown-lint`
 * rules and run by both hosts: {@link ChangesetLinter} (through
 * `ChangesetLint.lint`) and markdownlint (through `MarkdownlintAdapter`).
 *
 * @internal
 */

import type { LintRule } from "@effected/markdown-lint";
import { ContentStructureRule } from "./content-structure.js";
import { DependencyTableFormatRule } from "./dependency-table-format.js";
import { HeadingHierarchyRule } from "./heading-hierarchy.js";
import { RequiredSectionsRule } from "./required-sections.js";
import { UncategorizedContentRule } from "./uncategorized-content.js";

export {
	ContentStructureRule,
	DependencyTableFormatRule,
	HeadingHierarchyRule,
	RequiredSectionsRule,
	UncategorizedContentRule,
};

/**
 * The five CSH rules, in reporting order.
 *
 * @internal
 */
export const CHANGESET_RULES: ReadonlyArray<LintRule> = [
	HeadingHierarchyRule,
	RequiredSectionsRule,
	ContentStructureRule,
	DependencyTableFormatRule,
	UncategorizedContentRule,
];
