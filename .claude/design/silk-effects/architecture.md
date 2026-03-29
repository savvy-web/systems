---
name: silk-effects-architecture
title: "@savvy-web/silk-effects Architecture"
module: silk-effects
category: architecture
status: current
completeness: 95
last-synced: 2026-03-29
depends-on: []
---

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Module Architecture](#module-architecture)
- [Service Patterns](#service-patterns)
- [Value Object Patterns](#value-object-patterns)
- [Tagged Enum Patterns](#tagged-enum-patterns)
- [Dependencies](#dependencies)
- [Consumer Guide](#consumer-guide)
- [Rationale](#rationale)

## Overview

`@savvy-web/silk-effects` is a platform-agnostic Effect library providing Silk Suite-specific
conventions. It extracts repeated patterns from across the ecosystem into a single shared
package consumed by ~33 repositories.

The library builds on top of foundation libraries (`workspaces-effect`, `semver-effect`,
`jsonc-effect`, `yaml-effect`) to provide higher-level, Silk-opinionated behavior for
publishability detection, versioning strategy, tag formatting, managed sections, config
discovery, Biome schema synchronization, and CLI tool discovery.

**Package:** `@savvy-web/silk-effects`
**Location:** `packages/silk-effects` in `savvy-web/systems`
**Runtime:** Platform-agnostic via `@effect/platform` — consumers provide their platform layer

## Current State

v0.1.0 (branch: `feat/section-definition` adds v0.2.0 types/services) — all modules
implemented with full test coverage:

| Area | Files | Tests |
| ---- | ----- | ----- |
| Errors | `errors/*.ts` (13 error classes) | co-located `.test.ts` |
| Schemas | `schemas/*.ts` (12 schema files) | co-located `.test.ts` |
| Services | `services/*.ts` (9 services) | co-located `.test.ts` |
| Utils | `utils/ToolCommand.ts` | co-located `.test.ts` |

Total: 243 tests across 19 test files, all co-located with source.

**Single root export:** All public API is exported from the package root (`"."`). There are no
sub-path exports (`./publish`, `./hooks`, etc.). Consumers import everything from
`@savvy-web/silk-effects`.

## Module Architecture

### Source Layout

The package is organized by role, not by domain:

```text
src/
  index.ts              ← single root export
  errors/               ← Data.TaggedError classes (one per file)
  schemas/              ← Schema.TaggedClass / Schema.Class value objects and enums
  services/             ← Context.Tag services with Live layers
  utils/                ← helpers (ToolCommand wrapper)
```

Tests are co-located with source (`*.test.ts` next to `*.ts`), not in a
separate `__test__` directory.

### Publish (TargetResolver, SilkPublishabilityPlugin)

Multi-registry target resolution and publishability detection.

```text
PublishTarget (schema)          ResolvedTarget (schema)
  string | object       →       { protocol, registry, directory,
                                  access, provenance, tag, auth, tokenEnv }

TargetResolver (service)
  resolve(target) → ResolvedTarget[]

SilkPublishabilityPlugin (service)
  detect(pkgJson) → ResolvedTarget[]
  Depends on: TargetResolver
```

**Shorthand expansion:**

- `"npm"` → npmjs.org, OIDC auth
- `"github"` → npm.pkg.github.com, token auth (`GITHUB_TOKEN`)
- `"jsr"` → JSR, OIDC auth
- `"https://..."` → custom registry, token auth (derived from hostname)
- `{ protocol, registry, ... }` → pass-through with defaults

**Publishability rules:**

1. `private: true` + no `publishConfig` → not publishable
2. No `publishConfig.access` and no `publishConfig.targets` → not publishable
3. Has `publishConfig.targets` array → resolve each target
4. Has `publishConfig.registry` → resolve single target
5. Default → resolve `"npm"` shorthand

### Versioning (ChangesetConfigReader, VersioningStrategy)

Changeset configuration reading with Silk detection, and versioning strategy determination.

```text
ChangesetConfigReader (service)
  read(root) → ChangesetConfig | SilkChangesetConfig
  Depends on: FileSystem

VersioningStrategy (service)
  detect(publishablePackages) → VersioningStrategyResult
  Depends on: ChangesetConfigReader
```

**Config layering:**

- `ChangesetConfig` — matches upstream `@changesets/types` spec
- `SilkChangesetConfig` — extends with `_isSilk: true` when `changelog` field
  references `@savvy-web/changesets`

**Strategy types:**

- `"single"` — 0-1 publishable packages
- `"fixed-group"` — all publishable packages in one `fixed` group
- `"independent"` — multiple packages not in a single fixed group

### Tags (TagStrategy)

Git tag format determination based on versioning strategy.

```text
TagStrategy (service)
  determine(versioningResult) → "single" | "scoped"
  formatTag(name, version, strategy) → string
```

**Tag formats:**

- Single: `1.2.3` (strict SemVer 2.0.0, no `v` prefix)
- Scoped + `@scope/pkg`: `@scope/pkg@1.2.3`
- Scoped + unscoped: `my-pkg@1.2.3`

### Managed Sections (ManagedSection + SectionDefinition)

Managed section pattern for tool-owned regions in user-editable files. This module was
significantly redesigned in v0.2.0 with a `SectionDefinition` abstraction separating
section identity from section content.

#### Value Objects

```text
SectionDefinition (Schema.TaggedClass)
  toolName: string
  commentStyle: "#" | "//"  (default "#")
  ── Equal/Hash on toolName + commentStyle
  ── block(content) → SectionBlock
  ── generate<C>(fn) → (config: C) => SectionBlock
  ── generateEffect<C, E, R>(fn) → (config: C) => Effect<SectionBlock, ...>
  ── diff(that) → SectionDiff
  ── static: generate, generateEffect, withValidation, diff (dual API)
  ── get beginMarker / endMarker → string

ShellSectionDefinition (Schema.TaggedClass)
  toolName: string
  ── commentStyle always "#" (not configurable)
  ── Same block/generate/generateEffect/marker API as SectionDefinition

SectionBlock (Schema.TaggedClass)
  toolName: string
  commentStyle: "#" | "//"
  content: string
  ── Equal/Hash on normalized content (trimmed, whitespace-collapsed)
  ── get text / normalized / rendered → string
  ── prepend(lines) / append(lines) → SectionBlock
  ── diff(that) → SectionDiff
  ── static: diff, prepend, append (dual API)
```

#### Service

```text
ManagedSection (service)
  read(definition)  → (path) → Effect<SectionBlock | null, SectionParseError>
  read(path, definition) → Effect<SectionBlock | null, SectionParseError>

  isManaged(definition) → (path) → Effect<boolean>
  isManaged(path, definition) → Effect<boolean>

  write(block)  → (path) → Effect<void, SectionWriteError>
  write(path, block) → Effect<void, SectionWriteError>

  sync(block)  → (path) → Effect<SyncResult, SectionWriteError>
  sync(path, block) → Effect<SyncResult, SectionWriteError>

  check(block) → (path) → Effect<CheckResult, SectionParseError>
  check(path, block) → Effect<CheckResult, SectionParseError>

  Depends on: FileSystem
```

All methods support dual API (data-first and data-last). Identity-only operations (`read`,
`isManaged`) accept a `SectionDefinition`. Content operations (`write`, `sync`, `check`)
accept a `SectionBlock`.

**Marker format:**

```text
# --- BEGIN {TOOL_NAME} MANAGED SECTION ---
managed content here
# --- END {TOOL_NAME} MANAGED SECTION ---
```

Supports `#` and `//` comment styles. Preserves user content outside markers.

### Config (ConfigDiscovery)

Config file discovery following the Silk convention.

```text
ConfigDiscovery (service)
  find(name, options?) → { path, source } | null
  findAll(name, options?) → { path, source }[]
  Depends on: FileSystem
```

**Search priority:**

1. `{cwd}/lib/configs/{name}` → source: `"lib"`
2. `{cwd}/{name}` → source: `"root"`

### Biome (BiomeSchemaSync)

Version-aware Biome schema URL synchronization.

```text
BiomeSchemaSync (service)
  sync(version, options?) → { updated, skipped, current }
  check(version, options?) → { updated, skipped, current }
  Depends on: FileSystem
```

Scans for `biome.json` / `biome.jsonc`, compares `$schema` URL against expected
version, and optionally updates in place. Strips semver range prefixes (`^`, `~`, `>=`).

### Tool Discovery (ToolDiscovery)

CLI tool resolution — locating tools globally (PATH) or locally (via package manager),
extracting versions, enforcing source and version constraints, and caching results.

#### Value Objects

```text
ToolDefinition (class implements Equal.Equal)
  name: string
  versionExtractor: VersionExtractor  (default: Flag("--version"))
  policy: ResolutionPolicy            (default: Report)
  source: SourceRequirement           (default: Any)
  ── Equal/Hash on name only
  ── static make(options) → ToolDefinition

ResolvedTool (Schema.TaggedClass)
  name: string
  source: "global" | "local"
  version: Option<string>
  globalVersion: Option<string>
  localVersion: Option<string>
  packageManager: "npm" | "pnpm" | "yarn" | "bun"
  mismatch: boolean
  ── get isGlobal / isLocal / hasVersionMismatch → boolean
  ── exec(...args) → ToolCommand
  ── dlx(...args) → ToolCommand
  ── Equal/Hash on name + source + version
```

#### Service

```text
ToolDiscovery (service)
  resolve(definition) → Effect<ResolvedTool, ToolResolutionError>
  require(definition, message?) → Effect<ResolvedTool, ToolNotFoundError>
  isAvailable(definition) → Effect<boolean>
  clearCache → Effect<void>

  Depends on: CommandExecutor, PackageManagerDetector, WorkspaceRoot
```

Results are cached by tool name (Ref-based Map); `clearCache` resets the cache.

### ToolCommand (util)

Thin wrapper around `@effect/platform` `Command.Command` providing instance method
ergonomics.

```text
ToolCommand (class)
  command: Command.Command
  ── string(encoding?) → Effect<string, PlatformError, CommandExecutor>
  ── exitCode() → Effect<number, PlatformError, CommandExecutor>
  ── lines(encoding?) → Effect<string[], PlatformError, CommandExecutor>
  ── stream() → Stream<Uint8Array, PlatformError, CommandExecutor>
  ── env(record) → ToolCommand
  ── workingDirectory(cwd) → ToolCommand
  ── stdin(input) → ToolCommand
```

Returned by `ResolvedTool.exec()` and `ResolvedTool.dlx()`.

## Service Patterns

All services follow the same Effect-TS patterns:

### Service Definition

```typescript
export class ServiceName extends Context.Tag("@savvy-web/silk-effects/ServiceName")<
  ServiceName,
  { readonly method: (...) => Effect.Effect<Result, ErrorType> }
>() {}
```

### Layer Implementation

```typescript
// Pure service (no dependencies)
export const ServiceLive = Layer.succeed(ServiceName, { ... });

// Service with dependencies
export const ServiceLive = Layer.effect(ServiceName, Effect.gen(function* () {
  const dep = yield* DependencyTag;
  return ServiceName.of({ ... });
}));
```

### Error Types

```typescript
export class ModuleError extends Data.TaggedError("ModuleError")<{
  readonly field: string;
}> {
  get message() { return `Description: ${this.field}`; }
}
```

### Schema Types

```typescript
export class ValueObject extends Schema.TaggedClass<ValueObject>()("ValueObject", {
  field: Schema.String,
}) {}
```

## Value Object Patterns

Value objects in this package implement `Equal.Equal` and `Hash.Hash` for structural
comparison. Two patterns are used:

**Schema-based** (preferred for serialisable types): Extend `Schema.TaggedClass`. Override
`[Equal.symbol]` and `[Hash.symbol]` to control comparison semantics (e.g. `SectionBlock`
compares on normalized content, not raw content; `ResolvedTool` compares on
name + source + version).

**Plain class** (for non-serialisable types with complex construction): Implement
`Equal.Equal` directly with a private constructor and a static `make()` factory.
`ToolDefinition` uses this pattern because its fields include function-valued tagged enums
that cannot be round-tripped through Schema.

## Tagged Enum Patterns

Discriminated union types that don't need Schema round-tripping use `Data.taggedEnum`:

```typescript
export type SectionDiffDefinition = {
  readonly Unchanged: {};
  readonly Changed: { readonly added: ReadonlyArray<string>; readonly removed: ReadonlyArray<string> };
};
export type SectionDiff = Data.TaggedEnum<SectionDiffDefinition>;
export const SectionDiff = Data.taggedEnum<SectionDiff>();
```

Tagged enums used in this package:

| Enum | Variants | Purpose |
| ---- | -------- | ------- |
| `SectionDiff` | `Unchanged`, `Changed` | Result of comparing two section contents |
| `SyncResult` | `Created`, `Updated`, `Unchanged` | Result of a `ManagedSection.sync` call |
| `CheckResult` | `Found`, `NotFound` | Result of a `ManagedSection.check` call |
| `VersionExtractor` | `Flag`, `Json`, `None` | How to extract a version from CLI output |
| `ResolutionPolicy` | `Report`, `PreferLocal`, `PreferGlobal`, `RequireMatch` | Version mismatch handling |
| `SourceRequirement` | `Any`, `OnlyLocal`, `OnlyGlobal`, `Both` | Where a tool must be found |

## Dependencies

```text
@savvy-web/silk-effects
  ├── effect (peer)
  ├── @effect/platform (direct)
  ├── workspaces-effect (direct)
  ├── semver-effect (direct)
  ├── jsonc-effect (direct)
  └── yaml-effect (direct)
```

**Runtime requirement:** Consumers must provide a platform layer (`NodeContext.layer`,
`BunContext.layer`, etc.) for modules that use `FileSystem` or `CommandExecutor`.

**Modules requiring FileSystem:**

- `ManagedSection` / `ManagedSectionLive`
- `ConfigDiscovery` / `ConfigDiscoveryLive`
- `BiomeSchemaSync` / `BiomeSchemaSyncLive`
- `ChangesetConfigReader` / `ChangesetConfigReaderLive`

**Modules requiring CommandExecutor + PackageManagerDetector + WorkspaceRoot:**

- `ToolDiscovery` / `ToolDiscoveryLive`

**Pure modules (no platform requirements):**

- `TargetResolver` / `TargetResolverLive`
- `SilkPublishabilityPlugin` / `SilkPublishabilityPluginLive` (delegates to TargetResolver)
- `TagStrategy` / `TagStrategyLive`
- All value objects and tagged enums

## Consumer Guide

### Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

### Usage

All exports come from the package root:

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  TargetResolver,
  TargetResolverLive,
  ManagedSection,
  ManagedSectionLive,
  SectionDefinition,
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";
```

**Pure services (no platform layer needed):**

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(
    Effect.provide(TargetResolverLive),
  )
);
```

**FileSystem-dependent services:**

```typescript
const def = SectionDefinition.make({ toolName: "MY-TOOL" });

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    const block = def.block("\nnpx lint-staged\n");
    return yield* ms.sync(".husky/pre-commit", block);
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  )
);
```

**ToolDiscovery:**

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const td = yield* ToolDiscovery;
    const tool = yield* td.resolve(ToolDefinition.make({ name: "biome" }));
    const cmd = tool.exec("check", ".");
    return yield* cmd.string();
  }).pipe(
    Effect.provide(ToolDiscoveryLive),
    Effect.provide(NodeContext.layer),
  )
);
```

## Rationale

### Why platform-agnostic?

The library is consumed by GitHub Actions (Node.js), CLI tools (Node.js), and potentially
Bun-based tools. Using `@effect/platform` abstractions ensures compatibility across all
runtimes without requiring separate implementations.

### Why extract these patterns?

These patterns were independently implemented in 3-6 repos each. Extracting them
eliminates duplication, ensures consistent behavior, and provides a single point for
version-bumping the shared logic.

### Why `effect` as a peer dependency?

Consumers already depend on `effect`. Bundling it would cause version conflicts and
bloated output. As a peer, consumers get a single copy.

### Why SectionDefinition separates identity from content?

In v0.1.0 `ManagedSection` accepted raw `(path, toolName, content)` tuples. The v0.2.0
redesign separates section identity (`SectionDefinition` — tool name + comment style) from
section content (`SectionBlock` — the actual managed lines). This enables:

- Typed factories via `generate`/`generateEffect` that bind a config-to-string function
  to a definition
- Equal/Hash semantics: definitions compare on identity, blocks compare on normalized content
- Validation hooks (`withValidation`) attached to a definition rather than inline
- Cleaner service API: identity operations take `SectionDefinition`, write/sync/check take
  `SectionBlock`

### Why role-based folders instead of domain folders?

Earlier iterations organized by domain (`hooks/`, `publish/`, `biome/`, etc.) and exposed
sub-path exports. This created friction: consumers needed to know which sub-path to import
from, the build config required multiple entry points, and tests lived separately in a
`__test__` directory. The role-based layout (`errors/`, `schemas/`, `services/`, `utils/`)
with a single root export and co-located tests simplifies both the build and the consumer
experience.

### Why layered changeset config?

`ChangesetConfig` matches the upstream `@changesets/types` spec so the module works with
any changesets project. `SilkChangesetConfig` extends it for Silk-specific features without
breaking compatibility.
