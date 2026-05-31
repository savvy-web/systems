/**
 * Remark plugins and presets shim for \@savvy-web/silk.
 *
 * Drop-in replacement for \@savvy-web/changesets/remark.
 * Re-exports all transform plugins, presets, and lint rules so remark
 * configs that import from the old module path continue to work unchanged.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";

// === Transform Plugins ===
export const AggregateDependencyTablesPlugin: typeof Changesets.AggregateDependencyTablesPlugin =
	Changesets.AggregateDependencyTablesPlugin;
export const ContributorFootnotesPlugin: typeof Changesets.ContributorFootnotesPlugin =
	Changesets.ContributorFootnotesPlugin;
export const DeduplicateItemsPlugin: typeof Changesets.DeduplicateItemsPlugin = Changesets.DeduplicateItemsPlugin;
export const IssueLinkRefsPlugin: typeof Changesets.IssueLinkRefsPlugin = Changesets.IssueLinkRefsPlugin;
export const MergeSectionsPlugin: typeof Changesets.MergeSectionsPlugin = Changesets.MergeSectionsPlugin;
export const NormalizeFormatPlugin: typeof Changesets.NormalizeFormatPlugin = Changesets.NormalizeFormatPlugin;
export const ReorderSectionsPlugin: typeof Changesets.ReorderSectionsPlugin = Changesets.ReorderSectionsPlugin;

// === Presets ===
export const SilkChangesetPreset: typeof Changesets.SilkChangesetPreset = Changesets.SilkChangesetPreset;
export const SilkChangesetTransformPreset: typeof Changesets.SilkChangesetTransformPreset =
	Changesets.SilkChangesetTransformPreset;

// === Lint Rules ===
export const ContentStructureRule: typeof Changesets.ContentStructureRule = Changesets.ContentStructureRule;
export const DependencyTableFormatRule: typeof Changesets.DependencyTableFormatRule =
	Changesets.DependencyTableFormatRule;
export const HeadingHierarchyRule: typeof Changesets.HeadingHierarchyRule = Changesets.HeadingHierarchyRule;
export const RequiredSectionsRule: typeof Changesets.RequiredSectionsRule = Changesets.RequiredSectionsRule;
export const UncategorizedContentRule: typeof Changesets.UncategorizedContentRule = Changesets.UncategorizedContentRule;
