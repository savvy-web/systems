---
title: GitHub Action Builder Architecture
status: current
module: github-action-builder
category: architecture
type: architecture
completeness: 95
created: 2026-01-29
updated: 2026-05-30
last-synced: 2026-05-30
related:
  - ../github-action-effects/index.md
dependencies: []
authors:
  - C. Spencer Beggs
tags:
  - architecture
  - github-actions
  - build-tool
  - rsbuild
  - rspack
  - effect-ts
  - node24
---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Service Layer](#service-layer)
4. [Schemas](#schemas)
5. [Smart Defaults](#smart-defaults)
6. [Configuration System](#configuration-system)
7. [Build Pipeline](#build-pipeline)
8. [Validation System](#validation-system)
9. [CLI Design](#cli-design)
10. [API Design](#api-design)
11. [Error Handling](#error-handling)
12. [Rationale](#rationale)
13. [Decisions](#decisions)

---

## Overview

`@savvy-web/github-action-builder` is a build tool for creating **Node.js 24**
GitHub Actions from TypeScript source code. It uses `@rsbuild/core` (rspack-based) to
bundle actions into self-contained ESM JavaScript files that can be committed
to a repository.

**Package:** `@savvy-web/github-action-builder`
**Location:** `packages/github-action-builder` in `savvy-web/systems`

The complementary [`@savvy-web/github-action-effects`](../github-action-effects/index.md) package, co-located at `packages/github-action-effects`, provides the Effect services consumed by the action code this builder bundles. The two are independent packages with no build-time dependency between them.

**Key Features:**

- Zero-config builds with smart defaults
- **Node.js 24 only** - validates `action.yml` requires `runs.using: "node24"`
- TypeScript support with proper compilation
- Effect-TS service architecture for testability and composability
- CLI with `build`, `validate`, and `init` commands
- Programmatic API via `GitHubAction` class
- Validates `action.yml` against GitHub's official schema
- Auto-detects entry points: `src/main.ts` (required), `src/pre.ts`, `src/post.ts`
- Flat output structure: `dist/main.js`, `dist/pre.js`, `dist/post.js`
- Source maps disabled by default for smaller bundles
- Auto-persists build output to `.github/actions/local/` for local testing with
  [nektos/act](https://github.com/nektos/act)

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Consumer Layer                                  │
├──────────────────────┬──────────────────────────────────────────────────┤
│   CLI (@effect/cli)  │   GitHubAction Class                             │
│   - build command    │   - Promise-based wrapper                        │
│   - validate command │   - ManagedRuntime for services                  │
│   - init command     │   - For non-Effect consumers                     │
└──────────────────────┴──────────────────────────────────────────────────┘
                                       │
┌─────────────────────────────────────────────────────────────────────────┐
│                        Service Layer (Effect)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  ConfigService     │ ValidationService │ BuildService │ PersistLocal-  │
│  - load()          │ - validate()      │ - build()    │   Service      │
│  - resolve()       │ - validateActionYml│ - bundle()  │ - persist()    │
│  - detectEntries() │ - formatResult()  │ - clean()    │ - formatResult()│
└─────────────────────────────────────────────────────────────────────────┘
                                       │
┌─────────────────────────────────────────────────────────────────────────┐
│                        Foundation Layer                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Typed Errors        │  Schemas           │  Layers                     │
│  - ConfigError       │  - @effect/schema  │  - AppLayer                 │
│  - ValidationError   │  - Config schemas  │  - ConfigLayer              │
│  - BuildError        │  - ActionYml schema│  - BuildLayer               │
│  - PersistError      │                    │  - PersistLocalLayer         │
└─────────────────────────────────────────────────────────────────────────┘
```

The architecture follows an Effect-first design where:

1. **Services** define interfaces with `Context.Tag`
2. **Layers** provide live implementations
3. **CLI** consumes services directly via Effect
4. **GitHubAction** wraps services with `ManagedRuntime.runPromise`

---

## Service Layer

### ConfigService (`packages/github-action-builder/src/services/config.ts`)

Handles configuration loading and entry point detection.

```typescript
interface ConfigService {
  // Load configuration from file or use defaults
  readonly load: (options?: LoadConfigOptions) => Effect<LoadConfigResult, ConfigError>

  // Resolve partial config input to full Config
  readonly resolve: (input?: Partial<ConfigInput>) => Effect<Config, ConfigError>

  // Detect entry points in the project
  readonly detectEntries: (cwd: string, entries?: {...}) => Effect<DetectEntriesResult, MainEntryMissing>
}
```

**Key behaviors:**

- Searches for `action.config.ts` in working directory
- Auto-detects `src/main.ts` (required), `src/pre.ts`, `src/post.ts` (optional)
- Applies schema defaults for missing configuration

### ValidationService (`packages/github-action-builder/src/services/validation.ts`)

Validates configuration and `action.yml` files.

```typescript
interface ValidationService {
  // Validate config and project structure
  readonly validate: (config: Config, options?: ValidateOptions) => Effect<ValidationResult, ValidationError>

  // Validate action.yml against schema
  readonly validateActionYml: (path: string) => Effect<ActionYmlResult, ValidationError>

  // Check if running in CI environment
  readonly isCI: () => Effect<boolean>

  // Check if strict mode is enabled (auto-detects CI)
  readonly isStrict: (configStrict?: boolean) => Effect<boolean>
}
```

**Key behaviors:**

- Validates `action.yml` requires `runs.using: "node24"` only
- In CI: warnings become errors, build fails
- In development: warnings displayed, build continues

### BuildService (`packages/github-action-builder/src/services/build.ts`)

Bundles TypeScript entry points with `@rsbuild/core` (rspack-based).

```typescript
interface BuildService {
  // Build all entries from configuration
  readonly build: (config: Config, options?: BuildRunnerOptions) => Effect<BuildResult, BuildError>

  // Bundle a single entry point
  readonly bundle: (entry: DetectedEntry, config: Config) => Effect<BundleResult, BuildError>

  // Clean output directory
  readonly clean: (outputDir: string) => Effect<void, BuildError>
}
```

**Key behaviors:**

- Cleans `dist/` directory before building (configurable)
- Bundles each detected entry point
- Writes `dist/package.json` with `{ "type": "module" }`
- Enforces single-file output: `all-in-one` chunk strategy plus `asyncChunks: false` so dynamic imports do not emit separate chunk files
- Injects `__dirname` and `__filename` shims via `tools.rspack.node` so CJS deps that reference these globals work inside the ESM bundle
- Releases rsbuild resources via `buildResult.close()` after each entry

### PersistLocalService (`packages/github-action-builder/src/services/persist-local.ts`)

Copies build output to a local action directory for testing with
[nektos/act](https://github.com/nektos/act).

```typescript
interface PersistLocalService {
  // Persist build output to the local action directory
  readonly persist: (
    config: Config,
    options?: PersistLocalRunnerOptions,
  ) => Effect<PersistLocalResult, PersistLocalError | ActionYmlPathError>

  // Format persist result for display
  readonly formatResult: (result: PersistLocalResult) => string
}
```

**Key behaviors:**

- Smart sync using SHA-256 hash comparison (copies only changed files)
- Removes stale files from destination not present in source
- Validates `action.yml` `runs.main/pre/post` paths resolve in destination
- Generates act boilerplate files (`.actrc`, `.github/workflows/act-test.yml`)
  only if they do not already exist
- No service dependencies (standalone layer)
- Configurable via `persistLocal` config options (`enabled`, `path`,
  `actTemplate`)

**Architecture decision:** PersistLocalService is a standalone service, not
embedded in BuildService. This follows the single-responsibility pattern:
ConfigService loads, ValidationService validates, BuildService bundles,
PersistLocalService persists.

### Layer Composition (`packages/github-action-builder/src/layers/app.ts`)

```typescript
// Individual service layers
export const ConfigLayer = ConfigServiceLive
export const ValidationLayer = ValidationServiceLive.pipe(Layer.provide(ConfigServiceLive))
export const BuildLayer = BuildServiceLive.pipe(Layer.provide(ConfigServiceLive))
export const PersistLocalLayer = PersistLocalServiceLive // No dependencies

// Combined application layer
export const AppLayer = Layer.mergeAll(ConfigServiceLive, ValidationLayer, BuildLayer, PersistLocalLayer)
```

---

## Schemas

All configuration schemas use `@effect/schema` (not Zod).

### Config Schema (`packages/github-action-builder/src/schemas/config.ts`)

```typescript
const EntriesSchema = Schema.Struct({
  main: Schema.optionalWith(Schema.String, { default: () => "src/main.ts" }),
  pre: Schema.optional(Schema.String),
  post: Schema.optional(Schema.String),
})

const BuildOptionsSchema = Schema.Struct({
  minify: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  sourceMap: Schema.optionalWith(Schema.Boolean, { default: () => false }), // Off by default
  externals: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  ignore: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  // target hardcoded to ES2024 internally (Node 24 = V8 12.x)
  // quiet removed (was ncc-specific)
})

const ValidationOptionsSchema = Schema.Struct({
  requireActionYml: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  maxBundleSize: Schema.optional(Schema.String),
  strict: Schema.optional(Schema.Boolean), // Auto-detects from CI
})
```

### PersistLocal Options Schema (`packages/github-action-builder/src/schemas/config.ts`)

```typescript
const PersistLocalOptionsSchema = Schema.Struct({
  enabled: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  path: Schema.optionalWith(Schema.String, { default: () => ".github/actions/local" }),
  actTemplate: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
```

Added to `ConfigSchema` as `persistLocal: PersistLocalOptionsSchema` and
available via `defineConfig({ persistLocal: { ... } })`.

### ActionYml Schema (`packages/github-action-builder/src/schemas/action-yml.ts`)

Validates `action.yml` against GitHub's metadata specification.

```typescript
// Only node24 is supported - this is enforced
const Runs = Schema.Struct({
  using: Schema.Literal("node24"),  // Strictly node24 only
  main: Schema.String,
  pre: Schema.optional(Schema.String),
  "pre-if": Schema.optional(Schema.String),
  post: Schema.optional(Schema.String),
  "post-if": Schema.optional(Schema.String),
})

const ActionYml = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  author: Schema.optional(Schema.String),
  inputs: Schema.optional(Schema.Record({ key: Schema.String, value: ActionInput })),
  outputs: Schema.optional(Schema.Record({ key: Schema.String, value: ActionOutput })),
  runs: Runs,
  branding: Schema.optional(Branding),
})
```

---

## Smart Defaults

The builder works with zero configuration by making smart assumptions:

### Entry Point Detection

| File | Required | Role |
| ---- | -------- | ---- |
| `src/main.ts` | **Yes** | Main action logic |
| `src/pre.ts` | No | Pre-action hook (setup) |
| `src/post.ts` | No | Post-action hook (cleanup) |

The builder automatically detects which optional entry points exist using
`existsSync()` checks in the working directory.

### Output Structure (Flat)

| Input | Output |
| ----- | ------ |
| `src/main.ts` | `dist/main.js` |
| `src/pre.ts` | `dist/pre.js` |
| `src/post.ts` | `dist/post.js` |
| (generated) | `dist/package.json` |

All outputs are self-contained ESM bundles with all dependencies included. Dynamic imports inside action source are folded back into the parent entry file (`asyncChunks: false`), so the output structure is always flat — exactly one `.js` file per detected entry point.

### Build Defaults

| Option | Default | Description |
| ------ | ------- | ----------- |
| `minify` | `true` | Minify output for smaller bundles |
| `sourceMap` | `false` | Source maps disabled by default |
| `externals` | `[]` | Packages excluded from the bundle, expected to be available at runtime |
| `ignore` | `[]` | Packages excluded from the bundle and replaced with a stub that throws if loaded at runtime |

### Persist-Local Defaults

| Option | Default | Description |
| ------ | ------- | ----------- |
| `enabled` | `true` | Auto-persist after build |
| `path` | `".github/actions/local"` | Destination directory |
| `actTemplate` | `true` | Generate `.actrc` and `act-test.yml` if missing |

### Zero-Config Example

```bash
# Project structure:
my-action/
├── src/
│   ├── main.ts    # Required
│   └── post.ts    # Optional, auto-detected
├── action.yml     # Must have runs.using: "node24"
└── package.json

# Just run:
github-action-builder build

# Produces:
my-action/
├── dist/
│   ├── main.js
│   ├── post.js
│   └── package.json  # { "type": "module" }
└── ...
```

---

## Configuration System

### Config File: `action.config.ts`

Optional TypeScript configuration file for customization:

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  // Override entry points (optional - auto-detected by default)
  entries: {
    main: "src/main.ts",      // Required, default: "src/main.ts"
    pre: "src/setup.ts",      // Custom pre script path
    post: "src/cleanup.ts",   // Custom post script path
  },

  // Build options
  build: {
    minify: true,             // Default: true
    sourceMap: false,         // Default: false (disabled for smaller bundles)
    externals: [],            // Packages excluded from bundle, available at runtime (node: always external)
    ignore: [],               // Packages replaced with a throwing stub (takes precedence over externals)
  },

  // Validation rules
  validation: {
    requireActionYml: true,   // Default: true
    maxBundleSize: "5mb",     // Warn if bundle exceeds (optional)
    strict: undefined,        // Auto-detects from CI environment
  },

  // Persist-local options
  persistLocal: {
    enabled: true,            // Default: true
    path: ".github/actions/local", // Default: ".github/actions/local"
    actTemplate: true,        // Default: true (generate act boilerplate)
  },
});
```

### Config Resolution

1. Look for `action.config.ts` in CWD
2. Override path with `-c` / `--config` flag
3. Use smart defaults if no config found

Only `.ts` config files are supported to ensure proper ESM/Node 24 compatibility.

### defineConfig Helper

The `defineConfig()` function provides type-safe configuration with defaults:

```typescript
import { Schema } from "effect";

export function defineConfig(config: Partial<ConfigInput> = {}): Config {
  return Schema.decodeUnknownSync(ConfigSchema)({
    entries: config.entries ?? {},
    build: config.build ?? {},
    validation: config.validation ?? {},
    persistLocal: config.persistLocal ?? {},
  });
}
```

All schemas use `@effect/schema` with `Schema.optionalWith()` for defaults.

---

## Build Pipeline

### Pipeline Stages

```text
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Load    │───▶│ Detect   │───▶│ Validate │───▶│  Build   │───▶│ Persist  │
│  Config  │    │ Entries  │    │          │    │          │    │  Local   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
  ConfigService  ConfigService  ValidationService  BuildService  PersistLocal-
  .load()        .detectEntries()  .validate()     .build()       Service
                                                                  .persist()
```

The persist stage runs automatically after a successful build unless disabled
via `--no-persist` (CLI) or `persistLocal.enabled: false` (config).

### BuildService.build() Flow

1. **Detect entries** via `ConfigService.detectEntries()`
2. **Clean output directory** (`dist/`) if `options.clean` is true (default)
3. **Bundle each entry** sequentially using `createRsbuild()` from `@rsbuild/core`
4. **Rsbuild writes outputs** directly to `dist/{type}.js` (single-file, ESM)
5. **Release rsbuild resources** via `buildResult.close()`
6. **Create `dist/package.json`** with `{ "type": "module" }`
7. **Return BuildResult** with stats for each entry

### Build Result Schema

```typescript
const BuildResultSchema = Schema.Struct({
  success: Schema.Boolean,
  entries: Schema.Array(BundleResultSchema),
  duration: Schema.Number,
  error: Schema.optional(Schema.String),
});

const BundleResultSchema = Schema.Struct({
  success: Schema.Boolean,
  stats: Schema.optional(BundleStatsSchema),
  error: Schema.optional(Schema.String),
});

const BundleStatsSchema = Schema.Struct({
  entry: Schema.String,      // "main", "pre", or "post"
  size: Schema.Number,       // Bundle size in bytes
  duration: Schema.Number,   // Build duration in ms
  outputPath: Schema.String, // "dist/main.js"
});
```

### Rsbuild Bundler Configuration

When `build.ignore` is non-empty, `IGNORE_STUB_SOURCE` (a single `throw` statement) is written to the OS temp dir as a `.mjs` file before rsbuild runs. Each ignored specifier is mapped to that stub via `resolve.alias` using a `$`-suffixed key for exact-match aliasing, so rspack substitutes the stub in place of the real module.

```typescript
// Stub written to tmpdir() when build.ignore is non-empty
const IGNORE_STUB_SOURCE = `throw new Error("A module excluded via the build 'ignore' option was loaded at runtime.");\n`;

// resolve.alias entries added when build.ignore is non-empty:
// { "some-module$": "/tmp/github-action-builder-ignore-stub.mjs" }

const rsbuildConfig = {
  source: { entry: { [entry.type]: entry.path } },
  resolve: { alias: ignoreAlias },  // conditionally populated from build.ignore
  output: {
    target: "node",
    module: true,                   // ESM output (experimental)
    distPath: { root: outputDir },
    filename: { js: "[name].js" },
    // A single function makes the whole externalization decision so it never
    // depends on rspack's array fall-through. Previously, leading the array
    // with a function caused rspack to stop consulting trailing string entries,
    // so user-configured externals were bundled and hard-failed to resolve (#81).
    externals: (data) => {
      const request = data.request;
      if (!request) return false;
      // node: builtins: force CommonJS require() semantics so bundled CJS deps
      // that call __importDefault(require("node:stream")) get real exports, not
      // an ESM namespace. Prevents "instanceof is not callable" (#79).
      if (request.startsWith("node:")) return `node-commonjs ${request}`;
      // User externals: left as runtime imports. ignore takes precedence —
      // a module in both lists is handled by resolve.alias, not externalized.
      if (config.build.externals.includes(request) && !config.build.ignore.includes(request)) return request;
      return false;
    },
    minify: config.build.minify,    // Default: true
    sourceMap: config.build.sourceMap ? { js: "source-map" } : false,
  },
  performance: {
    chunkSplit: { strategy: "all-in-one" },  // Single-file output
  },
  tools: {
    rspack: {
      // CJS deps that reference __dirname / __filename (e.g. @cyclonedx/cyclonedx-library)
      // throw "__dirname is not defined" when bundled into ESM. "node-module" makes rspack
      // derive these globals from import.meta.url.
      node: { __dirname: "node-module", __filename: "node-module" },
      // Prevent dynamic import() calls from emitting separate chunk files.
      // Each action entry must be a single file; asyncChunks: false folds
      // dynamically-imported code back into the parent chunk without affecting tree-shaking.
      output: { asyncChunks: false },
    },
  },
};
```

### Example Build Output

```text
Loading configuration...
  Using default configuration

Validating...
  All checks passed

Building...

Build Summary:
  ✓ main: 89.2 KB (1234ms) → dist/main.js
  ✓ post: 12.5 KB (567ms) → dist/post.js

Total time: 1801ms

Build completed successfully!

Persisting to local action directory...
  ✓ Synced 3 files to .github/actions/local/
  ✓ Skipped 0 unchanged files
  ✓ Generated act template files
```

---

## Validation System

### CI Environment Detection

The validator detects CI environments via environment variables:

- `CI=true` or `CI=1`
- `GITHUB_ACTIONS=true` or `GITHUB_ACTIONS=1`

**Behavior:**

- **Local development**: Validation issues emit warnings, build continues
- **CI environment**: Validation issues throw errors, build fails

This ensures developers get fast feedback locally while maintaining strict
quality gates in CI pipelines.

### action.yml Schema Validation

The `action.yml` file is validated against an `@effect/schema` definition
based on GitHub's official metadata specification.

**Critical constraint:** This tool **only supports Node.js 24 actions**. The
schema requires `runs.using: "node24"` exactly. Other values (`node16`,
`node20`, `composite`, `docker`) will fail validation.

```typescript
const Runs = Schema.Struct({
  using: Schema.Literal("node24"),  // STRICTLY node24 only
  main: Schema.String,
  pre: Schema.optional(Schema.String),
  "pre-if": Schema.optional(Schema.String),
  post: Schema.optional(Schema.String),
  "post-if": Schema.optional(Schema.String),
});
```

This catches issues like:

- Missing required fields (`name`, `description`, `runs`)
- Invalid `runs.using` values (anything other than `node24`)
- Malformed input/output definitions
- Invalid branding options (icon/color)

**Note:** Input/output business logic validation (mutual exclusivity, conditional
requirements, type coercion) is left to the action author's code. The builder
validates structure, not semantics.

### Pre-Build Validation Checks

| Check | Severity | Message |
| ----- | -------- | ------- |
| main.ts exists | Error | `Required entry not found: src/main.ts` |
| action.yml exists | Error | `action.yml not found in project root` |
| action.yml valid YAML | Error | `YAML parse error at line X` |
| action.yml schema valid | Error | Schema validation errors |
| runs.using = node24 | Error | `runs.using must be "node24"` |

### Validation Result Schema

```typescript
const ValidationResultSchema = Schema.Struct({
  valid: Schema.Boolean,
  errors: Schema.Array(ValidationErrorSchema),
  warnings: Schema.Array(ValidationWarningSchema),
});

const ValidationErrorSchema = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  file: Schema.optional(Schema.String),
  suggestion: Schema.optional(Schema.String),
});
```

### ValidationService.validate() Flow

1. **Check entry files exist** - main.ts required, pre/post optional
2. **Load action.yml** - read and parse YAML
3. **Validate against schema** - check structure and node24 requirement
4. **Apply strict mode** - auto-detect from CI or use config override
5. **Return ValidationResult** - with errors, warnings, valid flag

---

## CLI Design

Built with `@effect/cli` for type-safe argument parsing.

### Implementation Files

- `packages/github-action-builder/src/cli/index.ts` - CLI entry point and command composition
- `packages/github-action-builder/src/cli/commands/build.ts` - Build command handler
- `packages/github-action-builder/src/cli/commands/validate.ts` - Validate command handler
- `packages/github-action-builder/src/cli/commands/init.ts` - Init command handler

### Commands

```bash
# Build action
github-action-builder build

# Validate without building
github-action-builder validate

# Initialize config in new project
github-action-builder init
```

### Build Command Options

```bash
github-action-builder build [options]

Options:
  -c, --config <path>   Path to config file (default: action.config.ts)
  -q, --quiet           Suppress non-error output
  --no-validate         Skip validation step
  --no-persist          Skip persisting build output to local action directory
```

### Validate Command Options

```bash
github-action-builder validate [options]

Options:
  -c, --config <path>   Path to config file
  -q, --quiet           Suppress non-error output
```

### Init Command Options

```bash
github-action-builder init [options]

Options:
  -f, --force           Overwrite existing configuration file
```

### CLI Handler Pattern

CLI commands consume services directly via Effect:

```typescript
const buildHandler = ({ config, quiet, noValidate, noPersist }) =>
  Effect.gen(function* () {
    const configService = yield* ConfigService;
    const validationService = yield* ValidationService;
    const buildService = yield* BuildService;
    const persistLocalService = yield* PersistLocalService;

    // Load configuration
    const configResult = yield* configService.load(loadOptions);

    // Validate (unless skipped)
    if (!noValidate) {
      const validationResult = yield* validationService.validate(configResult.config, { cwd });
      if (!validationResult.valid) {
        yield* Effect.fail(new Error("Validation failed"));
      }
    }

    // Build
    const buildResult = yield* buildService.build(configResult.config, { cwd });

    // Persist locally (unless skipped)
    if (!noPersist && configResult.config.persistLocal.enabled) {
      const persistResult = yield* persistLocalService.persist(configResult.config, { cwd });
      // ...
    }
  });
```

---

## API Design

### Programmatic Usage

The `GitHubAction` class provides a Promise-based API wrapping Effect services:

```typescript
import { GitHubAction } from "@savvy-web/github-action-builder";

// Zero-config: auto-detects entries
const action = GitHubAction.create();
const result = await action.build();

if (result.success) {
  console.log(`Built ${result.build?.entries.length} entry points`);
} else {
  console.error(`Build failed: ${result.error}`);
}
```

### GitHubAction Options

```typescript
interface GitHubActionOptions {
  // Configuration object or path to config file
  config?: Partial<ConfigInput> | string;

  // Working directory (default: process.cwd())
  cwd?: string;

  // Skip validation before building (default: false)
  skipValidation?: boolean;

  // Clean output directory before building (default: true)
  clean?: boolean;

  // Custom Effect Layer (advanced)
  layer?: Layer<ConfigService | ValidationService | BuildService | PersistLocalService>;
}
```

### GitHubAction Class

```typescript
class GitHubAction {
  // Factory method
  static create(options?: GitHubActionOptions): GitHubAction;

  // Load and cache configuration
  async loadConfig(): Promise<Config>;

  // Validate without building
  async validate(options?: ValidateOptions): Promise<ValidationResult>;

  // Full build workflow
  async build(): Promise<GitHubActionBuildResult>;

  // Cleanup resources
  async dispose(): Promise<void>;
}
```

### GitHubActionBuildResult

```typescript
const GitHubActionBuildResultSchema = Schema.Struct({
  success: Schema.Boolean,
  build: Schema.optional(BuildResultSchema),
  validation: Schema.optional(ValidationResultSchema),
  persistLocal: Schema.optional(PersistLocalResultSchema),
  error: Schema.optional(Schema.String),
});
```

### Internal Architecture

The `GitHubAction` class uses `ManagedRuntime` to execute Effects:

```typescript
class GitHubAction {
  private readonly runtime: ManagedRuntime<
    ConfigService | ValidationService | BuildService | PersistLocalService,
    never
  >;

  private constructor(options: GitHubActionOptions = {}) {
    const layer = options.layer ?? AppLayer;
    this.runtime = ManagedRuntime.make(layer);
    // ...
  }

  async build(): Promise<GitHubActionBuildResult> {
    // Build, then persist locally if enabled
    const program = Effect.gen(function* () {
      const buildService = yield* BuildService;
      const buildResult = yield* buildService.build(config, buildOptions);

      // Persist locally if enabled
      if (config.persistLocal.enabled) {
        const persistLocalService = yield* PersistLocalService;
        const persistResult = yield* persistLocalService.persist(config, { cwd });
        return { buildResult, persistResult };
      }
      return { buildResult };
    });
    return this.runtime.runPromise(program);
  }
}
```

### Public Exports (`packages/github-action-builder/src/index.ts`)

```typescript
// Primary API
export { GitHubAction } from "./github-action.js";
export type { GitHubActionOptions, GitHubActionBuildResult } from "./github-action.js";

// Configuration
export { defineConfig } from "./schemas/config.js";
export type { Config, ConfigInput, BuildOptions, Entries } from "./schemas/config.js";

// Services (for Effect consumers)
export { ConfigService, ValidationService, BuildService } from "./services/...";
export { PersistLocalService } from "./services/persist-local.js";
export { AppLayer, ConfigLayer, ValidationLayer, BuildLayer, PersistLocalLayer } from "./layers/app.js";

// Persist-local types
export type { PersistLocalResult, PersistLocalRunnerOptions, PersistLocalOptions } from "./services/...";
export { PersistLocalResultSchema, PersistLocalRunnerOptionsSchema, PersistLocalOptionsSchema } from "./...";

// Errors
export type { ConfigError, ValidationError, BuildError, PersistError, AppError } from "./errors.js";
export { ConfigNotFound, ConfigInvalid, MainEntryMissing, ... } from "./errors.js";
export { PersistLocalError, ActionYmlPathError } from "./errors.js";

// Schemas (for extending)
export { ConfigSchema, EntriesSchema, BuildOptionsSchema, ... } from "./schemas/config.js";
```

### Effect Consumer Usage

Effect consumers can use services directly:

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

---

## Error Handling

All errors use Effect's `Data.TaggedError` pattern for type-safe error handling
with pattern matching support.

### Error Categories (`packages/github-action-builder/src/errors.ts`)

**Config Errors:**

```typescript
type ConfigError = ConfigNotFound | ConfigInvalid | ConfigLoadFailed;

class ConfigNotFound extends Data.TaggedError("ConfigNotFound")<{
  readonly path: string;
  readonly message?: string;
}> {}
```

**Validation Errors:**

```typescript
type ValidationError =
  | MainEntryMissing
  | EntryFileMissing
  | ActionYmlMissing
  | ActionYmlSyntaxError
  | ActionYmlSchemaError
  | ValidationFailed;
```

**Build Errors:**

```typescript
type BuildError = BundleFailed | WriteError | CleanError | BuildFailed;
```

**Persist Errors:**

```typescript
type PersistError = PersistLocalError | ActionYmlPathError;

class PersistLocalError extends Data.TaggedError("PersistLocalError")<{
  readonly path: string;
  readonly cause: string;
}> {}

class ActionYmlPathError extends Data.TaggedError("ActionYmlPathError")<{
  readonly entryType: string;
  readonly specifiedPath: string;
  readonly expectedPath: string;
}> {}
```

### Error Handling Pattern

```typescript
import { Effect } from "effect";

Effect.gen(function* () {
  // ...
}).pipe(
  Effect.catchTags({
    ConfigNotFound: (e) => Console.error(`Config not found: ${e.path}`),
    MainEntryMissing: (e) => Console.error(`Missing main entry: ${e.expectedPath}`),
    BundleFailed: (e) => Console.error(`Bundle failed: ${e.cause}`),
  })
);
```

### Error Data

Each error carries contextual data:

| Error | Data Fields |
| ----- | ----------- |
| `ConfigNotFound` | `path`, `message?` |
| `ConfigInvalid` | `path`, `errors[]` |
| `MainEntryMissing` | `expectedPath`, `cwd` |
| `ActionYmlSyntaxError` | `path`, `message`, `line?`, `column?` |
| `ActionYmlSchemaError` | `path`, `errors[]` |
| `BundleFailed` | `entry`, `cause` |
| `WriteError` | `path`, `cause` |
| `PersistLocalError` | `path`, `cause` |
| `ActionYmlPathError` | `entryType`, `specifiedPath`, `expectedPath` |

---

## Rationale

### Why `@rsbuild/core`?

- Clean ESM output without `eval("require")` hacks (ncc's webpack 4 runtime broke Node 24's strict ESM format detection)
- Proper CJS-to-ESM interop via rspack: `node:` builtins forced to `node-commonjs` external type so bundled CJS deps receive real CJS exports rather than an ESM namespace (prevents `instanceof` failures); `__dirname`/`__filename` shims via `tools.rspack.node` so CJS deps that reference those globals work inside the ESM bundle
- Tree-shaking via rspack dead code elimination
- Already in the Savvy Web ecosystem (`@savvy-web/rslib-builder` uses rspack)
- Programmatic API: `createRsbuild()` + `.build()` for clean integration
- Replaced `@vercel/ncc` (effectively unmaintained, webpack 4-based) in v0.5.0

### Why Effect-TS?

- Type-safe error handling with `Effect<A, E, R>`
- Service composition via Layers
- Testability through dependency injection
- Resource safety for file operations
- Consistent with modern Effect ecosystem patterns

### Why `@effect/schema` (not Zod)?

- Native Effect integration
- Better error messages with path information
- Works with Effect's error handling
- Supports defaults via `Schema.optionalWith`
- Part of the Effect ecosystem

### Why Node.js 24 only?

- GitHub Actions now supports `node24`
- Modern ESM support
- Better performance
- Simpler configuration (no CJS fallbacks)
- Forces users to stay current

### Why source maps off by default?

- Smaller bundle sizes
- Faster builds
- GitHub Actions don't typically need source maps
- Can be enabled via config when debugging

### Why TypeScript config files only?

- Full IDE support (autocomplete, type checking)
- Node 24 runs ESM natively
- Consistent with modern tooling patterns
- Avoids CJS/ESM configuration complexity

### Why auto-persist for local testing?

- Build output is automatically copied to `.github/actions/local/` for use
  with [nektos/act](https://github.com/nektos/act)
- Smart sync with SHA-256 hashing avoids unnecessary copies
- Act boilerplate files (`.actrc`, `act-test.yml`) are generated only once
- Keeps the tool focused on building while removing friction for local testing
- Can be disabled via `--no-persist` or `persistLocal.enabled: false`

### Why no watch mode?

- GitHub Actions can't be tested in real-time
- Changes require push to test
- Build is fast enough to run manually

---

## Decisions

Resolved questions from initial design:

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| Config file format | `.ts` only | Node 24 ESM, consistent patterns |
| Schema library | `@effect/schema` | Native Effect integration |
| Node version | `node24` only | Modern runtime, simplifies code |
| Source maps | Off by default | Smaller bundles, rarely needed |
| Watch mode | Not included | Can't test actions in real-time |
| Multiple actions | User responsibility | Programmatic API allows this |
| Pre-commit hook | Not included | Leave to users/lint-staged |
| Local action persist | Auto after build | Smart sync to `.github/actions/local/` for `act` |
| Input validation | User responsibility | Business logic varies per action |
| action.yml validation | Effect Schema | Validates structure, enforces node24 |
| CI strictness | Warn local, error CI | Fast dev feedback, strict CI gates |
| Output structure | Flat `dist/` | Simple, no nested directories |
| Service architecture | Effect Services | Testability, composability |
| Bundler | `@rsbuild/core` (rspack) | Clean ESM, replaces ncc which broke Node 24 |
| ES target | ES2024 (hardcoded) | Node 24 = V8 12.x, no config needed |
| Output format | ESM (`output.module: true`) | Node 24 actions use `"type": "module"` |
| Chunk strategy | `all-in-one` | GitHub Actions need single-file per entry |
| `node:` external type | `node-commonjs` via function external | RegExp external with ESM output resolves builtins as ESM namespace; CJS deps doing `__importDefault(require("node:stream"))` then get a non-callable `.default`, breaking `instanceof`. Function external forces `createRequire(import.meta.url)("node:stream")` which returns real CJS exports. |
| Externals array form (#81 regression) | Single function replaces function + string array | Leading an `externals` array with a function caused rspack to stop consulting trailing string entries; user-configured string externals were bundled instead of externalized. A single function that handles all cases (`node:` → `node-commonjs`, user strings → default, everything else → bundle) eliminates the fall-through dependency. |
| `build.ignore` stub mechanism | Throwing `.mjs` stub written to `tmpdir()`, aliased via `resolve.alias` with `$` exact-match suffix | Ignored modules must be removed from the bundle without relying on them being available at runtime (unlike `externals`). A stub that throws gives a clear error message if a module is accidentally loaded. The `$` suffix prevents partial matches (e.g., `foo$` matches `foo` but not `foobar`). `ignore` takes precedence over `externals` — a module in both lists is stubbed. |
| `__dirname` / `__filename` shims | `tools.rspack.node: { __dirname: "node-module", __filename: "node-module" }` | CJS dependencies that reference these module globals (e.g. `@cyclonedx/cyclonedx-library`) throw `"__dirname is not defined"` when bundled into an ESM output. The `"node-module"` option makes rspack inject shims derived from `import.meta.url`, restoring the expected string values without requiring those deps to be externalized. |
| `asyncChunks: false` | Set via `tools.rspack.output.asyncChunks: false` | Dynamic `import()` calls in action source would otherwise emit separate numbered chunk files alongside the entry. A committed GitHub Action must be a single self-contained file per entry so `action.yml` can reference a known path. Disabling async chunks folds all dynamically-imported code back into the parent bundle. Tree-shaking is unaffected. |

---

## File Structure

```text
src/
├── index.ts                 # Public exports (services, layers, API)
├── github-action.ts         # Promise wrapper for non-Effect consumers
├── errors.ts                # Typed error classes (Data.TaggedError)
├── schemas/
│   ├── config.ts            # Config schemas (@effect/schema)
│   ├── config.test.ts       # Config schema tests
│   ├── action-yml.ts        # action.yml schema (node24 only)
│   └── path.ts              # PathLike schema helpers
├── services/
│   ├── config.ts            # ConfigService definition
│   ├── config-live.ts       # ConfigService implementation
│   ├── validation.ts        # ValidationService definition
│   ├── validation-live.ts   # ValidationService implementation
│   ├── build.ts             # BuildService definition
│   ├── build-live.ts        # BuildService implementation (node: externals fix here)
│   ├── persist-local.ts     # PersistLocalService definition
│   ├── persist-local-live.ts # PersistLocalService implementation
│   ├── persist-local.test.ts # PersistLocalService tests
│   └── services.test.ts     # Service tests
├── layers/
│   └── app.ts               # Layer composition (AppLayer)
└── cli/
    ├── index.ts             # CLI entry point
    └── commands/
        ├── index.ts         # Command exports
        ├── build.ts         # Build command handler
        ├── validate.ts      # Validate command handler
        └── init.ts          # Init command handler

__test__/
└── integration/
    ├── cjs-node-interop.int.test.ts   # Regression: builds fixture, asserts isStream=true
    ├── string-externals.int.test.ts   # Regression: builds fixture with externals[], asserts module is external not bundled
    ├── ignore-modules.int.test.ts     # E2E: builds fixture with ignore[], asserts stub throws at load time
    └── fixtures/
        ├── cjs-node-interop/          # Fixture with action.yml, src/main.ts and hand-authored legacy-cjs-dep.cjs
        ├── string-externals/          # Fixture that configures externals to verify array fall-through fix (#81)
        └── ignore-modules/            # Fixture that configures ignore to verify stub aliasing
```

Integration tests (`*.int.test.ts`) are auto-discovered by `@savvy-web/vitest` as a `:int` project. Each builds its fixture via `GitHubAction.create()` with `skipValidation: true` and `persistLocal.enabled: false`, then runs `dist/main.js` with Node to assert runtime behavior. `cjs-node-interop` asserts `isStream=true` (the `node-commonjs` fix); `string-externals` asserts that user-configured externals are not bundled (the #81 regression fix); `ignore-modules` asserts that the stub throws a descriptive error when an ignored module is imported.

---

## Implementation Status

The implementation follows the Effect-first architecture. Key phases completed:

- [x] Phase 1: Foundation - Typed Errors (`packages/github-action-builder/src/errors.ts`)
- [x] Phase 2: Schema Migration (`packages/github-action-builder/src/schemas/*.ts`)
- [x] Phase 3: Service Definitions (`packages/github-action-builder/src/services/*.ts`)
- [x] Phase 4: Service Implementations (`packages/github-action-builder/src/services/*-live.ts`)
- [x] Phase 5: CLI Refactor (`packages/github-action-builder/src/cli/`)
- [x] Phase 6: Public API Wrapper (`packages/github-action-builder/src/github-action.ts`)
- [ ] Phase 7: Testing with Effect (in progress)
