# Changeset config

Read, decode and query a workspace root's `.changeset/config.json`.

## What it does

Changesets configuration drives versioning and release behavior. The Silk ecosystem extends the standard changesets config with a `_isSilk` marker when the `changelog` field references `@savvy-web/changesets`. Two services cover this:

- `ChangesetConfigReader` — reads and decodes the config file into a typed schema.
- `ChangesetConfig` — a higher-level accessor over the reader that answers specific questions (mode, ignore patterns, fixed groups) with a per-root cache.

## ChangesetConfigReader

Reads and decodes `.changeset/config.json` with automatic Silk detection.

**Platform layer:** FileSystem

```typescript
class ChangesetConfigReader extends Context.Tag(
  "@savvy-web/silk-effects/ChangesetConfigReader"
)<
  ChangesetConfigReader,
  {
    readonly read: (
      root: string,
    ) => Effect.Effect<ChangesetConfigFile | SilkChangesetConfigFile, ChangesetConfigError>;
  }
>() {}
```

### `read(root)`

Read and decode `.changeset/config.json` from the given workspace root.

- **root** — absolute path to the workspace root containing the `.changeset/` directory.
- **Returns** — `Effect<ChangesetConfigFile | SilkChangesetConfigFile, ChangesetConfigError>`

The service reads `{root}/.changeset/config.json`, parses it as JSON, then checks whether the `changelog` field references `@savvy-web/changesets`:

- If the changelog field is `"@savvy-web/changesets"` or `["@savvy-web/changesets", { ... }]`, the config is decoded as `SilkChangesetConfigFile` with `_isSilk: true`.
- Otherwise, it is decoded as the standard `ChangesetConfigFile`.

```typescript
export const ChangesetConfigReaderLive: Layer.Layer<
  ChangesetConfigReader,
  never,
  FileSystem.FileSystem
>;
```

Requires `FileSystem` from `@effect/platform`.

### Usage

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ChangesetConfigReader,
  ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const reader = yield* ChangesetConfigReader;
  const config = yield* reader.read(process.cwd());

  if ("_isSilk" in config && config._isSilk) {
    return "silk";
  }
  return "vanilla";
});

const kind = await Effect.runPromise(
  program.pipe(
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => "silk" | "vanilla"
```

## ChangesetConfig

Accessor service over a workspace root's `.changeset/config.json`, reading through `ChangesetConfigReader` with a per-root cache. Every accessor is total — a missing or unreadable config collapses to `mode: "none"` and empty/false defaults, so accessors never fail.

**Platform layer:** FileSystem (via `ChangesetConfigReader`)

```typescript
class ChangesetConfig extends Context.Tag(
  "@savvy-web/silk-effects/ChangesetConfig"
)<
  ChangesetConfig,
  {
    readonly mode: (root: string) => Effect.Effect<ChangesetMode>;
    readonly versionPrivate: (root: string) => Effect.Effect<boolean>;
    readonly ignorePatterns: (root: string) => Effect.Effect<ReadonlyArray<string>>;
    readonly isIgnored: (name: string, root: string) => Effect.Effect<boolean>;
    readonly fixed: (root: string) => Effect.Effect<ReadonlyArray<ReadonlyArray<string>>>;
  }
>() {
  // exact name match, or @scope/* wildcard
  static matches(name: string, pattern: string): boolean;
}
```

`ChangesetMode` is `"silk" | "vanilla" | "none"`.

### Methods

- **`mode(root)`** — `"silk"` when the config uses the `@savvy-web/changesets` adapter, `"vanilla"` for standard changesets, `"none"` when the config is missing or unreadable.
- **`versionPrivate(root)`** — `true` when `privatePackages.version` is set.
- **`ignorePatterns(root)`** — the raw `ignore` array (empty when absent).
- **`isIgnored(name, root)`** — `true` when `name` matches any `ignore` pattern.
- **`fixed(root)`** — the `fixed` groups (empty when absent).
- **`ChangesetConfig.matches(name, pattern)`** — the static ignore matcher: exact name match, or `@scope/*` wildcard. `"@scope/*"` matches `"@scope/anything"` but not the bare scope `"@scope"`.

### Layer

```typescript
export const ChangesetConfigLive: Layer.Layer<
  ChangesetConfig,
  never,
  ChangesetConfigReader
>;
```

Requires `ChangesetConfigReader` (which requires `FileSystem`). Provide `ChangesetConfigReaderLive` plus a platform layer.

### Usage

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ChangesetConfig, ChangesetConfigLive, ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const config = yield* ChangesetConfig;
  const mode = yield* config.mode(process.cwd());
  const ignored = yield* config.isIgnored("@my-org/internal", process.cwd());
  return { mode, ignored };
});

const result = await Effect.runPromise(
  program.pipe(
    Effect.provide(ChangesetConfigLive),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => { mode: "silk" | "vanilla" | "none", ignored: boolean }
```

`ChangesetConfig` is also the dependency that makes `PublishabilityDetectorAdaptiveLive` ignore-aware. See [Publishability](./publishability.md).

## Related types

### ChangesetConfigFile

Standard changesets configuration matching the `@changesets/types` upstream spec:

```typescript
type ChangesetConfigFile = {
  changelog?: string | unknown[];
  commit?: boolean;
  fixed?: string[][];
  linked?: string[][];
  access?: "public" | "restricted";
  baseBranch?: string;
  updateInternalDependencies?: "patch" | "minor" | "major";
  ignore?: string[];
};
```

### SilkChangesetConfigFile

Extended config with the Silk marker:

```typescript
type SilkChangesetConfigFile = ChangesetConfigFile & {
  _isSilk: boolean; // defaults to true
};
```

You can check for the Silk extension with a type guard:

```typescript
if ("_isSilk" in config && config._isSilk) {
  // Silk-specific behavior
}
```

## Error types

### ChangesetConfigError

Raised by `ChangesetConfigReader.read` when the config file is missing, contains invalid JSON or fails schema validation. `ChangesetConfig` swallows this internally and reports `mode: "none"` instead.

```typescript
class ChangesetConfigError extends Data.TaggedError("ChangesetConfigError")<{
  readonly path: string;
  readonly reason: string;
}> {}
```

## Dependencies on other services

- `ChangesetConfigReader` — `FileSystem` from the platform layer.
- `ChangesetConfig` — `ChangesetConfigReader`.
