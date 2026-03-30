# @savvy-web/silk-effects

## 0.2.1

### Bug Fixes

* [`31824c1`](https://github.com/savvy-web/systems/commit/31824c15a013cf5ce13462c4dfc223785f9e893e) Bumps workspaces-effect dependency for parsing issue fix

## 0.2.0

### Features

* [`0da7c1e`](https://github.com/savvy-web/systems/commit/0da7c1e04fa60ad6745d3dbabf9af9a5b68d780d) ### SectionDefinition and SectionBlock value objects

Introduces `SectionDefinition` and `ShellSectionDefinition` as `Schema.TaggedClass` value objects that declare the identity of a managed section type. `SectionDefinition` compares on `toolName` + `commentStyle` via `Equal`/`Hash`. `ShellSectionDefinition` is a convenience subtype that hardcodes `commentStyle` to `"#"`.

`SectionBlock` is the complementary value object holding the content between a pair of managed section markers. Equality is normalized (trimmed, whitespace-collapsed), so cosmetic whitespace differences do not produce spurious diffs.

Both classes expose a dual API (`Fn.dual`) so methods can be used data-first or data-last in a pipeline:

```typescript
import { SectionDefinition, SectionBlock } from "@savvy-web/silk-effects";

const def = new SectionDefinition({ toolName: "silk", commentStyle: "#" });

// Data-first
const block = def.block("\nexport FOO=bar\n");

// Dual static — data-last for pipe composition
const withValidation = SectionDefinition.withValidation((block) =>
  block.content.includes("FOO"),
)(def);
```

### SectionDiff, SyncResult, and CheckResult tagged enums

Three `Data.TaggedEnum` types capture the outcomes of section operations:

* `SectionDiff` — `Unchanged` or `Changed({ added, removed })` from comparing two `SectionBlock` values
* `SyncResult` — `Created`, `Updated({ diff })`, or `Unchanged` from a write-if-changed operation
* `CheckResult` — `Found({ isUpToDate, diff })` or `NotFound` from a read-only comparison

### ManagedSection service redesigned with sync/check/dual API

`ManagedSection` is a fully redesigned `Context.Tag` service backed by `@effect/platform` `FileSystem`. The previous hook-style API is replaced with five operations, all using the dual pattern:

| Method      | Takes               | Returns                |
| :---------- | :------------------ | :--------------------- |
| `read`      | `SectionDefinition` | `SectionBlock \| null` |
| `isManaged` | `SectionDefinition` | `boolean`              |
| `write`     | `SectionBlock`      | `void`                 |
| `sync`      | `SectionBlock`      | `SyncResult`           |
| `check`     | `SectionBlock`      | `CheckResult`          |

`sync` writes only when content has changed and returns a typed result describing what happened. `check` is read-only and reports staleness without writing.

```typescript
import {
  ManagedSection,
  ManagedSectionLive,
  SectionBlock,
} from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";

const block = SectionBlock.make({
  toolName: "silk",
  commentStyle: "#",
  content: "\nexport FOO=bar\n",
});

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  const result = yield* ms.sync(".env.local", block);
  // result is SyncResult.Created | SyncResult.Updated | SyncResult.Unchanged
});

Effect.runPromise(
  program.pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

### ToolDiscovery service

New `ToolDiscovery` `Context.Tag` service that locates CLI tools globally (PATH) or locally (via the detected package manager), extracts versions, enforces source and version constraints, and caches results by tool name.

Three resolution methods:

* `resolve(definition)` — returns `ResolvedTool` or `ToolResolutionError`
* `require(definition, message?)` — like `resolve` but maps failures to `ToolNotFoundError`
* `isAvailable(definition)` — quick boolean availability check, no caching

Resolution behavior is controlled by three tagged-enum policies on `ToolDefinition`:

* `VersionExtractor` — `Flag({ flag, parse? })`, `Json({ flag, path })`, or `None`
* `ResolutionPolicy` — `Report`, `PreferLocal`, `PreferGlobal`, or `RequireMatch`
* `SourceRequirement` — `Any`, `OnlyLocal`, `OnlyGlobal`, or `Both`

```typescript
import {
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
  ResolutionPolicy,
} from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";

const biome = ToolDefinition.make({
  name: "biome",
  policy: ResolutionPolicy.PreferLocal(),
});

const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;
  const tool = yield* td.require(biome);
  // tool.exec("check", "--write") returns a ToolCommand
  return yield* tool.exec("check", "--write").string();
}).pipe(Effect.provide(ToolDiscoveryLive), Effect.provide(NodeContext.layer));
```

### ResolvedTool and ToolCommand

`ResolvedTool` is the `Schema.TaggedClass` value returned by `ToolDiscovery`. It carries the resolved source, versions, and package manager, and exposes two command-building methods:

* `exec(...args)` — runs the tool through the local package manager (`pnpm exec`, `npx --no`, etc.) or directly if global
* `dlx(...args)` — runs the tool via the package manager's dlx/npx equivalent without requiring a local install

Both return a `ToolCommand`, a thin wrapper around `@effect/platform` `Command` with instance-method ergonomics (`cmd.string()`, `cmd.lines()`, `cmd.exitCode()`, `cmd.stream()`, `cmd.env()`, `cmd.workingDirectory()`, `cmd.stdin()`).

### Module restructure — single root export, role-based layout

The sub-path exports (`/biome`, `/config`, `/hooks`, `/publish`, `/tags`, `/versioning`) have been removed. All public APIs are now available from the single root import:

```typescript
// Before (v0.1.x)
import { ManagedSection } from "@savvy-web/silk-effects/hooks";
import { TagStrategy } from "@savvy-web/silk-effects/tags";

// After (v0.2.0+)
import { ManagedSection, TagStrategy } from "@savvy-web/silk-effects";
```

Source files are reorganized into four role-based folders: `errors/`, `schemas/`, `services/`, and `utils/`. Unit tests are co-located with their source file.

## 0.1.0

### Features

* [`d553939`](https://github.com/savvy-web/systems/commit/d5539392f70a56ada8b035313fa2d11c98fa5bde) Introduces `@savvy-web/silk-effects`, a platform-agnostic Effect library that consolidates shared Silk Suite conventions into a single package consumed across the ecosystem. The library is built on `@effect/platform` and requires `effect` as a peer dependency -- consumers supply their own platform layer.

### Publish -- Multi-Registry Target Resolution

The `./publish` module resolves raw publish-target values into fully-normalized `ResolvedTarget` records. Supported input forms are the shorthand strings `"npm"`, `"github"`, and `"jsr"`, arbitrary `https://` registry URLs, and structured `PublishTargetObject` values. Auth strategy (`oidc` vs `token`) and token environment variable names are derived automatically from the registry URL.

The module also ships `SilkPublishabilityPlugin`, a plugin for `workspaces-effect` that detects whether a workspace package is publishable by inspecting `publishConfig.access` and `private` fields.

```typescript
import {
  TargetResolver,
  TargetResolverLive,
} from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
```

### Versioning -- Changeset Config Reading and Strategy Detection

The `./versioning` module reads `.changeset/config.json` files via `ChangesetConfigReader` and detects whether the config uses Silk-specific extensions (`SilkChangesetConfig`). `VersioningStrategy` maps the config to one of three strategy types: `"single"` (one package), `"fixed-group"` (changesets `fixed` array present), or `"independent"`.

### Tags -- Git Tag Format Determination

The `./tags` module provides `TagStrategy`, which determines whether a repository should use single version tags (`1.2.3`) or scoped package tags (`@scope/pkg@1.2.3`) based on the workspace layout and versioning strategy. The `TagStrategyType` union (`"single" | "scoped"`) is exported for consumers that need to branch on the result.

### Hooks -- Managed Section Pattern for Tool-Owned File Regions

The `./hooks` module implements the managed section pattern: tool-owned regions delimited by `BEGIN {TOOL_NAME} MANAGED SECTION` / `END {TOOL_NAME} MANAGED SECTION` markers inside user-editable files. `ManagedSection` exposes `read`, `write`, `update`, and `isManaged` operations that preserve everything outside the markers while replacing managed content. Comment style (`"#"` or `"//"`) is configurable.

### Config -- Config File Discovery with `lib/configs/` Priority

The `./config` module provides `ConfigDiscovery`, which locates config files using a two-level search. When a `lib/configs/` directory contains the target file, it takes priority over the repo root -- the Silk convention for centralizing shared configs in a workspace. The resolved `ConfigLocation` includes both the file path and the `ConfigSource` (`"lib" | "root"`).

### Biome -- `$schema` URL Synchronization

The `./biome` module provides `BiomeSchemaSync`, which scans `biome.json` and `biome.jsonc` files in the working directory and updates their `$schema` field to point to the canonical versioned URL for the target Biome release. `BiomeSyncResult` reports each file as `updated`, `current`, or `skipped`.
