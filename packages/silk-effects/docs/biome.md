# Biome Module

[Back to README](../README.md)

Version-aware Biome schema URL synchronization for `biome.json` and `biome.jsonc` files.

```typescript
import { BiomeSchemaSync, BiomeSchemaSyncLive } from "@savvy-web/silk-effects/biome";
```

## Table of Contents

- [Overview](#overview)
- [Service](#service)
- [Semver Extraction](#semver-extraction)
- [Schemas](#schemas)
- [Errors](#errors)
- [Examples](#examples)

## Overview

The biome module keeps the `$schema` URL in Biome config files in sync with a target version. It scans the working directory for `biome.json` and `biome.jsonc`, compares each file's `$schema` field against the expected `biomejs.dev` URL, and optionally updates files in place.

Two modes are available: `sync` writes changes to disk, `check` returns the same result without modifying files.

This module requires a platform layer (FileSystem).

## Service

### BiomeSchemaSync

```typescript
class BiomeSchemaSync {
  readonly sync: (
    version: string,
    options?: { cwd?: string; gitignore?: boolean },
  ) => Effect.Effect<BiomeSyncResult, BiomeSyncError>;

  readonly check: (
    version: string,
    options?: { cwd?: string; gitignore?: boolean },
  ) => Effect.Effect<BiomeSyncResult, BiomeSyncError>;
}
```

**Layer:** `BiomeSchemaSyncLive` -- requires `FileSystem` from `@effect/platform`.

#### sync

Update the `$schema` URL in all located Biome config files to match `version`. Returns a result indicating which files were updated, skipped, or already current.

#### check

Same as `sync` but read-only. Files that would be updated appear in the `updated` array, but no disk writes occur. Useful for CI checks.

## Semver Extraction

The `version` parameter can include range operators or prefixes. The module strips these before building the schema URL:

| Input | Extracted Version | Schema URL |
| ----- | ----------------- | ---------- |
| `"1.9.3"` | `1.9.3` | `https://biomejs.dev/schemas/1.9.3/schema.json` |
| `"^1.9.3"` | `1.9.3` | `https://biomejs.dev/schemas/1.9.3/schema.json` |
| `"~1.9.3"` | `1.9.3` | `https://biomejs.dev/schemas/1.9.3/schema.json` |
| `">=1.9.3"` | `1.9.3` | `https://biomejs.dev/schemas/1.9.3/schema.json` |
| `"v1.9.3"` | `1.9.3` | `https://biomejs.dev/schemas/1.9.3/schema.json` |

## Schemas

### BiomeSyncResult

Result of a sync or check operation:

```typescript
type BiomeSyncResult = {
  updated: string[];   // paths of files that were (or would be) updated
  skipped: string[];   // paths of files with no $schema or non-biomejs.dev URL
  current: string[];   // paths of files already pointing to the expected URL
};
```

### BiomeSyncOptions

```typescript
type BiomeSyncOptions = {
  cwd?: string;        // working directory override (defaults to process.cwd())
  gitignore?: boolean; // reserved for future use (defaults to true)
};
```

## Errors

### BiomeSyncError

Raised when a Biome config file cannot be read, contains invalid JSON, or cannot be written back to disk. Contains `path` and `reason`.

```typescript
class BiomeSyncError extends Data.TaggedError("BiomeSyncError")<{
  readonly path: string;
  readonly reason: string;
}> {}
```

## Examples

### Sync schema URLs

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { BiomeSchemaSync, BiomeSchemaSyncLive } from "@savvy-web/silk-effects/biome";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const syncer = yield* BiomeSchemaSync;
    return yield* syncer.sync("^1.9.3");
  }).pipe(
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  ),
);

console.log(`Updated: ${result.updated.length}`);
console.log(`Already current: ${result.current.length}`);
console.log(`Skipped: ${result.skipped.length}`);
```

### Check without writing (CI mode)

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { BiomeSchemaSync, BiomeSchemaSyncLive } from "@savvy-web/silk-effects/biome";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const syncer = yield* BiomeSchemaSync;
    return yield* syncer.check("1.9.3");
  }).pipe(
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  ),
);

if (result.updated.length > 0) {
  console.error("Biome schema URLs are outdated:");
  for (const path of result.updated) {
    console.error(`  ${path}`);
  }
  process.exit(1);
}
```

### Use a custom working directory

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { BiomeSchemaSync, BiomeSchemaSyncLive } from "@savvy-web/silk-effects/biome";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const syncer = yield* BiomeSchemaSync;
    return yield* syncer.sync("1.9.3", {
      cwd: "/path/to/other/workspace",
    });
  }).pipe(
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  ),
);
```
