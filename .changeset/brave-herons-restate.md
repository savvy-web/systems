---
"@savvy-web/silk-effects": minor
---

## Breaking Changes

### Layer statics replace `XLive` exports

Every service's production layer moves from a standalone `XLive` const to a `.layer` static on the service's own `Context.Service` class. The old `XLive` names are removed from the package's exports — both the flat services and the `Changesets`, `Repos`, and `Turbo` namespaces.

```typescript
// Before
import { BiomeSchemaSyncLive, ChangesetConfigReaderLive, ConfigDiscoveryLive } from "@savvy-web/silk-effects";

Effect.provide(BiomeSchemaSyncLive);
Effect.provide(ChangesetConfigReaderLive);
Effect.provide(ConfigDiscoveryLive);

// After
import { BiomeSchemaSync, ChangesetConfigReader, ConfigDiscovery } from "@savvy-web/silk-effects";

Effect.provide(BiomeSchemaSync.layer);
Effect.provide(ChangesetConfigReader.layer);
Effect.provide(ConfigDiscovery.layer);
```

Affected services: `BiomeSchemaSync`, `ChangesetConfig`, `ChangesetConfigReader`, `ConfigDiscovery`, `SilkWorkspaceAnalyzer`, `Changesets.BranchAnalyzer`, `Changesets.ConfigInspector`, `Changesets.DepsRegen`, `Changesets.GitHubService`, `Changesets.ReleasePlanner`, `Repos.ReposConfigStore`, `Repos.ReposManager`, and `Turbo.TurboInspector`.

`SilkPublishability` carries two production layers rather than one, so both move to statics: `SilkPublishability.layer` (the default detector) and `SilkPublishability.layerAdaptive` (the config-aware variant, replacing `PublishabilityDetectorAdaptiveLive`).

This is a genuine breaking change to the package's export surface, released as a minor bump rather than a major: consumption of `@savvy-web/silk-effects` is effectively in-house across the Silk Suite, so the migration cost is contained and immediate.
