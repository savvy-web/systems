/**
 * \@savvy-web/changesets/remark
 *
 * Remark plugins for changeset validation and CHANGELOG transformation.
 *
 * This entry point re-exports all lint rules, transform plugins, and presets
 * from a single import path. The exports are organized into three groups:
 *
 * **Lint rules** validate changeset markdown structure before changelog generation:
 * - {@link HeadingHierarchyRule} (CSH001) -- heading depth and ordering
 * - {@link RequiredSectionsRule} (CSH002) -- recognized section headings
 * - {@link ContentStructureRule} (CSH003) -- non-empty sections, code fences, list items
 * - {@link UncategorizedContentRule} (CSH004) -- content before the first heading
 * - {@link DependencyTableFormatRule} (CSH005) -- dependency table schema compliance
 *
 * **Transform plugins** normalize and clean up generated CHANGELOG markdown:
 * - {@link AggregateDependencyTablesPlugin} -- merge duplicate dependency sections
 * - {@link MergeSectionsPlugin} -- merge duplicate h3 section headings
 * - {@link ReorderSectionsPlugin} -- sort sections by category priority
 * - {@link DeduplicateItemsPlugin} -- remove duplicate list items
 * - {@link ContributorFootnotesPlugin} -- aggregate contributor attributions
 * - {@link IssueLinkRefsPlugin} -- convert inline issue links to reference-style
 * - {@link NormalizeFormatPlugin} -- remove empty sections and lists
 *
 * **Presets** bundle related rules or plugins for convenient consumption:
 * - {@link SilkChangesetPreset} -- all five lint rules
 * - {@link SilkChangesetTransformPreset} -- all seven transform plugins in execution order
 *
 * @example
 * ```typescript
 * import {
 *   SilkChangesetPreset,
 *   SilkChangesetTransformPreset,
 * } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 *
 * // Lint a changeset file
 * const linter = unified().use(remarkParse);
 * for (const rule of SilkChangesetPreset) {
 *   linter.use(rule);
 * }
 *
 * // Transform a CHANGELOG
 * const transformer = unified().use(remarkParse);
 * for (const plugin of SilkChangesetTransformPreset) {
 *   transformer.use(plugin);
 * }
 * transformer.use(remarkStringify);
 * ```
 *
 * @packageDocumentation
 */

// === Transform Plugins ===

export { AggregateDependencyTablesPlugin } from "./plugins/aggregate-dependency-tables.js";
export { ContributorFootnotesPlugin } from "./plugins/contributor-footnotes.js";
export { DeduplicateItemsPlugin } from "./plugins/deduplicate-items.js";
export { IssueLinkRefsPlugin } from "./plugins/issue-link-refs.js";
export { MergeSectionsPlugin } from "./plugins/merge-sections.js";
export { NormalizeFormatPlugin } from "./plugins/normalize-format.js";
export { ReorderSectionsPlugin } from "./plugins/reorder-sections.js";

// === Presets ===

export { SilkChangesetPreset, SilkChangesetTransformPreset } from "./presets.js";

// === Lint Rules ===

export { ContentStructureRule } from "./rules/content-structure.js";
export { DependencyTableFormatRule } from "./rules/dependency-table-format.js";
export { HeadingHierarchyRule } from "./rules/heading-hierarchy.js";
export { RequiredSectionsRule } from "./rules/required-sections.js";
export { UncategorizedContentRule } from "./rules/uncategorized-content.js";
