# @savvy-web/silk-effects Documentation

Shared [Effect](https://effect.website/) library providing Silk Suite conventions
consumed across the ecosystem. Platform-agnostic -- consumers provide their own
runtime layer (`NodeContext`, `BunContext`, etc.).

## Purpose

Silk Suite repos independently implemented the same patterns for publishability
detection, versioning strategy, tag formatting, managed sections, config discovery,
Biome schema synchronization, and CLI tool discovery. This library extracts those
patterns into a single shared package so behavior stays consistent and changes
propagate everywhere.

## Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

`effect` is a peer dependency -- install it alongside the package.

All exports come from the package root:

```typescript
import {
  TargetResolver,
  TargetResolverLive,
  ManagedSection,
  ManagedSectionLive,
  SectionDefinition,
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";
```

There are no sub-path exports. Everything is imported from `@savvy-web/silk-effects`.

## Services by Platform Layer

Services are grouped by what platform dependencies they require. This determines
which layers you need to provide when running your Effect programs.

### No Platform Layer Required

These services are pure -- no filesystem or command execution needed.

| Service | Doc | What It Does |
| ------- | --- | ------------ |
| [TargetResolver](./target-resolver.md) | Publish targets | Resolve shorthand strings, URLs, and objects into fully-normalized publish target records |
| [SilkPublishabilityPlugin](./publishability.md) | Publishability | Inspect `package.json` to determine if a package is publishable and resolve its targets |
| [TagStrategy](./tag-strategy.md) | Tag formatting | Determine git tag format (`1.2.3` vs `@scope/pkg@1.2.3`) based on versioning strategy |

### FileSystem Layer Required

These services read or write files. Provide `NodeContext.layer` (Node.js) or
`BunContext.layer` (Bun) to satisfy the `FileSystem` dependency.

| Service | Doc | What It Does |
| ------- | --- | ------------ |
| [ChangesetConfigReader](./changeset-config.md) | Changeset config | Read and decode `.changeset/config.json` with Silk auto-detection |
| [VersioningStrategy](./versioning-strategy.md) | Versioning | Classify workspace versioning as single, fixed-group, or independent |
| [ManagedSection](./managed-section.md) | Managed sections | Read, write, sync, and check tool-owned regions in user-editable files |
| [ConfigDiscovery](./config-discovery.md) | Config files | Locate config files with priority-based search (`lib/configs/` then root) |
| [BiomeSchemaSync](./biome-sync.md) | Biome schemas | Keep `$schema` URLs in Biome config files in sync with the installed version |

### FileSystem + CommandExecutor Layer Required

These services execute shell commands in addition to filesystem access.

| Service | Doc | What It Does |
| ------- | --- | ------------ |
| [ToolDiscovery](./tool-discovery.md) | Tool resolution | Locate CLI tools globally or locally, extract versions, enforce constraints, cache results |

### Platform Layers Guide

For detailed guidance on composing layers and providing platform dependencies,
see [Platform Layers](./platform-layers.md).

## Usage Pattern

All services follow the same Effect pattern:

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

Services with no platform layer requirement can omit the `NodeContext.layer` provider.

## Version

Current version: **0.2.0**
