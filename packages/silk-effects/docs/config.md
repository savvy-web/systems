# Config Module

[Back to README](../README.md)

Config file discovery following the Silk convention with priority-ordered search paths.

```typescript
import { ConfigDiscovery, ConfigDiscoveryLive } from "@savvy-web/silk-effects/config";
```

## Table of Contents

- [Overview](#overview)
- [Service](#service)
- [Search Priority](#search-priority)
- [Schemas](#schemas)
- [Examples](#examples)

## Overview

The config module locates named config files within a workspace using a two-level priority system. It checks `lib/configs/` first (for shared configs provided by dependency packages), then the workspace root (for local overrides). Missing files are silently skipped.

This module requires a platform layer (FileSystem).

## Service

### ConfigDiscovery

```typescript
class ConfigDiscovery {
  readonly find: (
    name: string,
    options?: { cwd?: string },
  ) => Effect.Effect<ConfigLocation | null>;

  readonly findAll: (
    name: string,
    options?: { cwd?: string },
  ) => Effect.Effect<ReadonlyArray<ConfigLocation>>;
}
```

**Layer:** `ConfigDiscoveryLive` -- requires `FileSystem` from `@effect/platform`.

#### find

Return the highest-priority config location for the given file name, or `null` when none of the candidate paths exist.

#### findAll

Return all existing config locations ordered from highest to lowest priority.

## Search Priority

When resolving a config file name (e.g., `"biome.json"`), the service checks these paths in order:

| Priority | Path | Source Label |
| -------- | ---- | ------------ |
| 1 (highest) | `{cwd}/lib/configs/{name}` | `"lib"` |
| 2 | `{cwd}/{name}` | `"root"` |

The `cwd` defaults to `process.cwd()` but can be overridden via the `options` parameter.

This convention supports the Silk Suite pattern where shared configs are distributed as part of a dependency package (placed in `lib/configs/`) and can be overridden locally at the workspace root.

## Schemas

### ConfigLocation

The resolved location of a discovered config file:

```typescript
type ConfigLocation = {
  path: string;       // absolute file path
  source: ConfigSource; // how it was discovered
};
```

### ConfigSource

```typescript
type ConfigSource = "lib" | "root" | "cosmiconfig";
```

`"cosmiconfig"` is reserved for future cosmiconfig-based discovery.

## Examples

### Find the highest-priority config

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ConfigDiscovery, ConfigDiscoveryLive } from "@savvy-web/silk-effects/config";

const location = await Effect.runPromise(
  Effect.gen(function* () {
    const discovery = yield* ConfigDiscovery;
    return yield* discovery.find("biome.json");
  }).pipe(
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);

if (location) {
  console.log(`Found at ${location.path} (source: ${location.source})`);
} else {
  console.log("Config not found");
}
```

### Find all matching configs

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ConfigDiscovery, ConfigDiscoveryLive } from "@savvy-web/silk-effects/config";

const locations = await Effect.runPromise(
  Effect.gen(function* () {
    const discovery = yield* ConfigDiscovery;
    return yield* discovery.findAll("tsconfig.json");
  }).pipe(
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);

for (const loc of locations) {
  console.log(`${loc.source}: ${loc.path}`);
}
// Possible output:
// lib: /workspace/lib/configs/tsconfig.json
// root: /workspace/tsconfig.json
```

### Use a custom working directory

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ConfigDiscovery, ConfigDiscoveryLive } from "@savvy-web/silk-effects/config";

const location = await Effect.runPromise(
  Effect.gen(function* () {
    const discovery = yield* ConfigDiscovery;
    return yield* discovery.find("biome.json", {
      cwd: "/path/to/other/workspace",
    });
  }).pipe(
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
```
