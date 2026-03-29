# Versioning Module

[Back to README](../README.md)

Changeset configuration reading with Silk detection and versioning strategy classification.

```typescript
import {
  ChangesetConfigReader, ChangesetConfigReaderLive,
  VersioningStrategy, VersioningStrategyLive,
} from "@savvy-web/silk-effects/versioning";
```

## Table of Contents

- [Overview](#overview)
- [Services](#services)
- [Strategy Types](#strategy-types)
- [Config Layering](#config-layering)
- [Schemas](#schemas)
- [Errors](#errors)
- [Examples](#examples)

## Overview

The versioning module reads `.changeset/config.json` from a workspace root, decodes it against the upstream `@changesets/types` schema, and detects whether the Silk changelog adapter (`@savvy-web/changesets`) is in use. It then classifies the workspace into one of three versioning strategies based on the number of publishable packages and how they are grouped.

`ChangesetConfigReader` requires a platform layer (FileSystem). `VersioningStrategy` depends on `ChangesetConfigReader` and therefore also requires a platform layer.

## Services

### ChangesetConfigReader

Reads and decodes `.changeset/config.json` for a given workspace root.

```typescript
class ChangesetConfigReader {
  readonly read: (
    root: string,
  ) => Effect.Effect<ChangesetConfig | SilkChangesetConfig, ChangesetConfigError>;
}
```

Automatically detects whether the config uses the Silk changelog adapter and decodes as `SilkChangesetConfig` (with `_isSilk: true`) or the standard `ChangesetConfig`.

**Layer:** `ChangesetConfigReaderLive` -- requires `FileSystem` from `@effect/platform`.

### VersioningStrategy

Classifies the versioning strategy used by a workspace.

```typescript
class VersioningStrategy {
  readonly detect: (
    publishablePackages: ReadonlyArray<string>,
    root: string,
  ) => Effect.Effect<VersioningStrategyResult, VersioningDetectionError>;
}
```

Reads the changesets config to inspect `fixed` groups, then determines the strategy. Falls back to safe defaults when the changeset config is unavailable.

**Layer:** `VersioningStrategyLive` -- requires `ChangesetConfigReaderLive`.

## Strategy Types

| Type | Condition | Tag Style |
| ---- | --------- | --------- |
| `"single"` | 0 or 1 publishable packages | `1.2.3` |
| `"fixed-group"` | All publishable packages in one `fixed` group | `1.2.3` |
| `"independent"` | Multiple packages not in a single fixed group | `@scope/pkg@1.2.3` |

## Config Layering

The module decodes changeset configs at two levels:

**ChangesetConfig** matches the upstream `@changesets/types` spec. All fields are optional:

- `changelog` -- changelog generator package or `[package, options]` tuple
- `commit` -- whether to auto-commit version bumps
- `fixed` -- groups of packages that share a version
- `linked` -- groups of packages with linked version bumps
- `access` -- `"public"` or `"restricted"`
- `baseBranch` -- the base branch for PRs
- `updateInternalDependencies` -- `"patch"`, `"minor"`, or `"major"`
- `ignore` -- packages to exclude from changesets

**SilkChangesetConfig** extends `ChangesetConfig` with `_isSilk: true`. This flag is set automatically when the `changelog` field references `@savvy-web/changesets`.

## Schemas

### VersioningStrategyResult

Output of strategy detection, consumed by the Tags module:

```typescript
type VersioningStrategyResult = {
  type: "single" | "fixed-group" | "independent";
  fixedGroups: string[][];
  publishablePackages: string[];
};
```

### VersioningStrategyType

```typescript
type VersioningStrategyType = "single" | "fixed-group" | "independent";
```

## Errors

### ChangesetConfigError

Raised when `.changeset/config.json` cannot be read or decoded. Contains `path` and `reason`.

```typescript
class ChangesetConfigError extends Data.TaggedError("ChangesetConfigError")<{
  readonly path: string;
  readonly reason: string;
}> {}
```

Common causes: file not found, invalid JSON, schema validation failure.

### VersioningDetectionError

Raised when the versioning strategy cannot be determined. Contains `reason`.

```typescript
class VersioningDetectionError extends Data.TaggedError("VersioningDetectionError")<{
  readonly reason: string;
}> {}
```

## Examples

### Read changeset config

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ChangesetConfigReader, ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects/versioning";

const config = await Effect.runPromise(
  Effect.gen(function* () {
    const reader = yield* ChangesetConfigReader;
    return yield* reader.read("/path/to/workspace");
  }).pipe(
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);

if ("_isSilk" in config && config._isSilk) {
  console.log("Using Silk changelog adapter");
}
```

### Detect versioning strategy

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  VersioningStrategy, VersioningStrategyLive,
  ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects/versioning";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const strategy = yield* VersioningStrategy;
    return yield* strategy.detect(["@my-org/pkg-a", "@my-org/pkg-b"], "/path/to/workspace");
  }).pipe(
    Effect.provide(VersioningStrategyLive),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);

console.log(result.type); // "single" | "fixed-group" | "independent"
```

### Handle missing config gracefully

`VersioningStrategy` falls back to safe defaults when the config file is absent. If you need to handle the error explicitly:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ChangesetConfigReader, ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects/versioning";

const config = await Effect.runPromise(
  Effect.gen(function* () {
    const reader = yield* ChangesetConfigReader;
    return yield* reader.read("/path/to/workspace");
  }).pipe(
    Effect.catchTag("ChangesetConfigError", (err) =>
      Effect.succeed({ fixed: [], linked: [], _fallback: true }),
    ),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
```
