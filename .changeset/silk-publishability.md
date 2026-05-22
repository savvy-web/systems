---
"@savvy-web/silk-effects": minor
---

Standardize publishability on workspaces-effect's `PublishTarget` + `PublishabilityDetector` Tag. Adds `SilkPublishability` (the silk `detect` rule plus `expandShorthand`/`resolveTargetAccess` helpers and `resolveTargets`/`listPublishable` resolvers, all as static members), `SilkPublishabilityDetectorLive`, `PublishabilityDetectorAdaptiveLive` (ignore-aware silk/vanilla/none dispatch over the `PublishabilityDetector` Tag), and a `ChangesetConfig` accessor service (`mode`/`versionPrivate`/`ignorePatterns`/`isIgnored`/`fixed`, plus the static `ChangesetConfig.matches` ignore matcher). `SilkWorkspaceAnalyzer` now emits `PublishTarget` and honors `@scope/*` wildcard changeset-ignore patterns.

**Breaking:** removes the bespoke `SilkPublishabilityPlugin`, `TargetResolver`, the `PublishabilitySchemas` exports (`PublishTarget`/`ResolvedTarget`/`PublishProtocol`/`PublishTargetObject`/`PublishTargetShorthand`/`AuthStrategy`), `TargetResolutionError`, and `PublishConfigError`. The changeset-config schema types `ChangesetConfig`/`SilkChangesetConfig` are renamed to `ChangesetConfigFile`/`SilkChangesetConfigFile` — the `ChangesetConfig` name is now the accessor service. `auth`/`tokenEnv` resolution moves consumer-side.
