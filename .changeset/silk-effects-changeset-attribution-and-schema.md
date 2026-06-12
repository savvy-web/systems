---
"@savvy-web/silk-effects": minor
---

## Features

Exposes the changeset resolved-output result types as Effect `Schema`, so downstream tools can validate them and generate schemas from a single source of truth. New exports from the `Changesets` namespace: `BranchAnalysisSchema`, `BranchFileEntrySchema`, `FileStatusSchema`, `InspectedConfigSchema`, `ResolvedPackageScopeSchema`, `ResolvedVersionFileSchema`, `ClassificationSchema`, and `ClassificationReasonSchema`. The existing `BranchAnalysis`, `InspectedConfig`, and related types are now derived from these schemas, so their shape is unchanged.

## Bug Fixes

* `ConfigInspector` now attributes changed files to workspace packages even when `.changeset/config.json` declares no explicit `packages` record. It falls back to the discovered workspace packages that are a release surface — those whose `publishConfig` resolves to publish targets — so single-root repos and monorepos with a non-root package directory get correct attribution instead of an empty result. A private package with no `publishConfig` is correctly excluded, and packages in the `ignore` list remain valid changeset targets.
* `silk/body-no-markdown` no longer flags double-underscore identifiers such as `__PACKAGE_VERSION__` as bold. Bold is now detected only in its asterisk form, so identifier tokens written in commit bodies are accepted.
