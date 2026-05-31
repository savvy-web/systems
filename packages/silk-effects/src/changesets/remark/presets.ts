/**
 * Remark preset collections for changeset lint rules and transform plugins.
 *
 * @remarks
 * Presets bundle related remark plugins into ordered arrays for convenient
 * consumption. Each preset is a `readonly` tuple so that TypeScript can
 * narrow element types. Iterate and `.use()` each entry with `unified()`.
 *
 * @see {@link SilkChangesetPreset} for lint rules
 * @see {@link SilkChangesetTransformPreset} for transform plugins
 */

import { AggregateDependencyTablesPlugin } from "./plugins/aggregate-dependency-tables.js";
import { ContributorFootnotesPlugin } from "./plugins/contributor-footnotes.js";
import { DeduplicateItemsPlugin } from "./plugins/deduplicate-items.js";
import { IssueLinkRefsPlugin } from "./plugins/issue-link-refs.js";
import { MergeSectionsPlugin } from "./plugins/merge-sections.js";
import { NormalizeFormatPlugin } from "./plugins/normalize-format.js";
import { ReorderSectionsPlugin } from "./plugins/reorder-sections.js";
import { ContentStructureRule } from "./rules/content-structure.js";
import { DependencyTableFormatRule } from "./rules/dependency-table-format.js";
import { HeadingHierarchyRule } from "./rules/heading-hierarchy.js";
import { RequiredSectionsRule } from "./rules/required-sections.js";
import { UncategorizedContentRule } from "./rules/uncategorized-content.js";

/**
 * Preset combining all changeset lint rules for convenient consumption.
 *
 * @remarks
 * Includes the following rules in order:
 *
 * 1. {@link HeadingHierarchyRule} (CSH001) -- no h1, no depth skips
 * 2. {@link RequiredSectionsRule} (CSH002) -- h2 headings must match a known category
 * 3. {@link ContentStructureRule} (CSH003) -- non-empty sections, code fence languages, non-empty list items
 * 4. {@link UncategorizedContentRule} (CSH004) -- no content before the first h2 heading
 * 5. {@link DependencyTableFormatRule} (CSH005) -- dependency table column/value validation
 *
 * Rule execution order is not significant for lint rules; all rules run
 * independently over the same AST and report warnings to the virtual file.
 *
 * @example
 * ```typescript
 * import { SilkChangesetPreset } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import { unified } from "unified";
 * import { read } from "to-vfile";
 *
 * const processor = unified().use(remarkParse);
 * for (const rule of SilkChangesetPreset) {
 *   processor.use(rule);
 * }
 *
 * const file = await read("changeset.md");
 * const result = await processor.process(file);
 * console.log(result.messages); // lint warnings
 * ```
 *
 * @see {@link SilkChangesetTransformPreset} for the corresponding transform preset
 *
 * @public
 */
export const SilkChangesetPreset = [
	HeadingHierarchyRule,
	RequiredSectionsRule,
	ContentStructureRule,
	UncategorizedContentRule,
	DependencyTableFormatRule,
] as const;

/**
 * Ordered array of all transform plugins in the correct execution order.
 *
 * @remarks
 * Plugin ordering is significant -- each plugin may depend on the output of
 * earlier plugins in the pipeline:
 *
 * 1. {@link AggregateDependencyTablesPlugin} -- merge duplicate dependency sections (must run first so downstream plugins see a single Dependencies section)
 * 2. {@link MergeSectionsPlugin} -- merge duplicate h3 headings (must run before reorder so that priority is computed on consolidated sections)
 * 3. {@link ReorderSectionsPlugin} -- sort sections by category priority (Breaking Changes first, Other last)
 * 4. {@link DeduplicateItemsPlugin} -- remove duplicate list items within each section
 * 5. {@link ContributorFootnotesPlugin} -- extract inline `Thanks \@user!` attributions and aggregate them into a summary paragraph per version block
 * 6. {@link IssueLinkRefsPlugin} -- convert inline `[#N](url)` links to reference-style `[#N]` with definitions at the end of each version block
 * 7. {@link NormalizeFormatPlugin} -- final cleanup removing empty sections and empty lists
 *
 * @example
 * ```typescript
 * import { SilkChangesetTransformPreset } from "\@savvy-web/changesets/remark";
 * import remarkGfm from "remark-gfm";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { read } from "to-vfile";
 *
 * const processor = unified().use(remarkParse).use(remarkGfm);
 * for (const plugin of SilkChangesetTransformPreset) {
 *   processor.use(plugin);
 * }
 * processor.use(remarkStringify);
 *
 * const file = await read("CHANGELOG.md");
 * const result = await processor.process(file);
 * console.log(String(result));
 * ```
 *
 * @see {@link SilkChangesetPreset} for the corresponding lint preset
 *
 * @public
 */
export const SilkChangesetTransformPreset = [
	AggregateDependencyTablesPlugin,
	MergeSectionsPlugin,
	ReorderSectionsPlugin,
	DeduplicateItemsPlugin,
	ContributorFootnotesPlugin,
	IssueLinkRefsPlugin,
	NormalizeFormatPlugin,
] as const;
