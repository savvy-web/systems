---
id: packages/silk-effects/platform-layers
title: Providing platform layers
summary: Load when wiring silk-effects services into a program and deciding which layers to provide.
tier: packages
source: hand
tags: [silk-effects, effect]
priority: 0.5
related: [packages/silk-effects/, packages/silk-effects/managed-section]
---

## What

silk-effects is platform-agnostic: services declare their dependencies through
Effect's `Layer` type system, and the consumer provides concrete implementations at
the edge of the program. There are three tiers.

## API

**Tier 0 — no platform layer.** Pure services with no I/O. `SilkPublishability.detect`
is a static needing no layer or runtime. `TagStrategy` is a `Context.Tag`, so provide
its `TagStrategyLive`.

**Tier 1 — FileSystem.** Read/write services depend on `FileSystem` from
`@effect/platform`, supplied by the runtime context layer (`NodeContext.layer` or
`BunContext.layer`). Members: `SilkPublishabilityDetectorLive`,
`PublishabilityDetectorAdaptiveLive`, `ChangesetConfig`, `ChangesetConfigReader`,
`VersioningStrategy`, `ManagedSection`, `ConfigDiscovery`, `BiomeSchemaSync`.

**Tier 2 — FileSystem + CommandExecutor.** `ToolDiscovery` also needs
`CommandExecutor` plus `PackageManagerDetector` and `WorkspaceRoot` from
`workspaces-effect`. `NodeContext.layer` provides `FileSystem` and `CommandExecutor`.

Dependency graph:

```text
SilkPublishability.detect          (pure static, no layer)
TagStrategy                        (no deps)
SilkPublishabilityDetectorLive     --> FileSystem
PublishabilityDetectorAdaptiveLive --> FileSystem, ChangesetConfig
ChangesetConfigReader              --> FileSystem
ChangesetConfig                    --> ChangesetConfigReader
VersioningStrategy                 --> ChangesetConfigReader
ManagedSection, ConfigDiscovery, BiomeSchemaSync --> FileSystem
ToolDiscovery                      --> CommandExecutor, PackageManagerDetector, WorkspaceRoot
```

## Layer

Compose with `Effect.provide` / `Layer.mergeAll`; services sharing a dependency
(like `FileSystem`) need the platform layer provided once.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects";

await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    // ...
  }).pipe(Effect.provide(ManagedSectionLive), Effect.provide(NodeContext.layer)),
);
```

## Usage

The adaptive detector overrides `workspaces-effect`'s `PublishabilityDetector` Tag
and dispatches by changeset mode; it needs `ChangesetConfig`, which needs
`ChangesetConfigReader`:

```typescript
import { Layer } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ChangesetConfigLive, ChangesetConfigReaderLive,
  PublishabilityDetectorAdaptiveLive,
} from "@savvy-web/silk-effects";

const layer = Layer.mergeAll(
  PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(ChangesetConfigLive)),
  ChangesetConfigLive,
  ChangesetConfigReaderLive,
).pipe(Layer.provide(NodeContext.layer));
```

For unconditional Silk rules without changeset awareness, use
`SilkPublishabilityDetectorLive`, which needs only the platform layer. For tests,
provide a mock `FileSystem` layer in place of `NodeContext.layer`.

## Related

Overview: `silk://packages/silk-effects/`. ManagedSection:
`silk://packages/silk-effects/managed-section`.
