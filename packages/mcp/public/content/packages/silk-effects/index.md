---
id: packages/silk-effects/
title: silk-effects overview
summary: Load to orient on the shared Effect library and its service map before diving into a service.
tier: packages
source: hand
tags: [silk-effects, effect]
priority: 0.5
related: [packages/silk-effects/platform-layers, packages/silk-effects/managed-section, standards/publishability]
---

## What

`@savvy-web/silk-effects` is a platform-agnostic Effect library holding the shared
conventions of the Silk Suite. It extracts repeated patterns — publishability
rules, changeset config reading, managed file sections, tool discovery — into one
package consumed by the `savvy` CLI, `@savvy-web/silk`, GitHub Actions, and build
scripts. It builds on `@effect/platform` abstractions rather than importing Node or
Bun APIs directly, so the same service implementations run on any `@effect/platform`
runtime once the consumer provides a context layer at the edge.

## API

Every service is a `Context.Tag` accessed with `yield*` inside `Effect.gen`. The
entire public API ships from the single package root — there are no subpath exports.

```typescript
import {
  SilkPublishability,
  ManagedSection, ManagedSectionLive, SectionDefinition, SectionBlock,
  ToolDiscovery, ToolDiscoveryLive, ToolDefinition,
} from "@savvy-web/silk-effects";
```

Service index:

- `SilkPublishability` — static publishability `detect` plus detector layers.
- `TagStrategy` — git tag formatting (pure, no platform layer).
- `ChangesetConfig` / `ChangesetConfigReader` — read and query `.changeset/config.json`.
- `VersioningStrategy` — version resolution.
- `ManagedSection` — BEGIN/END tool-owned regions in user-editable files.
- `ConfigDiscovery` — locate config files.
- `BiomeSchemaSync` — keep the Biome schema in sync.
- `ToolDiscovery` — resolve and execute project tools (biome, husky, and the rest).

It also hosts the dev-tooling business logic under three namespace exports —
`Changesets`, `Commitlint`, `Lint` — which the `savvy` CLI and `@savvy-web/silk`
shims both consume so neither imports the other.

## Layer

Services fall into three platform tiers: pure (no layer), `FileSystem`, and
`FileSystem` + `CommandExecutor`. See `silk://packages/silk-effects/platform-layers`
for the full guide. `effect` and `@effect/platform` are peer dependencies;
`workspaces-effect`, `semver-effect`, `jsonc-effect`, and `yaml-effect` are direct.

## Usage

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect("@my-org/pkg", {
  private: true,
  publishConfig: { access: "public", targets: ["npm"] },
});
// => [PublishTarget { registry: "https://registry.npmjs.org/", access: "public", ... }]
```

All errors extend `Data.TaggedError` with a `_tag` discriminant, so they are
pattern-matchable with `Effect.catchTag`.

## Related

Platform layers: `silk://packages/silk-effects/platform-layers`. Managed sections:
`silk://packages/silk-effects/managed-section`. The publishability rules this
package encodes: `silk://standards/publishability`.
