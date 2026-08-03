---
"@savvy-web/cli": patch
---

## Refactoring

* Internal layer composition in the CLI's root command updated to consume `@savvy-web/silk-effects`'s renamed service statics (`ChangesetConfigReader.layer`, `SilkPublishability.layer`, `BiomeSchemaSync.layer`, `ConfigDiscovery.layer`, `Changesets.ConfigInspector.layer`, `Changesets.ReleasePlanner.layer`, `Changesets.BranchAnalyzer.layer`, `Repos.ReposManager.layer`, `Repos.ReposConfigStore.layer`) in place of the removed `XLive` exports. No change to CLI commands or behavior.
