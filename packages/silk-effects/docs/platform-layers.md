# Platform layers

Guide to providing platform dependencies for silk-effects services.

## Overview

`@savvy-web/silk-effects` is platform-agnostic. Services declare their dependencies through Effect's `Layer` type system, and you provide concrete implementations at the edge of your program. This page explains which platform layers are needed and how to compose them.

## Layer tiers

### Tier 0: no platform layer

These services are pure — they perform no I/O and have no platform dependencies. You only need to provide the service's own `Live` layer.

**Services:** `TagStrategy`, and the static `SilkPublishability.detect`

`SilkPublishability.detect` is a static, so it needs no layer and no Effect runtime at all:

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect("@my-org/pkg", rawPackageJson, null);
// => ReadonlyArray<PublishTarget>
```

`TagStrategy` is a `Context.Tag`, so provide its `Live` layer:

```typescript
import { Effect } from "effect";
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const ts = yield* TagStrategy;
  return yield* ts.formatTag("@my-org/pkg", "1.0.0", strategy);
}).pipe(
  Effect.provide(TagStrategyLive),
);

await Effect.runPromise(program);
```

### Tier 1: FileSystem layer

These services read or write files. They depend on `FileSystem` from `@effect/platform`, which is provided by your runtime's context layer.

**Services:** `SilkPublishabilityDetectorLive`, `PublishabilityDetectorAdaptiveLive`, `ChangesetConfig`, `ChangesetConfigReader`, `VersioningStrategy`, `ManagedSection`, `ConfigDiscovery`, `BiomeSchemaSync`

**Node.js:**

```typescript
import { NodeContext } from "@effect/platform-node";

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  // ...
}).pipe(
  Effect.provide(ManagedSectionLive),
  Effect.provide(NodeContext.layer),
);
```

**Bun:**

```typescript
import { BunContext } from "@effect/platform-bun";

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  // ...
}).pipe(
  Effect.provide(ManagedSectionLive),
  Effect.provide(BunContext.layer),
);
```

The publishability detector layers also live in this tier. `SilkPublishabilityDetectorLive` requires only `FileSystem`; `PublishabilityDetectorAdaptiveLive` additionally requires `ChangesetConfig` (see below).

### Tier 2: FileSystem + CommandExecutor layer

`ToolDiscovery` additionally requires `CommandExecutor` (to run shell commands) and two services from `workspaces-effect`: `PackageManagerDetector` and `WorkspaceRoot`.

**Services:** `ToolDiscovery`

```typescript
import { NodeContext } from "@effect/platform-node";
import {
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;
  const tool = yield* td.resolve(ToolDefinition.make({ name: "biome" }));
  return yield* tool.exec("check", ".").string();
}).pipe(
  Effect.provide(ToolDiscoveryLive),
  Effect.provide(NodeContext.layer),
);
```

`NodeContext.layer` provides `FileSystem`, `CommandExecutor` and other platform services. `PackageManagerDetector` and `WorkspaceRoot` from `workspaces-effect` are typically auto-provided through that library's default layers.

## Composing service layers

When using multiple services together, compose their layers. Effect's type system ensures all dependencies are satisfied.

### Services with shared dependencies

Services that share a dependency (like `FileSystem`) only need the platform layer provided once:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ManagedSection, ManagedSectionLive,
  ConfigDiscovery, ConfigDiscoveryLive,
  BiomeSchemaSync, BiomeSchemaSyncLive,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  const discovery = yield* ConfigDiscovery;
  const syncer = yield* BiomeSchemaSync;
  // use all three services
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

### Adaptive publishability with ChangesetConfig

`PublishabilityDetectorAdaptiveLive` overrides `workspaces-effect`'s `PublishabilityDetector` Tag and dispatches by changeset mode. It needs the `ChangesetConfig` service, which in turn needs `ChangesetConfigReader`. Wire them with `Layer.mergeAll` and provide the platform layer once:

```typescript
import { Effect, Layer } from "effect";
import { NodeContext } from "@effect/platform-node";
import { PublishabilityDetector } from "workspaces-effect";
import {
  ChangesetConfig, ChangesetConfigLive, ChangesetConfigReaderLive,
  PublishabilityDetectorAdaptiveLive,
} from "@savvy-web/silk-effects";

const layer = Layer.mergeAll(
  PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(ChangesetConfigLive)),
  ChangesetConfigLive,
  ChangesetConfigReaderLive,
).pipe(Layer.provide(NodeContext.layer));

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  const config = yield* ChangesetConfig;
  const mode = yield* config.mode(process.cwd());
  return yield* detector.detect(pkg, process.cwd());
}).pipe(Effect.provide(layer));

await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

For unconditional silk rules without changeset awareness, use `SilkPublishabilityDetectorLive` instead, which needs only the platform layer:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { PublishabilityDetector } from "workspaces-effect";
import { SilkPublishabilityDetectorLive } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  return yield* detector.detect(pkg, process.cwd());
}).pipe(
  Effect.provide(SilkPublishabilityDetectorLive),
  Effect.provide(NodeContext.layer),
);

await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

## Dependency graph

```text
SilkPublishability.detect          (pure static, no layer)
TagStrategy                        (no deps)
SilkPublishabilityDetectorLive     --> FileSystem
PublishabilityDetectorAdaptiveLive --> FileSystem, ChangesetConfig
ChangesetConfigReader              --> FileSystem
ChangesetConfig                    --> ChangesetConfigReader
VersioningStrategy                 --> ChangesetConfigReader
ManagedSection                     --> FileSystem
ConfigDiscovery                    --> FileSystem
BiomeSchemaSync                    --> FileSystem
ToolDiscovery                      --> CommandExecutor, PackageManagerDetector, WorkspaceRoot
```

## Testing

For testing, you can provide mock layers instead of real platform layers:

```typescript
import { Effect, Layer } from "effect";
import { FileSystem } from "@effect/platform";

const MockFileSystem = Layer.succeed(FileSystem.FileSystem, {
  exists: () => Effect.succeed(true),
  readFileString: () => Effect.succeed("mock content"),
  writeFileString: () => Effect.succeed(undefined),
  // ... other methods as needed
} as FileSystem.FileSystem);

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  // test with mock filesystem
}).pipe(
  Effect.provide(ManagedSectionLive),
  Effect.provide(MockFileSystem),
);
```
