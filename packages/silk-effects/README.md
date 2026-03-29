# @savvy-web/silk-effects

[![npm version](https://img.shields.io/npm/v/@savvy-web/silk-effects)](https://www.npmjs.com/package/@savvy-web/silk-effects)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Shared [Effect](https://effect.website/) library providing Silk Suite conventions for publishability detection, versioning strategy, tag formatting, managed file sections, config discovery, Biome schema synchronization, and CLI tool resolution. Platform-agnostic -- consumers provide their own runtime layer (`NodeContext`, `BunContext`, etc.).

## Features

- Resolve publish targets and detect publishability from `package.json` with multi-registry support
- Manage tool-owned sections in user-editable files without clobbering surrounding content
- Discover and resolve CLI tools globally or locally with version enforcement and caching
- Detect versioning strategy and format git tags from changeset configuration
- Locate config files and keep Biome schema URLs in sync across workspaces

## Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

`effect` is a peer dependency. Install a platform package (`@effect/platform-node`, `@effect/platform-bun`) matching your runtime.

## Quick Start

All exports come from the package root:

```typescript
import {
  TargetResolver, TargetResolverLive,
  ManagedSection, ManagedSectionLive, SectionDefinition,
  ToolDiscovery, ToolDiscoveryLive, ToolDefinition,
} from "@savvy-web/silk-effects";
```

## Services

The 9 services are grouped by which platform layers they require.

---

### No Platform Layer Required

These services are pure logic -- no filesystem or shell access needed.

#### TargetResolver

Resolve raw publish-target values into fully-normalized `ResolvedTarget` records. Supports shorthands (`"npm"`, `"github"`, `"jsr"`), custom registry URLs, and object configs. Auth strategy (OIDC vs token) is auto-detected from the registry hostname.

```typescript
import { Effect } from "effect";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
// => ResolvedTarget[] with registry, auth, provenance, etc.
```

#### SilkPublishabilityPlugin

Detect whether a package is publishable from its `package.json` and resolve its targets. Delegates to `TargetResolver` internally.

Rules: `private: true` with no `publishConfig` is not publishable. A `publishConfig.targets` array resolves each entry. A bare `publishConfig.registry` resolves a single target. Default falls back to `"npm"`.

```typescript
import { Effect } from "effect";
import {
  SilkPublishabilityPlugin, SilkPublishabilityPluginLive,
  TargetResolverLive,
} from "@savvy-web/silk-effects";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const plugin = yield* SilkPublishabilityPlugin;
    return yield* plugin.detect(packageJson);
  }).pipe(
    Effect.provide(SilkPublishabilityPluginLive),
    Effect.provide(TargetResolverLive),
  ),
);
```

#### TagStrategy

Determine git-tag naming strategy and format tag strings. Strategy is `"single"` (one publishable package, tags like `1.2.3`) or `"scoped"` (multiple packages, tags like `@scope/pkg@1.2.3`). Tag format follows strict SemVer 2.0.0 with no `v` prefix.

```typescript
import { Effect } from "effect";
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects";

const tag = await Effect.runPromise(
  Effect.gen(function* () {
    const ts = yield* TagStrategy;
    const strategy = yield* ts.determine(versioningResult);
    return yield* ts.formatTag("@savvy-web/silk-effects", "0.2.0", strategy);
  }).pipe(Effect.provide(TagStrategyLive)),
);
// => "@savvy-web/silk-effects@0.2.0"
```

---

### FileSystem Layer Required

These services read or write files. Provide a platform layer such as `NodeContext.layer` or `BunContext.layer`.

#### ManagedSection

Manage tool-owned delimited sections inside user-editable files. Sections are bounded by markers like `# --- BEGIN TOOL MANAGED SECTION ---` / `# --- END ... ---`. User content outside the markers is never touched.

**SectionDefinition** is a value object representing section identity (tool name + comment style). It creates `SectionBlock` instances that hold the actual content. Definitions support typed content factories via `generate()` and `generateEffect()`.

**SectionBlock** represents the content between markers. It supports `diff()`, `prepend()`, and `append()` operations and uses normalized content for equality comparison.

Methods: `read`, `write`, `sync`, `check`, `isManaged` -- all support dual API (data-first and data-last) for pipe composition.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ManagedSection, ManagedSectionLive, SectionDefinition,
} from "@savvy-web/silk-effects";

// Define section identity
const def = SectionDefinition.make({ toolName: "LINT-STAGED" });

// Create a content block from the definition
const block = def.block("\nnpx lint-staged\n");

await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;

    // Sync: creates the section if missing, updates if changed, no-op if identical
    const result = yield* ms.sync(".husky/pre-commit", block);
    // => SyncResult: Created | Updated | Unchanged

    // Check: compare file content against expected block
    const check = yield* ms.check(".husky/pre-commit", block);
    // => CheckResult: Found | NotFound
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

`SectionDefinition` also supports `//` comment style for JavaScript/TypeScript files:

```typescript
const jsDef = SectionDefinition.make({ toolName: "MY-TOOL", commentStyle: "//" });
```

Use `ShellSectionDefinition` when the comment style is always `#` and should not be configurable.

#### VersioningStrategy

Classify the versioning strategy from changeset configuration. Outputs `"single"` (0-1 publishable packages), `"fixed-group"` (all packages in one fixed group), or `"independent"` (multiple packages, not in a single group). Falls back gracefully if config is missing.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  VersioningStrategy, VersioningStrategyLive,
  ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const vs = yield* VersioningStrategy;
    return yield* vs.detect(publishablePackages, process.cwd());
  }).pipe(
    Effect.provide(VersioningStrategyLive),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => { strategy: "single" | "fixed-group" | "independent", ... }
```

#### ChangesetConfigReader

Read and decode `.changeset/config.json`. Auto-detects whether the project uses `@savvy-web/changesets` (returning `SilkChangesetConfig` with `_isSilk: true`) or standard changesets (returning `ChangesetConfig`).

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ChangesetConfigReader, ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects";

const config = await Effect.runPromise(
  Effect.gen(function* () {
    const reader = yield* ChangesetConfigReader;
    return yield* reader.read(process.cwd());
  }).pipe(
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

#### ConfigDiscovery

Locate config files using a priority-based search convention. Checks `lib/configs/{name}` (shared configs) first, then `{cwd}/{name}` (local override).

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ConfigDiscovery, ConfigDiscoveryLive } from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const cd = yield* ConfigDiscovery;
    return yield* cd.find("biome.jsonc");
    // => { path: "/project/biome.jsonc", source: "root" } | null
  }).pipe(
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

#### BiomeSchemaSync

Keep Biome config `$schema` URLs current. Locates `biome.json` or `biome.jsonc`, compares the `$schema` value against the expected URL for the given version, and optionally updates in place. Strips semver range prefixes.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { BiomeSchemaSync, BiomeSchemaSyncLive } from "@savvy-web/silk-effects";

await Effect.runPromise(
  Effect.gen(function* () {
    const bss = yield* BiomeSchemaSync;
    const result = yield* bss.sync("2.0.0");
    // => { updated: true, skipped: false, current: "2.0.0" }
  }).pipe(
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

---

### FileSystem + CommandExecutor Layer Required

#### ToolDiscovery

Locate CLI tools globally (PATH) or locally (via package manager), extract versions, enforce constraints, and cache results.

**ToolDefinition** configures how a tool is resolved: `VersionExtractor` (Flag, Json, or None), `ResolutionPolicy` (Report, PreferLocal, PreferGlobal, RequireMatch), and `SourceRequirement` (Any, OnlyLocal, OnlyGlobal, Both). Equality is based on tool name only.

**ResolvedTool** is the result of resolution. It carries the tool's name, source (`"global"` or `"local"`), version, and package manager. Its `exec()` and `dlx()` methods return a **ToolCommand** -- a wrapper around `@effect/platform` `Command` with instance-method ergonomics (`string()`, `lines()`, `exitCode()`, `stream()`).

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ToolDiscovery, ToolDiscoveryLive, ToolDefinition,
} from "@savvy-web/silk-effects";

const output = await Effect.runPromise(
  Effect.gen(function* () {
    const td = yield* ToolDiscovery;

    // Resolve a tool (results are cached by name)
    const biome = yield* td.resolve(ToolDefinition.make({ name: "biome" }));

    // Check availability without throwing
    const hasBiome = yield* td.isAvailable(ToolDefinition.make({ name: "biome" }));

    // Execute the resolved tool
    return yield* biome.exec("check", ".").string();
  }).pipe(
    Effect.provide(ToolDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

Use `require()` to fail with a descriptive error if the tool is not found:

```typescript
const biome = yield* td.require(
  ToolDefinition.make({ name: "biome" }),
  "Biome is required for linting",
);
```

## Documentation

For architecture details, service patterns, and design rationale, see the [design documentation](./.claude/design/silk-effects/architecture.md).

## License

[MIT](./LICENSE)
