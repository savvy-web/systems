# @savvy-web/silk-effects

[![npm version](https://img.shields.io/npm/v/@savvy-web/silk-effects)](https://www.npmjs.com/package/@savvy-web/silk-effects)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Shared [Effect](https://effect.website/) library providing Silk Suite conventions for publishability detection, versioning strategy, tag formatting, managed sections, config discovery, and Biome schema synchronization. Platform-agnostic: consumers provide their own runtime layer (Node.js, Bun, etc.).

## Features

- Resolve publish targets from shorthand strings, URLs, or objects with sensible defaults
- Detect versioning strategy (single, fixed-group, independent) from changeset config
- Format git tags consistently based on workspace structure
- Manage tool-owned sections inside user-editable files without clobbering user content
- Define reusable section identities with typed content factories (`SectionDefinition`)
- Discover and resolve CLI tools globally or locally with version enforcement and caching
- Discover config files using a priority-based search convention
- Keep Biome `$schema` URLs in sync across config files

## Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

`effect` is a peer dependency -- install it alongside the package.

## Quick Start

All exports come from the package root:

```typescript
import { Effect } from "effect";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
```

Services that access the filesystem require a platform layer:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ManagedSection,
  ManagedSectionLive,
  SectionDefinition,
} from "@savvy-web/silk-effects";

const def = SectionDefinition.make({ toolName: "MY-TOOL" });
const block = def.block("\nnpx lint-staged\n");

await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    yield* ms.sync(".husky/pre-commit", block);
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

## Services

| Service | Platform Layer | Description |
| ------- | -------------- | ----------- |
| `TargetResolver` | No | Resolve publish targets from shorthand strings or objects |
| `SilkPublishabilityPlugin` | No | Detect publishable packages from `package.json` |
| `TagStrategy` | No | Determine and format git tags by versioning strategy |
| `VersioningStrategy` | Yes (FileSystem) | Detect versioning strategy from changeset config |
| `ChangesetConfigReader` | Yes (FileSystem) | Read and parse changeset configuration |
| `ManagedSection` | Yes (FileSystem) | Read/write/sync/check tool-owned sections in user files |
| `ConfigDiscovery` | Yes (FileSystem) | Locate config files by priority-based search |
| `BiomeSchemaSync` | Yes (FileSystem) | Keep Biome `$schema` URLs in sync across config files |
| `ToolDiscovery` | Yes (CommandExecutor) | Locate CLI tools globally or locally, with caching |

## Documentation

For service API reference, schemas, error types, and advanced usage, see [docs/](./docs/).

## License

[MIT](./LICENSE)
