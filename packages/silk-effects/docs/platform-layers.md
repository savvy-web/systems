# Platform Layers

Guide to providing platform dependencies for silk-effects services.

## Overview

`@savvy-web/silk-effects` is platform-agnostic. Services declare their
dependencies through Effect's `Layer` type system, and you provide concrete
implementations at the edge of your program. This page explains which platform
layers are needed and how to compose them.

## Layer Tiers

### Tier 0: No Platform Layer

These services are pure -- they perform no I/O and have no platform dependencies.
You only need to provide the service's own `Live` layer.

**Services:** `TargetResolver`, `SilkPublishabilityPlugin`, `TagStrategy`

```typescript
import { Effect } from "effect";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const resolver = yield* TargetResolver;
  return yield* resolver.resolve("npm");
}).pipe(
  Effect.provide(TargetResolverLive),
);

await Effect.runPromise(program);
```

For `SilkPublishabilityPlugin`, you also need `TargetResolverLive` since it
depends on `TargetResolver`:

```typescript
import { Effect } from "effect";
import {
  SilkPublishabilityPlugin,
  SilkPublishabilityPluginLive,
  TargetResolverLive,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const plugin = yield* SilkPublishabilityPlugin;
  return yield* plugin.detect(pkgJson);
}).pipe(
  Effect.provide(SilkPublishabilityPluginLive),
  Effect.provide(TargetResolverLive),
);
```

### Tier 1: FileSystem Layer

These services read or write files. They depend on `FileSystem` from
`@effect/platform`, which is provided by your runtime's context layer.

**Services:** `ChangesetConfigReader`, `VersioningStrategy`, `ManagedSection`,
`ConfigDiscovery`, `BiomeSchemaSync`

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

### Tier 2: FileSystem + CommandExecutor Layer

`ToolDiscovery` additionally requires `CommandExecutor` (to run shell commands)
and two services from `workspaces-effect`: `PackageManagerDetector` and
`WorkspaceRoot`.

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

`NodeContext.layer` provides `FileSystem`, `CommandExecutor`, and other platform
services. `PackageManagerDetector` and `WorkspaceRoot` from `workspaces-effect`
are typically auto-provided through that library's default layers.

## Composing Service Layers

When using multiple services together, compose their layers. Effect's type
system ensures all dependencies are satisfied.

### Services with shared dependencies

Services that share a dependency (like `FileSystem`) only need the platform
layer provided once:

```typescript
import { Effect, Layer } from "effect";
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

### Services with inter-service dependencies

Some services depend on other silk-effects services. Provide them in dependency
order:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  SilkPublishabilityPlugin, SilkPublishabilityPluginLive,
  TargetResolverLive,
  VersioningStrategy, VersioningStrategyLive,
  ChangesetConfigReaderLive,
  TagStrategy, TagStrategyLive,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const plugin = yield* SilkPublishabilityPlugin;
  const versioning = yield* VersioningStrategy;
  const tags = yield* TagStrategy;

  // Detect publishability
  const targets = yield* plugin.detect(pkgJson);

  // Determine versioning strategy
  const vResult = yield* versioning.detect(
    targets.map(() => "@my-org/pkg"),
    process.cwd(),
  );

  // Format tag
  const tagType = yield* tags.determine(vResult);
  return yield* tags.formatTag("@my-org/pkg", "1.0.0", tagType);
});

await Effect.runPromise(
  program.pipe(
    // Service layers
    Effect.provide(SilkPublishabilityPluginLive),
    Effect.provide(TargetResolverLive),
    Effect.provide(VersioningStrategyLive),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(TagStrategyLive),
    // Platform layer
    Effect.provide(NodeContext.layer),
  ),
);
```

### Building a combined layer

For larger programs, you can merge layers:

```typescript
import { Layer } from "effect";
import { NodeContext } from "@effect/platform-node";

const SilkLive = Layer.mergeAll(
  TargetResolverLive,
  TagStrategyLive,
).pipe(
  Layer.provideMerge(SilkPublishabilityPluginLive),
);

const program = Effect.gen(function* () {
  // All three services available
  const resolver = yield* TargetResolver;
  const plugin = yield* SilkPublishabilityPlugin;
  const tags = yield* TagStrategy;
  // ...
}).pipe(
  Effect.provide(SilkLive),
);
```

## Dependency Graph

```text
TargetResolver          (no deps)
SilkPublishabilityPlugin --> TargetResolver
TagStrategy             (no deps)
ChangesetConfigReader   --> FileSystem
VersioningStrategy      --> ChangesetConfigReader
ManagedSection          --> FileSystem
ConfigDiscovery         --> FileSystem
BiomeSchemaSync         --> FileSystem
ToolDiscovery           --> CommandExecutor, PackageManagerDetector, WorkspaceRoot
```

## Testing

For testing, you can provide mock layers instead of real platform layers:

```typescript
import { Layer } from "effect";
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
