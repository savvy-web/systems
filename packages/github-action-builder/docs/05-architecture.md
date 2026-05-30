# Architecture

This guide explains how `@savvy-web/github-action-builder` works internally. Read it if you want to extend the tool or contribute to it.

## Overview

The builder has three layers, built on Effect-TS:

```text
+---------------------------------------------------------------+
|                      Consumer Layer                            |
+-------------------------------+-------------------------------+
|   CLI (@effect/cli)           |   GitHubAction Class          |
|   - build command             |   - Promise-based wrapper     |
|   - validate command          |   - ManagedRuntime            |
|   - init command              |   - For non-Effect consumers  |
+-------------------------------+-------------------------------+
                                |
+---------------------------------------------------------------+
|                    Service Layer (Effect)                      |
+-------------------+-------------------+-----------------------+
|  ConfigService    |  ValidationService|  BuildService         |
|  - load()         |  - validate()     |  - build()            |
|  - resolve()      |  - validateActionYml() |  - bundle()      |
|  - detectEntries()|  - formatResult() |  - clean()            |
+-------------------+-------------------+-----------------------+
                                |
+---------------------------------------------------------------+
|                    Foundation Layer                            |
+-------------------+-------------------+-----------------------+
|  Typed Errors     |  Schemas          |  Layers               |
|  - ConfigError    |  - @effect/schema |  - AppLayer           |
|  - ValidationError|  - Config schemas |  - ConfigLayer        |
|  - BuildError     |  - ActionYml      |  - BuildLayer         |
+-------------------+-------------------+-----------------------+
```

## Why Effect-TS?

Effect-TS earns its place here for a few concrete reasons:

* **Type-safe error handling** - every failure mode shows up in the type signature, so you cannot forget to handle one
* **Dependency injection** - services compose through Layers instead of imports
* **Testability** - swap in a mock service by providing a different Layer
* **Resource safety** - file handles and child processes close even when a build throws
* **Composability** - the build pipeline is a few small Effects chained together

## Service layer

### ConfigService

Loads configuration and finds entry points.

```typescript
interface ConfigService {
  // Load configuration from file or use defaults
  load(options?: LoadConfigOptions): Effect<LoadConfigResult, ConfigError>;

  // Resolve partial config input to full Config
  resolve(input?: Partial<ConfigInput>): Effect<Config, ConfigError>;

  // Detect entry points in the project
  detectEntries(cwd: string, entries?: Entries): Effect<DetectEntriesResult, MainEntryMissing>;
}
```

**Key behaviors:**

* Searches for `action.config.ts` in working directory
* Uses dynamic `import()` to load TypeScript config
* Auto-detects `src/main.ts` (required), `src/pre.ts`, `src/post.ts` (optional)
* Applies schema defaults for missing configuration

### ValidationService

Validates configuration and `action.yml` files.

```typescript
interface ValidationService {
  // Validate config and project structure
  validate(config: Config, options?: ValidateOptions): Effect<ValidationResult, ValidationError>;

  // Validate action.yml against schema
  validateActionYml(path: string): Effect<ActionYmlResult, ValidationError>;

  // Check if running in CI environment
  isCI(): Effect<boolean>;

  // Check if strict mode is enabled (auto-detects CI)
  isStrict(configStrict?: boolean): Effect<boolean>;
}
```

**Key behaviors:**

* Validates `action.yml` requires `runs.using: "node24"` only
* In CI: warnings become errors, build fails
* In development: warnings displayed, build continues

### BuildService

Bundles TypeScript entry points with `@rsbuild/core`, which runs on rspack.

```typescript
interface BuildService {
  // Build all entries from configuration
  build(config: Config, options?: BuildRunnerOptions): Effect<BuildResult, BuildError>;

  // Bundle a single entry point
  bundle(entry: DetectedEntry, config: Config): Effect<BundleResult, BuildError>;

  // Clean output directory
  clean(outputDir: string): Effect<void, BuildError>;

  // Format build result for display
  formatResult(result: BuildResult): string;
}
```

**Key behaviors:**

* Cleans `dist/` before building, unless you turn that off in config
* Bundles each detected entry point with rsbuild (rspack)
* Writes `dist/package.json` with `{ "type": "module" }`
* Emits plain ESM, with no `eval("require")` hacks
* Tree-shakes through rspack and externalizes `node:` builtins
* Produces exactly one `.js` file per entry — dynamic `import()` calls in action source are folded back into the parent bundle (`asyncChunks: false`) so `action.yml` can always reference a predictable path
* Shims `__dirname` and `__filename` inside the ESM bundle so CJS dependencies that reference those globals work without being externalized

## Layer composition

Effect Layers wire the services together:

```typescript
// Individual service layers
export const ConfigLayer = ConfigServiceLive;
export const ValidationLayer = ValidationServiceLive.pipe(
  Layer.provide(ConfigServiceLive)
);
export const BuildLayer = BuildServiceLive.pipe(
  Layer.provide(ConfigServiceLive)
);

// Combined application layer
export const AppLayer = Layer.mergeAll(
  ConfigServiceLive,
  ValidationLayer,
  BuildLayer
);
```

`AppLayer` carries every service the CLI and the programmatic API need.

## Build pipeline

```text
+----------+    +----------+    +----------+    +----------+
|  Load    |--->|  Detect  |--->| Validate |--->|  Build   |
|  Config  |    |  Entries |    |          |    |          |
+----------+    +----------+    +----------+    +----------+
     |               |               |               |
     v               v               v               v
ConfigService   ConfigService  ValidationService  BuildService
  .load()       .detectEntries()  .validate()      .build()
```

### Stage 1: Load configuration

1. Check for `action.config.ts` or use `--config` path
2. Dynamically import the TypeScript config
3. Validate against `ConfigSchema`
4. Apply defaults for missing options

### Stage 2: Detect entry points

1. Check for required `src/main.ts`
2. Check for optional `src/pre.ts` and `src/post.ts`
3. Return list of detected entries

### Stage 3: Validate

1. Verify entry files exist
2. Load and parse `action.yml`
3. Validate against GitHub's schema
4. Check `runs.using` is `node24`
5. Apply strict mode in CI

### Stage 4: Build

1. Clean `dist/` directory
2. Bundle each entry with rsbuild (rspack)
3. Write output files
4. Create `dist/package.json`
5. Report statistics

## Error handling

Every error is a `Data.TaggedError` subclass:

```typescript
// Define error types
class ConfigNotFound extends Data.TaggedError("ConfigNotFound")<{
  readonly path: string;
  readonly message?: string;
}> {}

// Handle errors with pattern matching
Effect.gen(function* () {
  // ...
}).pipe(
  Effect.catchTags({
    ConfigNotFound: (e) => Console.error(`Config not found: ${e.path}`),
    MainEntryMissing: (e) => Console.error(`Missing main: ${e.expectedPath}`),
    BundleFailed: (e) => Console.error(`Bundle failed: ${e.cause}`),
  })
);
```

### Error categories

**Config Errors:**

* `ConfigNotFound` - Configuration file not found
* `ConfigInvalid` - Configuration validation failed
* `ConfigLoadFailed` - Failed to import config file

**Validation Errors:**

* `MainEntryMissing` - Required main.ts not found
* `EntryFileMissing` - Configured entry file not found
* `ActionYmlMissing` - action.yml not found
* `ActionYmlSyntaxError` - Invalid YAML syntax
* `ActionYmlSchemaError` - Schema validation failed
* `ValidationFailed` - Validation failed in strict mode

**Build Errors:**

* `BundleFailed` - rsbuild bundling failed
* `WriteError` - Failed to write output file
* `CleanError` - Failed to clean output directory
* `BuildFailed` - Overall build process failed

## Schema validation

Schemas are defined with `@effect/schema`:

```typescript
const ConfigSchema = Schema.Struct({
  entries: EntriesSchema,
  build: BuildOptionsSchema,
  validation: ValidationOptionsSchema,
});

const ActionYml = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  runs: Schema.Struct({
    using: Schema.Literal("node24"), // Strictly node24 only
    main: Schema.String,
    // ...
  }),
  // ...
});
```

## Programmatic API

### GitHubAction class

If your code does not use Effect, the `GitHubAction` class wraps the services behind plain Promises:

```typescript
class GitHubAction {
  private readonly runtime: ManagedRuntime<...>;

  static create(options?: GitHubActionOptions): GitHubAction;

  async loadConfig(): Promise<Config>;
  async validate(options?: ValidateOptions): Promise<ValidationResult>;
  async build(): Promise<GitHubActionBuildResult>;
  async dispose(): Promise<void>;
}
```

A `ManagedRuntime` runs each Effect and hands back a Promise:

```typescript
async build(): Promise<GitHubActionBuildResult> {
  const program = Effect.gen(function* () {
    const buildService = yield* BuildService;
    return yield* buildService.build(config, buildOptions);
  });
  return this.runtime.runPromise(program);
}
```

### Using services directly

If your code already uses Effect, skip the wrapper and pull the services straight from the context:

```typescript
import { Effect } from "effect";
import { AppLayer, BuildService, ConfigService } from "@savvy-web/github-action-builder";

const program = Effect.gen(function* () {
  const configService = yield* ConfigService;
  const buildService = yield* BuildService;

  const { config } = yield* configService.load();
  const result = yield* buildService.build(config);

  return result;
});

Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
```

### Custom layers

To test against a fake build, pass your own Layer:

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

const mockLayer = Layer.succeed(BuildService, {
  build: () => Effect.succeed({ success: true, entries: [], duration: 0 }),
  // ...
});

const action = GitHubAction.create({
  layer: mockLayer,
});
```

## File structure

```text
src/
+-- index.ts                 # Public exports
+-- github-action.ts         # Promise wrapper for non-Effect consumers
+-- errors.ts                # Typed error classes (Data.TaggedError)
+-- schemas/
|   +-- config.ts            # Config schemas (@effect/schema)
|   +-- action-yml.ts        # action.yml schema (node24 only)
|   +-- path.ts              # PathLike schema helpers
+-- services/
|   +-- config.ts            # ConfigService definition
|   +-- config-live.ts       # ConfigService implementation
|   +-- validation.ts        # ValidationService definition
|   +-- validation-live.ts   # ValidationService implementation
|   +-- build.ts             # BuildService definition
|   +-- build-live.ts        # BuildService implementation
+-- layers/
|   +-- app.ts               # Layer composition (AppLayer)
+-- cli/
    +-- index.ts             # CLI entry point
    +-- commands/
        +-- build.ts         # Build command handler
        +-- validate.ts      # Validate command handler
        +-- init.ts          # Init command handler
```

## Design decisions

| Decision | Rationale |
| --- | --- |
| Node.js 24 only | Modern ESM, latest features, simpler config |
| @rsbuild/core | Rspack-based bundler producing clean ESM with tree-shaking |
| Effect-TS | Type-safe errors, DI, testability |
| @effect/schema | Native Effect integration, better than Zod |
| Source maps off | Smaller bundles, rarely needed |
| TypeScript config only | Full IDE support, ESM native |
| Flat output structure | Simple, no nested directories |
| CI-aware strict mode | Fast dev feedback, strict CI gates |

## Extending the builder

### Adding a new service

1. Define the service interface in `services/`:

```typescript
export interface MyService {
  readonly doSomething: () => Effect<Result, MyError>;
}

export const MyService = Context.GenericTag<MyService>("MyService");
```

1. Create the implementation in `services/*-live.ts`:

```typescript
export const MyServiceLive = Layer.succeed(MyService, {
  doSomething: () => Effect.succeed({ /* ... */ }),
});
```

1. Add to the application layer in `layers/app.ts`:

```typescript
export const AppLayer = Layer.mergeAll(
  ConfigServiceLive,
  ValidationLayer,
  BuildLayer,
  MyServiceLive,
);
```

### Adding a new command

1. Create command in `cli/commands/`:

```typescript
const myHandler = ({ option }: { option: string }) =>
  Effect.gen(function* () {
    const myService = yield* MyService;
    // ...
  });

export const myCommand = Command.make("my-command", { option }, myHandler);
```

1. Add to root command in `cli/index.ts`:

```typescript
const rootCommand = Command.make("github-action-builder").pipe(
  Command.withSubcommands([buildCommand, validateCommand, initCommand, myCommand]),
);
```

## Related documentation

* [Configuration](./02-configuration.md) - Configuration options
* [CLI reference](./04-cli-reference.md) - Command reference
* [Troubleshooting](./06-troubleshooting.md) - Common issues
