# Platform layers

Guide to providing platform dependencies for silk-effects services.

## Overview

`@savvy-web/silk-effects` is platform-agnostic. Services declare their dependencies through Effect's `Layer` type system, and you provide concrete implementations at the edge of your program. This page explains which platform layers are needed and how to compose them.

## Layer tiers

### Tier 0: no platform layer

These services are pure — they perform no I/O and have no platform dependencies. You only need to provide the service's own `layer` static.

**Services:** the static `SilkPublishability.detect`

`SilkPublishability.detect` is a static, so it needs no layer and no Effect runtime at all:

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect("@my-org/pkg", rawPackageJson, null);
// => ReadonlyArray<PublishTarget>
```

Git tag and versioning classification are pure value classes in
`@effected/workspaces` (`ReleaseTag`, `TrackingTag`, `classifyTag`,
`VersioningStrategy.classify`), so they need no layer either:

```typescript
import { ReleaseTag, VersioningStrategy } from "@effected/workspaces";

const strategy = VersioningStrategy.classify({ packages, fixedGroups });
const tags = strategy.tagsFor([{ name: "@my-org/pkg", version: "1.0.0" }]);
// => ReadonlyArray<ReleaseTag>
```

### Tier 1: FileSystem layer

These services read or write files. They depend on `FileSystem` from `effect`, which is provided by your runtime's platform layer.

**Services:** `SilkPublishability.layer`, `SilkPublishability.layerAdaptive`, `ChangesetConfig`, `ChangesetConfigReader`, `ConfigDiscovery`, `BiomeSchemaSync`

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ConfigDiscovery } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const cd = yield* ConfigDiscovery;
  return yield* cd.find("biome.jsonc");
}).pipe(
  Effect.provide(ConfigDiscovery.layer),
  Effect.provide(NodeServices.layer),
);
// => { path: "/project/biome.jsonc", source: "root" } | null
```

Swap `NodeServices.layer` for the platform layer of whichever runtime you target; nothing above it changes.

The publishability detector layers also live in this tier. `SilkPublishability.layer` requires only `FileSystem`; `SilkPublishability.layerAdaptive` additionally requires `ChangesetConfig` (see below).

### Tier 2: FileSystem + process layer

`Turbo.TurboInspector` shells out to `turbo`, so beyond `FileSystem` it needs the platform process spawner, `Git` from `@effected/git` and `ToolDiscovery` from `@effected/commands`. `ToolDiscovery` reads `PackageManagerDetector` and `WorkspaceRoot` through `Workspaces.localExecLayer()`, which is what teaches it to run a project-local binary.

**Services:** `Turbo.TurboInspector`

```typescript
import { Effect, Layer } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ToolDiscovery } from "@effected/commands";
import { Git } from "@effected/git";
import { PackageManagerDetector, WorkspaceRoot, Workspaces } from "@effected/workspaces";
import { Turbo } from "@savvy-web/silk-effects";

const WorkspaceLive = Layer.mergeAll(WorkspaceRoot.layer, PackageManagerDetector.layer);
const ToolsLive = ToolDiscovery.layer.pipe(
  Layer.provide(Workspaces.localExecLayer()),
  Layer.provide(WorkspaceLive),
);

const program = Effect.gen(function* () {
  const turbo = yield* Turbo.TurboInspector;
  return yield* turbo.taskGraph(process.cwd(), "build:dev");
}).pipe(
  Effect.provide(Turbo.TurboInspector.layer),
  Effect.provide(Layer.mergeAll(ToolsLive, Git.layer)),
  Effect.provide(NodeServices.layer),
);
// => the task graph for build:dev and its critical path
```

`NodeServices.layer` provides `FileSystem`, the child-process spawner and the rest of the platform services these layers bottom out in.

## Composing service layers

When using multiple services together, compose their layers. Effect's type system ensures all dependencies are satisfied.

### Services with shared dependencies

Services that share a dependency (like `FileSystem`) only need the platform layer provided once:

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import {
  ChangesetConfigReader,
  ConfigDiscovery,
  BiomeSchemaSync,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const reader = yield* ChangesetConfigReader;
  const discovery = yield* ConfigDiscovery;
  const syncer = yield* BiomeSchemaSync;
  // use all three services
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(ChangesetConfigReader.layer),
    Effect.provide(ConfigDiscovery.layer),
    Effect.provide(BiomeSchemaSync.layer),
    Effect.provide(NodeServices.layer),
  ),
);
```

### Adaptive publishability with ChangesetConfig

`SilkPublishability.layerAdaptive` overrides `@effected/workspaces`'s `PublishabilityDetector` Tag and dispatches by changeset mode. It needs the `ChangesetConfig` service, which in turn needs `ChangesetConfigReader`. Wire them with `Layer.mergeAll` and provide the platform layer once:

```typescript
import { Effect, Layer } from "effect";
import { NodeServices } from "@effect/platform-node";
import { PublishabilityDetector } from "@effected/workspaces";
import {
  ChangesetConfig, ChangesetConfigReader,
  SilkPublishability,
} from "@savvy-web/silk-effects";

const layer = Layer.mergeAll(
  SilkPublishability.layerAdaptive.pipe(Layer.provide(ChangesetConfig.layer)),
  ChangesetConfig.layer,
  ChangesetConfigReader.layer,
).pipe(Layer.provide(NodeServices.layer));

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  const config = yield* ChangesetConfig;
  const mode = yield* config.mode(process.cwd());
  return yield* detector.detect(pkg, process.cwd());
}).pipe(Effect.provide(layer));

await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

For unconditional silk rules without changeset awareness, use `SilkPublishability.layer` instead, which needs only the platform layer:

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { PublishabilityDetector } from "@effected/workspaces";
import { SilkPublishability } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  return yield* detector.detect(pkg, process.cwd());
}).pipe(
  Effect.provide(SilkPublishability.layer),
  Effect.provide(NodeServices.layer),
);

await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

## Dependency graph

```text
SilkPublishability.detect          (pure static, no layer)
SilkPublishability.layer           --> FileSystem
SilkPublishability.layerAdaptive   --> FileSystem, ChangesetConfig
ChangesetConfigReader              --> FileSystem
ChangesetConfig                    --> ChangesetConfigReader
ConfigDiscovery                    --> FileSystem
BiomeSchemaSync                    --> FileSystem
Turbo.TurboInspector               --> ToolDiscovery, Git, FileSystem, process spawner
```

## Testing

In tests, provide a stub filesystem instead of the real platform layer. `FileSystem.layerNoop` takes only the methods your program calls and dies on anything else, so an unexpected read shows up as a failure rather than a silent default:

```typescript
import { Effect, FileSystem } from "effect";
import { ConfigDiscovery } from "@savvy-web/silk-effects";

const TestFileSystem = FileSystem.layerNoop({
  exists: () => Effect.succeed(true),
  readFileString: () => Effect.succeed("mock content"),
});

const program = Effect.gen(function* () {
  const cd = yield* ConfigDiscovery;
  return yield* cd.find("biome.jsonc");
}).pipe(
  Effect.provide(ConfigDiscovery.layer),
  Effect.provide(TestFileSystem),
);
// => the stubbed location, with no disk access
```
