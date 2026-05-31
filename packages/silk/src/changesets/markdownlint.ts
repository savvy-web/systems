/**
 * markdownlint custom rules shim for \@savvy-web/silk.
 *
 * Drop-in replacement for \@savvy-web/changesets/markdownlint.
 * Exports the same named rule objects and default rules array as the
 * original module so markdownlint-cli2 configs are unchanged.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";

export const ContentStructureRule: typeof Changesets.MarkdownlintContentStructureRule =
	Changesets.MarkdownlintContentStructureRule;
export const DependencyTableFormatRule: typeof Changesets.MarkdownlintDependencyTableFormatRule =
	Changesets.MarkdownlintDependencyTableFormatRule;
export const HeadingHierarchyRule: typeof Changesets.MarkdownlintHeadingHierarchyRule =
	Changesets.MarkdownlintHeadingHierarchyRule;
export const RequiredSectionsRule: typeof Changesets.MarkdownlintRequiredSectionsRule =
	Changesets.MarkdownlintRequiredSectionsRule;
export const UncategorizedContentRule: typeof Changesets.MarkdownlintUncategorizedContentRule =
	Changesets.MarkdownlintUncategorizedContentRule;

const SilkChangesetsRules: typeof Changesets.SilkChangesetsRules = Changesets.SilkChangesetsRules;
export default SilkChangesetsRules;
