# @savvy-web/silk-effects documentation

Shared [Effect](https://effect.website/) library providing Silk Suite conventions consumed across the ecosystem. Platform-agnostic — consumers provide their own platform layer, such as `NodeServices.layer` from `@effect/platform-node`.

## Purpose

Silk Suite repos independently implemented the same patterns for publishability detection, changeset config access, release planning, config discovery and Biome schema synchronization. This library extracts those patterns into a single shared package so behavior stays consistent and changes propagate everywhere.

## Install

```bash
npm install @savvy-web/silk-effects effect @effect/platform-node
# or
pnpm add @savvy-web/silk-effects effect @effect/platform-node
```

`effect` is a peer dependency — install it alongside the package, plus the platform package matching your runtime.

All exports come from the package root:

```typescript
import {
  SilkPublishability,
  ChangesetConfig,
  Changesets,
  Lint,
  Turbo,
} from "@savvy-web/silk-effects";
```

There are no sub-path exports. Everything is imported from `@savvy-web/silk-effects`.

## Pages

- [Package overview](./01-overview.md) — what the library is, its design philosophy and platform-layer model
- [Platform layers](./02-platform-layers.md) — composing layers and providing platform dependencies
- [Publishability](./03-publishability.md) — silk publishability rules, the detector overrides and the ChangesetConfig service
- [Changeset config](./04-changeset-config.md) — reading and decoding `.changeset/config.json`
- [ConfigDiscovery](./05-config-discovery.md) — priority-based config file search
- [BiomeSchemaSync](./06-biome-sync.md) — keeping Biome `$schema` URLs current

## Services by platform layer

Services are grouped by what platform dependencies they require. This determines which layers you need to provide when running your Effect programs.

### No platform layer required

These services are pure — no filesystem or command execution needed.

| Service | Doc | What it does |
| ------- | --- | ------------ |
| [SilkPublishability](./03-publishability.md) | Publishability | Apply silk rules to a raw `package.json` and resolve its publish targets (`detect` is a pure static) |

### FileSystem layer required

These services read or write files. Provide `NodeServices.layer` (or the platform layer for your runtime) to satisfy the `FileSystem` dependency.

| Service | Doc | What it does |
| ------- | --- | ------------ |
| [SilkPublishability.layer / SilkPublishability.layerAdaptive](./03-publishability.md) | Publishability | Override `@effected/workspaces`'s `PublishabilityDetector` Tag with silk rules (the adaptive layer is changeset-ignore-aware) |
| [ChangesetConfig](./04-changeset-config.md) | Changeset config | Typed accessor over `.changeset/config.json`: mode, ignore patterns, fixed groups |
| [ChangesetConfigReader](./04-changeset-config.md) | Changeset config | Read and decode `.changeset/config.json` with Silk auto-detection |
| [ConfigDiscovery](./05-config-discovery.md) | Config files | Locate config files with priority-based search (`lib/configs/` then root) |
| [BiomeSchemaSync](./06-biome-sync.md) | Biome schemas | Keep `$schema` URLs in Biome config files in sync with the installed version |

### FileSystem + process layer required

These services spawn a child process in addition to reading files.

| Service | Doc | What it does |
| ------- | --- | ------------ |
| `Turbo.TurboInspector` | [README](../README.md#turboinspector) | Inspect a Turborepo over `turbo --dry`: cache diagnosis, task graph, affected packages |

### Platform layers guide

For detailed guidance on composing layers and providing platform dependencies, see [Platform layers](./02-platform-layers.md).

## Usage pattern

Most services follow the same Effect pattern:

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ServiceName } from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const service = yield* ServiceName;
    return yield* service.method(args);
  }).pipe(
    Effect.provide(ServiceName.layer),
    Effect.provide(NodeServices.layer), // only for services that touch the filesystem or spawn processes
  ),
);
```

`SilkPublishability.detect` is the exception: it is a pure static, so you call it directly without a layer or the Effect runtime.

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect("@my-org/pkg", rawPackageJson, null);
// => ReadonlyArray<PublishTarget>
```
