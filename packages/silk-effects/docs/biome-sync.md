# BiomeSchemaSync

Keeps the `$schema` URL in Biome config files in sync with a target version.

**Platform layer:** FileSystem

**Since:** 0.1.0

## What It Does

Biome config files (`biome.json`, `biome.jsonc`) contain a `$schema` field that
points to a version-specific JSON schema on `biomejs.dev`. When the Biome
version changes, these URLs need to be updated across the workspace.
`BiomeSchemaSync` locates all Biome config files, compares their `$schema`
against the expected URL for the target version, and optionally updates them
in place.

## Service API

```typescript
class BiomeSchemaSync extends Context.Tag("@savvy-web/silk-effects/BiomeSchemaSync")<
  BiomeSchemaSync,
  {
    readonly sync: (
      version: string,
      options?: { cwd?: string; gitignore?: boolean },
    ) => Effect.Effect<BiomeSyncResult, BiomeSyncError>;

    readonly check: (
      version: string,
      options?: { cwd?: string; gitignore?: boolean },
    ) => Effect.Effect<BiomeSyncResult, BiomeSyncError>;
  }
>() {}
```

### `sync(version, options?)`

Update the `$schema` URL in all located Biome config files to match `version`.

- **version** -- Target Biome version. Range operators (`^`, `~`, `>=`, `<`, `v`)
  are stripped automatically. For example, `"^1.9.3"` becomes `"1.9.3"`.
- **options.cwd** -- Working directory override (defaults to `process.cwd()`).
- **options.gitignore** -- Reserved for future use (defaults to `true`).
- **Returns** -- `Effect<BiomeSyncResult, BiomeSyncError>`

### `check(version, options?)`

Check whether the `$schema` URL in Biome config files is current, without
writing any changes.

Same parameters and return type as `sync`. Files that would be updated appear
in the `updated` array, but no disk writes occur.

## Layer

```typescript
export const BiomeSchemaSyncLive: Layer.Layer<
  BiomeSchemaSync,
  never,
  FileSystem.FileSystem
>;
```

Requires `FileSystem` from `@effect/platform`.

## Utility Functions

Two utility functions are also exported for use outside the service:

### `extractSemver(version)`

Strip leading semver range operators from a version string.

```typescript
extractSemver("^1.9.3");  // => "1.9.3"
extractSemver("~2.0.0");  // => "2.0.0"
extractSemver(">=1.0.0"); // => "1.0.0"
extractSemver("v1.2.3");  // => "1.2.3"
```

### `buildSchemaUrl(version)`

Build the expected Biome JSON schema URL for a given bare version.

```typescript
buildSchemaUrl("1.9.3");
// => "https://biomejs.dev/schemas/1.9.3/schema.json"
```

## Related Types

### BiomeSyncResult

```typescript
type BiomeSyncResult = {
  updated: string[];   // paths of config files that were (or would be) updated
  skipped: string[];   // paths with no $schema or a non-biomejs.dev URL
  current: string[];   // paths already pointing to the correct schema URL
};
```

### BiomeSyncOptions

```typescript
type BiomeSyncOptions = {
  cwd?: string;
  gitignore?: boolean; // defaults to true, reserved for future use
};
```

## File Detection

The service scans for these files in the working directory:

- `{cwd}/biome.json`
- `{cwd}/biome.jsonc`

For each file found:

1. If `$schema` is missing or not a string --> file is **skipped**.
2. If `$schema` does not contain `biomejs.dev` --> file is **skipped**.
3. If `$schema` matches the expected URL --> file is **current**.
4. If `$schema` has a different version --> file is **updated** (or would be, on `check`).

## Error Types

### BiomeSyncError

Raised when a Biome config file cannot be read, parsed, or written.

```typescript
class BiomeSyncError extends Data.TaggedError("BiomeSyncError")<{
  readonly path: string;
  readonly reason: string;
}> {}
```

## Usage

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  BiomeSchemaSync,
  BiomeSchemaSyncLive,
} from "@savvy-web/silk-effects";

// Sync biome configs to version 1.9.3
const program = Effect.gen(function* () {
  const syncer = yield* BiomeSchemaSync;
  const result = yield* syncer.sync("^1.9.3");

  console.log(`Updated: ${result.updated.length} files`);
  console.log(`Skipped: ${result.skipped.length} files`);
  console.log(`Current: ${result.current.length} files`);
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

```typescript
// Check without writing (dry run)
const program = Effect.gen(function* () {
  const syncer = yield* BiomeSchemaSync;
  const result = yield* syncer.check("1.9.3");

  if (result.updated.length > 0) {
    console.log("These files need updating:", result.updated);
  } else {
    console.log("All biome configs are up to date");
  }
});
```

## Dependencies on Other Services

None beyond `FileSystem` from the platform layer.
