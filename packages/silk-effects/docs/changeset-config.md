# ChangesetConfigReader

Reads and decodes `.changeset/config.json` with automatic Silk detection.

**Platform layer:** FileSystem

**Since:** 0.1.0

## What It Does

Changesets configuration drives versioning and release behavior. The Silk
ecosystem extends the standard changesets config with a `_isSilk` marker when
the `changelog` field references `@savvy-web/changesets`. This service reads
the config file, detects whether it uses the Silk adapter, and decodes it into
the appropriate schema type.

## Service API

```typescript
class ChangesetConfigReader extends Context.Tag(
  "@savvy-web/silk-effects/ChangesetConfigReader"
)<
  ChangesetConfigReader,
  {
    readonly read: (
      root: string,
    ) => Effect.Effect<ChangesetConfig | SilkChangesetConfig, ChangesetConfigError>;
  }
>() {}
```

### `read(root)`

Read and decode `.changeset/config.json` from the given workspace root.

- **root** -- Absolute path to the workspace root containing the `.changeset/` directory.
- **Returns** -- `Effect<ChangesetConfig | SilkChangesetConfig, ChangesetConfigError>`

The service reads `{root}/.changeset/config.json`, parses it as JSON, then
checks whether the `changelog` field references `@savvy-web/changesets`:

- If the changelog field is `"@savvy-web/changesets"` or
  `["@savvy-web/changesets", { ... }]`, the config is decoded as `SilkChangesetConfig`
  with `_isSilk: true`.
- Otherwise, it is decoded as the standard `ChangesetConfig`.

## Layer

```typescript
export const ChangesetConfigReaderLive: Layer.Layer<
  ChangesetConfigReader,
  never,
  FileSystem.FileSystem
>;
```

Requires `FileSystem` from `@effect/platform`.

## Related Types

### ChangesetConfig

Standard changesets configuration matching the `@changesets/types` upstream spec:

```typescript
type ChangesetConfig = {
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

### SilkChangesetConfig

Extended config with the Silk marker:

```typescript
type SilkChangesetConfig = ChangesetConfig & {
  _isSilk: boolean; // defaults to true
};
```

You can check for the Silk extension with a type guard:

```typescript
if ("_isSilk" in config && config._isSilk) {
  // Silk-specific behavior
}
```

## Error Types

### ChangesetConfigError

Raised when the config file is missing, contains invalid JSON, or fails schema
validation.

```typescript
class ChangesetConfigError extends Data.TaggedError("ChangesetConfigError")<{
  readonly path: string;
  readonly reason: string;
}> {}
```

## Usage

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
    console.log("Silk changeset config detected");
  }

  return config;
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

## Dependencies on Other Services

None beyond `FileSystem` from the platform layer.
