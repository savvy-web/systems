# ToolDiscovery

Locates CLI tools globally or locally, extracts versions, enforces constraints,
and caches results.

**Platform layer:** FileSystem + CommandExecutor (requires `PackageManagerDetector`
and `WorkspaceRoot` from `workspaces-effect`)

**Since:** 0.2.0

## What It Does

Build tools, linters, and formatters may be installed globally, locally via a
package manager, or both. `ToolDiscovery` resolves a tool by checking both
locations, extracting version information, enforcing source and version
constraints, and caching the result. The resolved tool provides `exec()` and
`dlx()` methods to build commands that use the correct invocation path.

## Table of Contents

- [Service API](#service-api)
- [Layer](#layer)
- [Configuration Value Objects](#configuration-value-objects)
- [Result Value Objects](#result-value-objects)
- [ToolCommand Utility](#toolcommand-utility)
- [Tagged Enums](#tagged-enums)
- [Error Types](#error-types)
- [Usage](#usage)
- [Dependencies on Other Services](#dependencies-on-other-services)

## Service API

```typescript
class ToolDiscovery extends Context.Tag("@savvy-web/silk-effects/ToolDiscovery")<
  ToolDiscovery,
  {
    readonly resolve: (
      definition: ToolDefinition,
    ) => Effect.Effect<ResolvedTool, ToolResolutionError>;

    readonly require: {
      (definition: ToolDefinition): Effect.Effect<ResolvedTool, ToolNotFoundError>;
      (definition: ToolDefinition, message: string): Effect.Effect<ResolvedTool, ToolNotFoundError>;
    };

    readonly isAvailable: (
      definition: ToolDefinition,
    ) => Effect.Effect<boolean>;

    readonly clearCache: Effect.Effect<void>;
  }
>() {}
```

### `resolve(definition)`

Resolve a tool definition to a `ResolvedTool`, enforcing source requirements
and resolution policies. Results are cached by tool name.

- **definition** -- A `ToolDefinition` describing the tool to find.
- **Returns** -- `Effect<ResolvedTool, ToolResolutionError>`

Resolution steps:

1. Check the internal cache for a previous result.
2. Detect workspace root and package manager.
3. Check global availability (`command -v`).
4. Extract global version if found (using the `versionExtractor`).
5. Check local availability via package manager exec.
6. Extract local version if found.
7. Enforce `SourceRequirement` constraints.
8. Apply `ResolutionPolicy` for version mismatches.
9. Cache and return the `ResolvedTool`.

### `require(definition, message?)`

Like `resolve` but maps failures to `ToolNotFoundError`. Accepts an optional
custom error message.

- **Returns** -- `Effect<ResolvedTool, ToolNotFoundError>`

### `isAvailable(definition)`

Quick availability check. Returns `true` if the tool can be found either
globally or locally. Does not cache the result.

- **Returns** -- `Effect<boolean>`. Always succeeds.

### `clearCache`

Clear the internal resolution cache so subsequent calls re-run discovery.

- **Returns** -- `Effect<void>`

## Layer

```typescript
export const ToolDiscoveryLive: Layer.Layer<
  ToolDiscovery,
  never,
  CommandExecutor.CommandExecutor | PackageManagerDetector | WorkspaceRoot
>;
```

Requires:

- `CommandExecutor` from `@effect/platform` -- for running shell commands
- `PackageManagerDetector` from `workspaces-effect` -- to detect npm/pnpm/yarn/bun
- `WorkspaceRoot` from `workspaces-effect` -- to find the workspace root

All three are provided by `NodeContext.layer` combined with
`workspaces-effect`'s default layers.

## Configuration Value Objects

### ToolDefinition

Declares a CLI tool's identity and resolution constraints.

```typescript
class ToolDefinition implements Equal.Equal {
  readonly _tag: "ToolDefinition";
  readonly name: string;
  readonly versionExtractor: VersionExtractor;
  readonly policy: ResolutionPolicy;
  readonly source: SourceRequirement;

  static make(options: {
    readonly name: string;
    readonly versionExtractor?: VersionExtractor;
    readonly policy?: ResolutionPolicy;
    readonly source?: SourceRequirement;
  }): ToolDefinition;
}
```

**Equality:** Compares on `name` only.

**Defaults:**

| Field | Default |
| ----- | ------- |
| `versionExtractor` | `VersionExtractor.Flag({ flag: "--version" })` |
| `policy` | `ResolutionPolicy.Report()` |
| `source` | `SourceRequirement.Any()` |

**Examples:**

```typescript
// Simple: tool named "biome" with all defaults
const biome = ToolDefinition.make({ name: "biome" });

// Custom: require local-only, prefer local on mismatch
const tsc = ToolDefinition.make({
  name: "tsc",
  source: SourceRequirement.OnlyLocal(),
  policy: ResolutionPolicy.PreferLocal(),
});

// JSON version extraction
const node = ToolDefinition.make({
  name: "node",
  versionExtractor: VersionExtractor.Json({
    flag: "--version",
    path: "version",
  }),
});

// No version extraction
const tool = ToolDefinition.make({
  name: "my-tool",
  versionExtractor: VersionExtractor.None(),
});
```

## Result Value Objects

### ResolvedTool

Result of resolving a `ToolDefinition`. Provides methods to build commands.

```typescript
class ResolvedTool extends Schema.TaggedClass<ResolvedTool>()("ResolvedTool", {
  name: Schema.String,
  source: ToolSource,                          // "global" | "local"
  version: Schema.OptionFromSelf(Schema.String),
  globalVersion: Schema.OptionFromSelf(Schema.String),
  localVersion: Schema.OptionFromSelf(Schema.String),
  packageManager: PackageManager,              // "npm" | "pnpm" | "yarn" | "bun"
  mismatch: Schema.Boolean,
}) {}
```

**Equality:** Compares on `name` + `source` + `version`.

**Instance properties:**

| Property | Type | Description |
| -------- | ---- | ----------- |
| `isGlobal` | `boolean` | Whether the resolved source is `"global"` |
| `isLocal` | `boolean` | Whether the resolved source is `"local"` |
| `hasVersionMismatch` | `boolean` | Whether global and local versions differ |

**Instance methods:**

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `exec(...args)` | `(...args: string[]) => ToolCommand` | Build a command to run the tool. Uses global path or PM exec depending on `source`. |
| `dlx(...args)` | `(...args: string[]) => ToolCommand` | Build a command to run via PM dlx/npx (always uses package manager). |

**Package manager command mapping for `exec` (local source):**

| PM | Command |
| -- | ------- |
| pnpm | `pnpm exec {name} {args}` |
| npm | `npx --no -- {name} {args}` |
| yarn | `yarn exec {name} {args}` |
| bun | `bun x --no-install {name} {args}` |

**Package manager command mapping for `dlx`:**

| PM | Command |
| -- | ------- |
| pnpm | `pnpm dlx {name} {args}` |
| npm | `npx {name} {args}` |
| yarn | `yarn dlx {name} {args}` |
| bun | `bun x {name} {args}` |

## ToolCommand Utility

Thin wrapper around `@effect/platform` `Command.Command` providing instance
method ergonomics.

```typescript
class ToolCommand {
  readonly command: Command.Command;

  string(encoding?: string): Effect<string, PlatformError, CommandExecutor>;
  exitCode(): Effect<number, PlatformError, CommandExecutor>;
  lines(encoding?: string): Effect<string[], PlatformError, CommandExecutor>;
  stream(): Stream<Uint8Array, PlatformError, CommandExecutor>;
  env(environment: Record<string, string | undefined>): ToolCommand;
  workingDirectory(cwd: string): ToolCommand;
  stdin(input: string): ToolCommand;
}
```

Returned by `ResolvedTool.exec()` and `ResolvedTool.dlx()`. Use `yield*` to
execute within an Effect pipeline:

```typescript
const tool = yield* td.resolve(ToolDefinition.make({ name: "biome" }));
const output = yield* tool.exec("check", ".").string();
```

## Tagged Enums

### VersionExtractor

How to extract a version string from a CLI tool's output.

```typescript
type VersionExtractor = Data.TaggedEnum<{
  Flag: { flag: string; parse?: (output: string) => string };
  Json: { flag: string; path: string };
  None: {};
}>;
```

| Variant | Description |
| ------- | ----------- |
| `Flag({ flag, parse? })` | Run `{tool} {flag}` and use stdout. Optional `parse` function to extract version from output. Default flag: `"--version"`. |
| `Json({ flag, path })` | Run `{tool} {flag}`, parse stdout as JSON, extract version at dot-separated `path`. |
| `None()` | Do not extract a version. Only check existence. |

### ResolutionPolicy

What to do when both global and local versions differ.

```typescript
type ResolutionPolicy = Data.TaggedEnum<{
  Report: {};
  PreferLocal: {};
  PreferGlobal: {};
  RequireMatch: {};
}>;
```

| Variant | Behavior |
| ------- | -------- |
| `Report()` | Use local, report mismatch via `mismatch: true` (default) |
| `PreferLocal()` | Use local version |
| `PreferGlobal()` | Use global version |
| `RequireMatch()` | Fail with `ToolResolutionError` if versions differ |

### SourceRequirement

Where the tool must be found.

```typescript
type SourceRequirement = Data.TaggedEnum<{
  Any: {};
  OnlyLocal: {};
  OnlyGlobal: {};
  Both: {};
}>;
```

| Variant | Behavior |
| ------- | -------- |
| `Any()` | Found anywhere is fine (default) |
| `OnlyLocal()` | Must be installed locally via package manager |
| `OnlyGlobal()` | Must be on PATH |
| `Both()` | Must be found in both locations |

## Error Types

### ToolResolutionError

Raised when a tool cannot be resolved (not found, wrong source, version mismatch
with `RequireMatch`).

```typescript
class ToolResolutionError extends Data.TaggedError("ToolResolutionError")<{
  readonly name: string;
  readonly reason: string;
}> {}
```

### ToolNotFoundError

Raised by `require()` when resolution fails. Same shape as `ToolResolutionError`
but distinct tag for error handling.

```typescript
class ToolNotFoundError extends Data.TaggedError("ToolNotFoundError")<{
  readonly name: string;
  readonly reason: string;
}> {}
```

### ToolVersionMismatchError

Available for consumers that need to signal a version mismatch explicitly.

```typescript
class ToolVersionMismatchError extends Data.TaggedError("ToolVersionMismatchError")<{
  readonly name: string;
  readonly globalVersion: string;
  readonly localVersion: string;
}> {}
```

## Usage

### Basic tool resolution

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;

  const biome = yield* td.resolve(ToolDefinition.make({ name: "biome" }));
  console.log(`biome ${biome.source} v${biome.version}`);

  // Run the tool
  const output = yield* biome.exec("check", ".").string();
  console.log(output);
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(ToolDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

### Require a tool (fail if not found)

```typescript
const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;

  const biome = yield* td.require(
    ToolDefinition.make({ name: "biome" }),
    "biome is required for linting",
  );

  return yield* biome.exec("check", "--write", ".").exitCode();
});
```

### Check availability without resolving

```typescript
const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;

  const hasBiome = yield* td.isAvailable(ToolDefinition.make({ name: "biome" }));
  if (hasBiome) {
    // proceed with biome
  }
});
```

### Use dlx for one-off execution

```typescript
const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;

  const tool = yield* td.resolve(ToolDefinition.make({ name: "create-turbo" }));
  const output = yield* tool.dlx("my-app").string();
  console.log(output);
});
```

### Custom environment and working directory

```typescript
const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;
  const tool = yield* td.resolve(ToolDefinition.make({ name: "biome" }));

  const output = yield* tool
    .exec("check", ".")
    .env({ BIOME_LOG_LEVEL: "debug" })
    .workingDirectory("/path/to/project")
    .string();
});
```

## Caching

Results are cached by tool name using an internal `Ref<Map<string, ResolvedTool>>`.
Subsequent calls to `resolve` with the same tool name return the cached result
without re-running discovery. Call `clearCache` to force re-resolution:

```typescript
yield* td.clearCache;
const fresh = yield* td.resolve(ToolDefinition.make({ name: "biome" }));
```

`isAvailable` does not use or populate the cache.

## Dependencies on Other Services

- **CommandExecutor** (`@effect/platform`) -- Runs shell commands to check tool
  availability and extract versions.
- **PackageManagerDetector** (`workspaces-effect`) -- Detects which package
  manager (npm, pnpm, yarn, bun) is used in the workspace.
- **WorkspaceRoot** (`workspaces-effect`) -- Finds the workspace root directory
  for local tool resolution.
