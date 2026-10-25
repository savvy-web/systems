---
"@savvy-web/silk-effects": major
---

## Breaking Changes

The changesets transformer and linter now run on `@effected/markdown` instead of remark and unified (savvy-web/systems#804). The unified-plugin exports of the `Changesets` namespace no longer exist, and `DependencyTable` now works with the kit's `Table` class.

### Removed exports

These `Changesets` namespace exports are deleted:

* `AggregateDependencyTablesPlugin`, `ContributorFootnotesPlugin`, `DeduplicateItemsPlugin`, `IssueLinkRefsPlugin`, `MaintenanceNotePlugin`, `MergeSectionsPlugin`, `NormalizeFormatPlugin` and `ReorderSectionsPlugin`
* `SilkChangesetPreset` and `SilkChangesetTransformPreset`
* `ContentStructureRule`, `DependencyTableFormatRule`, `HeadingHierarchyRule`, `RequiredSectionsRule` and `UncategorizedContentRule`

Migration: use `ChangelogTransformer` and `ChangesetLinter`, which keep their signatures and produce the same output, with one exception: CSH003 (`changeset-content-structure`) no longer reports an empty `##` section nested inside a blockquote or list item. That matches the markdownlint rule, which only checks top-level sections. Code that composed the plugins or presets into its own unified pipeline must call these two instead.

### DependencyTable types

`DependencyTable.parse` and `DependencyTable.serialize` now take and return the `Table` class from `@effected/markdown`. Consumers that construct a table import `Table` from `@effected/markdown`.

## Bug Fixes

* `ChangelogTransformer` keeps every item under its own heading when duplicate sections interleave (Features, Bug Fixes, Features, Bug Fixes); the previous merge pass misordered the second group's items and could remove unrelated nodes
* `ChangelogTransformer` drops an empty section whose only follower is an issue reference definition instead of keeping the empty heading

## Refactoring

* The changesets transformer and linter run on `@effected/markdown`, and the `remark` and `unified` dependencies are removed
* Output is byte-identical to the previous implementation on the existing changelog corpus
