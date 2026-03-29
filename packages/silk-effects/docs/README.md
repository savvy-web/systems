# @savvy-web/silk-effects Documentation

Shared [Effect](https://effect.website/) library providing Silk Suite conventions
consumed across the ecosystem. Platform-agnostic -- consumers provide their own
runtime layer (`NodeContext`, `BunContext`, etc.).

## Purpose

Silk Suite repos independently implemented the same patterns for publishability
detection, versioning strategy, tag formatting, managed sections, config discovery,
and Biome schema synchronization. This library extracts those patterns into a
single shared package so behavior stays consistent and changes propagate everywhere.

## Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

`effect` is a peer dependency -- install it alongside the package.

## Modules

| Module | What It Does | Platform Layer Required |
| ------ | ------------ | ---------------------- |
| [Publish](./publish.md) | Resolve multi-registry publish targets from shorthands, URLs, or objects. Detect whether a package is publishable under Silk conventions. | No |
| [Versioning](./versioning.md) | Read changeset config (standard and Silk-extended). Detect versioning strategy: single, fixed-group, or independent. | Yes |
| [Tags](./tags.md) | Determine git tag format (single `1.2.3` vs scoped `@scope/pkg@1.2.3`) based on versioning strategy. | No |
| [Hooks](./hooks.md) | Read, write, and update tool-managed sections in user-editable files using BEGIN/END markers. | Yes |
| [Config](./config.md) | Discover config files following the Silk convention where `lib/configs/` takes priority over repo root. | Yes |
| [Biome](./biome.md) | Keep Biome `$schema` URLs in sync with the installed version across all config files. | Yes |

## Usage Pattern

All services follow the same Effect pattern:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ServiceName, ServiceNameLive } from "@savvy-web/silk-effects/module";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const service = yield* ServiceName;
    return yield* service.method(args);
  }).pipe(
    Effect.provide(ServiceNameLive),
    Effect.provide(NodeContext.layer), // only needed for FileSystem-dependent modules
  ),
);
```

Modules marked "No" for platform layer can omit the `NodeContext.layer` provider.

## Architecture

For implementation details, service patterns, and dependency graph, see the
[architecture design doc](../../.claude/design/silk-effects/architecture.md).
