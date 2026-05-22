# @savvy-web/silk-effects documentation

Shared [Effect](https://effect.website/) library providing Silk Suite conventions consumed across the ecosystem. Platform-agnostic — consumers provide their own runtime layer (`NodeContext`, `BunContext`, etc.).

## Purpose

Silk Suite repos independently implemented the same patterns for publishability detection, versioning strategy, tag formatting, managed sections, config discovery, Biome schema synchronization and CLI tool discovery. This library extracts those patterns into a single shared package so behavior stays consistent and changes propagate everywhere.

## Install

```bash
npm install @savvy-web/silk-effects effect @effect/platform @effect/platform-node
# or
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

`effect` and `@effect/platform` are peer dependencies — install them alongside the package.

All exports come from the package root:

```typescript
import {
  SilkPublishability,
  ManagedSection,
  ManagedSectionLive,
  SectionDefinition,
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";
```

There are no sub-path exports. Everything is imported from `@savvy-web/silk-effects`.

## Services by platform layer

Services are grouped by what platform dependencies they require. This determines which layers you need to provide when running your Effect programs.

### No platform layer required

These services are pure — no filesystem or command execution needed.

| Service | Doc | What it does |
| ------- | --- | ------------ |
| [SilkPublishability](./publishability.md) | Publishability | Apply silk rules to a raw `package.json` and resolve its publish targets (`detect` is a pure static) |
| [TagStrategy](./tag-strategy.md) | Tag formatting | Determine git tag format (`1.2.3` vs `@scope/pkg@1.2.3`) based on versioning strategy |

### FileSystem layer required

These services read or write files. Provide `NodeContext.layer` (Node.js) or `BunContext.layer` (Bun) to satisfy the `FileSystem` dependency.

| Service | Doc | What it does |
| ------- | --- | ------------ |
| [SilkPublishabilityDetectorLive / PublishabilityDetectorAdaptiveLive](./publishability.md) | Publishability | Override `workspaces-effect`'s `PublishabilityDetector` Tag with silk rules (the adaptive layer is changeset-ignore-aware) |
| [ChangesetConfig](./changeset-config.md) | Changeset config | Typed accessor over `.changeset/config.json`: mode, ignore patterns, fixed groups |
| [ChangesetConfigReader](./changeset-config.md) | Changeset config | Read and decode `.changeset/config.json` with Silk auto-detection |
| [VersioningStrategy](./versioning-strategy.md) | Versioning | Classify workspace versioning as single, fixed-group or independent |
| [ManagedSection](./managed-section.md) | Managed sections | Read, write, sync and check tool-owned regions in user-editable files |
| [ConfigDiscovery](./config-discovery.md) | Config files | Locate config files with priority-based search (`lib/configs/` then root) |
| [BiomeSchemaSync](./biome-sync.md) | Biome schemas | Keep `$schema` URLs in Biome config files in sync with the installed version |

### FileSystem + CommandExecutor layer required

These services execute shell commands in addition to filesystem access.

| Service | Doc | What it does |
| ------- | --- | ------------ |
| [ToolDiscovery](./tool-discovery.md) | Tool resolution | Locate CLI tools globally or locally, extract versions, enforce constraints, cache results |

### Platform layers guide

For detailed guidance on composing layers and providing platform dependencies, see [Platform layers](./platform-layers.md).

## Usage pattern

Most services follow the same Effect pattern:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ServiceName, ServiceNameLive } from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const service = yield* ServiceName;
    return yield* service.method(args);
  }).pipe(
    Effect.provide(ServiceNameLive),
    Effect.provide(NodeContext.layer), // only for FileSystem/CommandExecutor services
  ),
);
```

`SilkPublishability.detect` is the exception: it is a pure static, so you call it directly without a layer or the Effect runtime.

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect("@my-org/pkg", rawPackageJson);
// => ReadonlyArray<PublishTarget>
```
