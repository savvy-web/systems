# @savvy-web/silk-effects

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fsilk-effects?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/silk-effects)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

Shared [Effect](https://effect.website/) library providing Silk Suite conventions for publishability detection, versioning strategy, tag formatting, managed file sections, config discovery, Biome schema synchronization and CLI tool resolution. Platform-agnostic — consumers provide their own runtime layer (`NodeContext`, `BunContext`, etc.).

## Features

- Detect a package's publish targets from its `package.json` `publishConfig`, with multi-registry support and a changeset-ignore-aware override for `workspaces-effect`'s `PublishabilityDetector`
- Read changeset config through a typed accessor service that reports silk vs vanilla mode, ignore patterns and fixed groups
- Manage tool-owned sections in user-editable files without clobbering surrounding content, including ordered multi-section sync for composing several managed regions per file
- Discover and resolve CLI tools globally or locally with version enforcement and caching
- Detect versioning strategy and format git tags from changeset configuration
- Locate config files and keep Biome schema URLs in sync across workspaces
- Inspect a Turborepo read-only — diagnose per-package cache hits, derive the task graph and compute affected packages, all over `turbo --dry`

## Install

```bash
npm install @savvy-web/silk-effects effect @effect/platform @effect/platform-node
# or
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

`effect` and `@effect/platform` are peer dependencies. Install a platform package (`@effect/platform-node`, `@effect/platform-bun`) matching your runtime.

## Quick start

All exports come from the package root:

```typescript
import {
  SilkPublishability,
  ManagedSection, ManagedSectionLive, SectionDefinition,
  ToolDiscovery, ToolDiscoveryLive, ToolDefinition,
} from "@savvy-web/silk-effects";
```

`SilkPublishability.detect` is a pure static — no layers, no Effect runtime. Pass a package name and the raw `package.json` and get back the publish targets the silk rules resolve:

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect("@my-org/my-package", {
  private: true,
  publishConfig: { access: "public", targets: ["npm", "github"] },
});
// => [PublishTarget { name: "@my-org/my-package", registry: "https://registry.npmjs.org/", ... },
//     PublishTarget { name: "@my-org/my-package", registry: "https://npm.pkg.github.com/", ... }]
```

## Services

The services are grouped by which platform layers they require.

---

### No platform layer required

These services are pure logic — no filesystem or shell access needed.

#### SilkPublishability

Apply silk publishability rules to a raw `package.json` and resolve its publish targets. Targets are `PublishTarget` records from `workspaces-effect` with `name`, `registry`, `directory`, `access` and `provenance` fields. The static `detect`, `expandShorthand` and `resolveTargetAccess` helpers are pure; `resolveTargets` and `listPublishable` are Effects that read from disk (see below).

In silk mode `private: true` is the norm on workspace `package.json` files. Publishability is derived from `publishConfig`, with the `private` flag consulted only as a last-resort default.

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

// Targets-first: one PublishTarget per surviving publishConfig.targets entry
const targets = SilkPublishability.detect("@my-org/pkg", {
  private: true,
  publishConfig: { access: "public", targets: ["npm", "github"] },
});
// => [PublishTarget { registry: "https://registry.npmjs.org/", access: "public", ... },
//     PublishTarget { registry: "https://npm.pkg.github.com/", access: "public", ... }]

// Not publishable -> empty array
const none = SilkPublishability.detect("@my-org/internal", { private: true });
// => []
```

See [Publishability](./docs/publishability.md) for the full rule order and the disk-reading helpers.

#### TagStrategy

Determine git-tag naming strategy and format tag strings. Strategy is `"single"` (one publishable package, tags like `1.2.3`) or `"scoped"` (multiple packages, tags like `@scope/pkg@1.2.3`). Tag format follows strict SemVer 2.0.0 with no `v` prefix.

```typescript
import { Effect } from "effect";
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects";

const tag = await Effect.runPromise(
  Effect.gen(function* () {
    const ts = yield* TagStrategy;
    const strategy = yield* ts.determine(versioningResult);
    return yield* ts.formatTag("@savvy-web/silk-effects", "1.0.0", strategy);
  }).pipe(Effect.provide(TagStrategyLive)),
);
// => "@savvy-web/silk-effects@1.0.0"
```

---

### FileSystem layer required

These services read or write files. Provide a platform layer such as `NodeContext.layer` or `BunContext.layer`.

#### SilkPublishabilityDetectorLive and PublishabilityDetectorAdaptiveLive

`SilkPublishability.detect` is also exposed through `workspaces-effect`'s `PublishabilityDetector` Tag so consumers can swap silk rules into any program that already yields the detector. Two layers override the Tag:

- `SilkPublishabilityDetectorLive` — applies silk rules unconditionally. Requires `FileSystem`.
- `PublishabilityDetectorAdaptiveLive` — ignore-aware. Changeset-`ignore`d packages resolve to `[]`, then it dispatches by changeset mode (`none` → `[]`, `silk` → silk rules, `vanilla` → the `workspaces-effect` default). Requires `FileSystem` and `ChangesetConfig`.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { PublishabilityDetector } from "workspaces-effect";
import { SilkPublishabilityDetectorLive } from "@savvy-web/silk-effects";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const detector = yield* PublishabilityDetector;
    return yield* detector.detect(pkg, root);
  }).pipe(
    Effect.provide(SilkPublishabilityDetectorLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => ReadonlyArray<PublishTarget>
```

See [Publishability](./docs/publishability.md) for the adaptive layer and the `ChangesetConfig` service.

#### ChangesetConfig

Typed accessor over a workspace root's `.changeset/config.json`, reading through `ChangesetConfigReader` with a per-root cache. Every accessor is total — a missing or unreadable config collapses to `mode: "none"` and empty defaults. Methods: `mode`, `versionPrivate`, `ignorePatterns`, `isIgnored`, `fixed`, plus a static `ChangesetConfig.matches(name, pattern)`.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ChangesetConfig, ChangesetConfigLive, ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects";

const mode = await Effect.runPromise(
  Effect.gen(function* () {
    const config = yield* ChangesetConfig;
    return yield* config.mode(process.cwd());
  }).pipe(
    Effect.provide(ChangesetConfigLive),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => "silk" | "vanilla" | "none"
```

#### ManagedSection

Manage tool-owned delimited sections inside user-editable files. Sections are bounded by markers like `# --- BEGIN TOOL MANAGED SECTION ---` / `# --- END ... ---`. User content outside the markers is never touched.

`SectionDefinition` is a value object representing section identity (tool name + comment style). It creates `SectionBlock` instances that hold the actual content. Definitions support typed content factories via `generate()` and `generateEffect()`.

`SectionBlock` represents the content between markers. It supports `diff()`, `prepend()` and `append()` operations and uses normalized content for equality comparison.

Methods: `read`, `write`, `sync`, `syncMany`, `check`, `remove`, `isManaged` — all support dual API (data-first and data-last) for pipe composition. `sync` manages one section; `syncMany` manages several ordered sections in one file; `remove` deletes a section including its markers.

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

    // Remove: delete the section and its markers, collapsing the leftover blank line
    const removed = yield* ms.remove(".husky/pre-commit", def);
    // => true if a section was removed, false if none was present
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

`syncMany` keeps several sections in one file in their declared relative order. It updates existing sections in place, inserts a missing section next to its declared sibling, normalizes order when sections drift out of order and preserves user content and unrelated tool sections. It returns one `SyncResult` per input block in input order and is idempotent.

The `SavvySections` exports compose ordered managed sections per husky hook file. A base section defines shared shell, then each consumer layers its own one-line tool section on top:

- `SavvyBaseSection` is a `ShellSectionDefinition` (tool name `savvy-base`); pair it with `savvyBasePreamble()`, which defines `ROOT`, the `in_ci` predicate, `PM` via package-manager detection and `pm_exec`.
- `SavvyHooksSection` (tool name `savvy-hooks`) pairs with `savvyHooksHygiene()`, a self-guarded repo-hygiene block that runs outside CI.
- `savvyToolSection(toolName, command)` builds a consumer's one-line tool section whose content is exactly `in_ci || pm_exec <command>` — the command is appended verbatim, so shell tokens like `$ROOT` and `$1` survive into the output. A `savvy-base` section must precede it in the same hook file, so pass both to `syncMany` in that order.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ManagedSection, ManagedSectionLive,
  SavvyBaseSection, savvyBasePreamble, savvyToolSection,
} from "@savvy-web/silk-effects";

await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    const results = yield* ms.syncMany(".husky/commit-msg", [
      SavvyBaseSection.block(savvyBasePreamble()),
      savvyToolSection("savvy-commit", 'commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"'),
    ]);
    // => ReadonlyArray<SyncResult>, one per input block in declared order
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

#### VersioningStrategy

Classify the versioning strategy from changeset configuration. Outputs `"single"` (0-1 publishable packages), `"fixed-group"` (all packages in one fixed group) or `"independent"` (multiple packages, not in a single group). Falls back gracefully if config is missing.

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

Read and decode `.changeset/config.json`. Auto-detects whether the project uses `@savvy-web/changesets` (returning `SilkChangesetConfigFile` with `_isSilk: true`) or standard changesets (returning `ChangesetConfigFile`).

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
// => ChangesetConfigFile | SilkChangesetConfigFile
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
  }).pipe(
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => { path: "/project/biome.jsonc", source: "root" } | null
```

#### BiomeSchemaSync

Keep Biome config `$schema` URLs current. Locates `biome.json` or `biome.jsonc`, compares the `$schema` value against the expected URL for the given version, and optionally updates in place. Strips semver range prefixes.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { BiomeSchemaSync, BiomeSchemaSyncLive } from "@savvy-web/silk-effects";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const bss = yield* BiomeSchemaSync;
    return yield* bss.sync("2.0.0");
  }).pipe(
    Effect.provide(BiomeSchemaSyncLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => { updated: true, skipped: false, current: "2.0.0" }
```

---

### FileSystem + CommandExecutor layer required

#### ToolDiscovery

Locate CLI tools globally (PATH) or locally (via package manager), extract versions, enforce constraints and cache results.

`ToolDefinition` configures how a tool is resolved: `VersionExtractor` (Flag, Json or None), `ResolutionPolicy` (Report, PreferLocal, PreferGlobal, RequireMatch) and `SourceRequirement` (Any, OnlyLocal, OnlyGlobal, Both). Equality is based on tool name only.

`ResolvedTool` is the result of resolution. It carries the tool's name, source (`"global"` or `"local"`), version and package manager. Its `exec()` and `dlx()` methods return a `ToolCommand` — a wrapper around `@effect/platform` `Command` with instance-method ergonomics (`string()`, `lines()`, `exitCode()`, `stream()`).

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

#### TurboInspector

Read-only Turborepo inspection. Every method shells out to `turbo` with `--dry=json`, so no task ever runs. `diagnoseCache(task, cwd)` reports a per-package cache HIT/MISS breakdown for a task, `taskGraph(cwd, task?)` derives the task graph and its critical path and `affected(cwd, base?)` lists the packages affected relative to `base` (default `main`). It resolves the `turbo` binary through `ToolDiscovery` and fails with a tagged error when `turbo` is missing or the directory is not a Turborepo. The service tag and its layer are exported under the `Turbo` namespace.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { Turbo, ToolDiscoveryLive } from "@savvy-web/silk-effects";

const diagnosis = await Effect.runPromise(
  Effect.gen(function* () {
    const turbo = yield* Turbo.TurboInspector;
    return yield* turbo.diagnoseCache("build:dev", process.cwd());
  }).pipe(
    Effect.provide(Turbo.TurboInspectorLive),
    Effect.provide(ToolDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => CacheDiagnosis: per-package HIT/MISS breakdown for the task
```

## Documentation

- [Overview](./docs/overview.md) — what the library is, its design philosophy and platform-layer model
- [Publishability](./docs/publishability.md) — silk publishability rules, the detector overrides and the ChangesetConfig service
- [Changeset config](./docs/changeset-config.md) — reading and decoding `.changeset/config.json`
- [Platform layers](./docs/platform-layers.md) — composing layers and providing platform dependencies
- [Managed sections](./docs/managed-section.md) — tool-owned regions in user-editable files
- [Tool discovery](./docs/tool-discovery.md) — locating and resolving CLI tools
- [Versioning strategy](./docs/versioning-strategy.md) — classifying workspace versioning
- [Config discovery](./docs/config-discovery.md) — priority-based config file search
- [Biome sync](./docs/biome-sync.md) — keeping Biome `$schema` URLs current
- [Tag strategy](./docs/tag-strategy.md) — git tag naming and formatting

## License

[MIT](LICENSE)
