# Package overview

## What is silk-effects?

`@savvy-web/silk-effects` is a platform-agnostic [Effect](https://effect.website/) library that provides shared conventions for the Silk Suite ecosystem. It extracts repeated patterns from across the repositories into a single package consumed by GitHub Actions, CLI tools and build scripts.

## Design philosophy

### Platform-agnostic

The library builds on Effect's platform abstractions rather than importing Node.js or Bun APIs directly. Consumers provide their runtime layer — `NodeServices.layer` from `@effect/platform-node`, or the equivalent for their runtime — at the edge of their program. The same service implementations work wherever that layer can be built.

### Effect-based composition

Every service is a `Context.Service` class that you access with `yield*` inside `Effect.gen`. Services declare their dependencies through their `Layer` type signature. You compose layers to build the full dependency graph, and the Effect type system ensures you provide everything required.

### Single root export

All public API is exported from the package root. There are no sub-path exports. You always import from `@savvy-web/silk-effects`:

```typescript
import {
  SilkPublishability,
  ChangesetConfig,
  ConfigDiscovery,
  Changesets, Lint, Turbo,
} from "@savvy-web/silk-effects";
```

### Value objects with structural equality

Schemas and value objects implement `Equal.Equal` and `Hash.Hash` for structural comparison, so two results built from the same data compare equal without a field-by-field walk.

## Platform layer concept

Services fall into three tiers based on their runtime requirements:

1. **No platform layer** — pure services with no I/O. Provide only the service's own `layer` static, or in the case of `SilkPublishability.detect`, call the static directly.
2. **FileSystem layer** — services that read or write files. Provide the service layer plus `NodeServices.layer`.
3. **FileSystem + process layer** — services that also spawn a child process. Same as above, but additionally requires `ToolDiscovery` from `@effected/commands`, which itself reads `PackageManagerDetector` and `WorkspaceRoot` from `@effected/workspaces`.

See [Platform layers](./02-platform-layers.md) for the full guide.

## Quick start

### Pure logic (no layers)

`SilkPublishability.detect` is a static — call it directly with a package name, the raw `package.json` and the bundler's target binding (`null` before the prod build has run):

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect(
  "@my-org/pkg",
  {
    private: true,
    publishConfig: { access: "public", targets: { npm: true } },
  },
  null,
);
// => [PublishTarget { registry: "https://registry.npmjs.org", access: "public", ... }]
```

### FileSystem service

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ConfigDiscovery } from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const cd = yield* ConfigDiscovery;
    return yield* cd.find("biome.jsonc");
  }).pipe(
    Effect.provide(ConfigDiscovery.layer),
    Effect.provide(NodeServices.layer),
  ),
);
// => { path: "/project/biome.jsonc", source: "root" } | null
```

### Process-spawning service

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

const affected = await Effect.runPromise(
  Effect.gen(function* () {
    const turbo = yield* Turbo.TurboInspector;
    return yield* turbo.affected(process.cwd());
  }).pipe(
    Effect.provide(Turbo.TurboInspector.layer),
    Effect.provide(Layer.mergeAll(ToolsLive, Git.layer)),
    Effect.provide(NodeServices.layer),
  ),
);
// => the packages affected relative to the base ref
```

## Dependencies

```text
@savvy-web/silk-effects
  |- effect (peer)
  |- @effected/workspaces (direct)
  |- @effected/commands (direct)
  |- @effected/templates (direct)
  |- @effected/git (direct)
  |- @effected/github-references (direct)
  |- @effected/glob (direct)
  |- @effected/jsonc (direct)
  |- @effected/package-json (direct)
  |- @effected/walker (direct)
  +- @effected/yaml (direct)
```

`effect` is a peer dependency. Consumers install it alongside this package, plus the platform package for their runtime, to avoid version conflicts and bundle duplication.

## Error handling

All errors extend `Data.TaggedError` with a `_tag` discriminant and a `message` getter. This makes them pattern-matchable with `Effect.catchTag`:

```typescript
import { Effect } from "effect";
import {
  ChangesetConfigReader,
} from "@savvy-web/silk-effects";
import { NodeServices } from "@effect/platform-node";

const config = await Effect.runPromise(
  Effect.gen(function* () {
    const reader = yield* ChangesetConfigReader;
    return yield* reader.read(process.cwd());
  }).pipe(
    Effect.catchTag("ChangesetConfigError", (err) =>
      Effect.succeed(`Fallback: ${err.reason}`)
    ),
    Effect.provide(ChangesetConfigReader.layer),
    Effect.provide(NodeServices.layer),
  ),
);
```

The `SilkPublishability` API does not raise errors: the pure `detect` returns `[]` for non-publishable packages, and the detector layers have an error channel of `never`.

## Service index

| Service | Platform layer | Page |
| ------- | -------------- | ---- |
| SilkPublishability | None (static `detect`) | [03-publishability.md](./03-publishability.md) |
| SilkPublishability.layer / SilkPublishability.layerAdaptive | FileSystem (+ ChangesetConfig) | [03-publishability.md](./03-publishability.md) |
| ChangesetConfig | FileSystem | [04-changeset-config.md](./04-changeset-config.md) |
| ChangesetConfigReader | FileSystem | [04-changeset-config.md](./04-changeset-config.md) |
| ConfigDiscovery | FileSystem | [05-config-discovery.md](./05-config-discovery.md) |
| BiomeSchemaSync | FileSystem | [06-biome-sync.md](./06-biome-sync.md) |
| Turbo.TurboInspector | FileSystem + process | [README](../README.md#turboinspector) |
| Repos.ReposManager | FileSystem + process | [README](../README.md#reposmanager-reposdrift-and-reposlockdown) |
| Repos.ReposDrift | FileSystem + process | [README](../README.md#reposmanager-reposdrift-and-reposlockdown) |
| Repos.ReposConfigStore | FileSystem | [README](../README.md#reposmanager-reposdrift-and-reposlockdown) |
| Repos.ReposLockdown | FileSystem | [README](../README.md#reposmanager-reposdrift-and-reposlockdown) |
