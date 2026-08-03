---
"@savvy-web/mcp": patch
---

## Refactoring

* Internal layer composition in the MCP server's runtime updated to consume `@savvy-web/silk-effects`'s renamed service statics (`ChangesetConfig.layer`, `ChangesetConfigReader.layer`, `SilkPublishability.layerAdaptive`, `SilkWorkspaceAnalyzer.layer`, `Changesets.BranchAnalyzer.layer`, `Changesets.ReleasePlanner.layer`, `Changesets.ConfigInspector.layer`, `Changesets.DepsRegen.layer`, `Repos.ReposManager.layer`, `Repos.ReposConfigStore.layer`, `Turbo.TurboInspector.layer`) in place of the removed `XLive` exports. No change to the server's tool surface or behavior.
