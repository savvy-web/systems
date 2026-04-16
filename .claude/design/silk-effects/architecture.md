---
name: silk-effects-architecture
title: "@savvy-web/silk-effects Architecture"
module: silk-effects
category: architecture
status: current
completeness: 95
last-synced: 2026-04-15
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
- [Testing Strategy](#testing-strategy)
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
| Errors | `errors/*.ts` (14 error classes) | `__test__/errors/` |
| Schemas | `schemas/*.ts` (13 schema files) | `__test__/schemas/` |
| Services | `services/*.ts` (10 services) | `__test__/services/` |
| Utils | `utils/ToolCommand.ts` | `__test__/utils/` |

Tests live in a dedicated `__test__/` directory (22 test files, 105 fixture files)
mirroring the source structure. Integration tests with real filesystem fixtures live
in `__test__/integration/`.

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

__test__/
  errors/               ← error class tests
  schemas/              ← schema/value object tests
  services/             ← service tests
  utils/                ← utility tests
  integration/          ← integration tests with real filesystem
    fixtures/workspaces/  ← workspace fixture tree (see Testing Strategy)
```

Tests were moved from co-located (`*.test.ts` next to `*.ts`) to a dedicated
`__test__/` directory that mirrors the source layout. This enables Vitest
auto-discovery and cleanly separates source from test code.

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

### Workspace Analysis (SilkWorkspaceAnalyzer)

Composite service that orchestrates full workspace analysis — discovering packages,
detecting publishability, computing versioning/tag strategies, and wiring up
fixed/linked release groups.

#### SilkPublishConfig

Extends upstream `PublishConfig` from `workspaces-effect` with the Silk `targets`
extension for multi-registry publishing, using Schema's `.extend()` API:

```text
SilkPublishConfig extends PublishConfig
  targets: optional Array<PublishTargetShorthand | PublishTargetObject>
```

#### Value Objects

```text
AnalyzedWorkspace (Schema.TaggedClass)
  name: string
  version: { current: string }
  path: string
  root: boolean
  publishConfig: SilkPublishConfig | null
  publishable: boolean
  targets: Array<ResolvedTarget>
  versioned: boolean
  tagged: boolean
  released: boolean
  linked: Array<AnalyzedWorkspace>     (circular ref via Schema.suspend)
  fixed: Array<AnalyzedWorkspace>      (circular ref via Schema.suspend)

  ── get isRoot / isPublishable / isReleasable / isFixed / isLinked → boolean
  ── publishesTo(registry) → boolean
  ── hasTarget("npm" | "github" | "jsr") → boolean
  ── targetFor(registry) → Option<ResolvedTarget>
  ── toString() → "name@version"
  ── toJSON() → plain object (omits linked/fixed to avoid cycles)
  ── Equal/Hash on name + path
  ── static: publishable, releasable (array filters)
  ── static: findByName (dual-API: data-first and data-last)
  ── static: pretty (via Pretty.make)

WorkspaceAnalysis (Schema.TaggedClass)
  root: string
  runtime: "node" | "bun"
  packageManager: { type: "npm" | "pnpm" | "yarn" | "bun", version?: string }
  workspaces: Array<AnalyzedWorkspace>
  changesetConfig: ChangesetConfig | SilkChangesetConfig | null
  versioning: VersioningStrategyResult | null
  tagStrategy: "single" | "scoped" | null

  ── findWorkspace(name) → Option<AnalyzedWorkspace>
  ── get rootWorkspace → AnalyzedWorkspace
  ── get publishableWorkspaces / versionedWorkspaces / taggedWorkspaces
       / releasableWorkspaces → ReadonlyArray<AnalyzedWorkspace>
  ── get isSilk → boolean (checks changesetConfig._isSilk)
  ── get hasChangesets → boolean (changesetConfig != null)
  ── Equal/Hash on root
  ── static: pretty (via Pretty.make)
```

#### Service

```text
SilkWorkspaceAnalyzer (Context.Tag)
  analyze(root: string) → Effect<WorkspaceAnalysis, WorkspaceAnalysisError>
```

#### Live Layer

```text
SilkWorkspaceAnalyzerLive
  Requires:
    FileSystem, WorkspaceDiscovery, PackageManagerDetector,
    SilkPublishabilityPlugin, ChangesetConfigReader,
    VersioningStrategy, TagStrategy
```

The live layer orchestrates a 9-step pipeline:

1. Detect package manager and runtime
2. Discover workspace packages
3. Read changeset config (optional)
4. For each package: read raw `package.json`, detect publishability via
   `SilkPublishabilityPlugin`, compute release status
5. Wire up fixed/linked group cross-references (in-place mutation)
6. Compute versioning strategy
7. Determine tag strategy
8. Build final `WorkspaceAnalysis`

#### Release Status Computation

The `computeReleaseStatus` function determines `versioned`, `tagged`, and `released`
flags per-package based on the changeset config:

- **No changesets config:** all flags `false`
- **Package in `ignore` list:** all flags `false`
- **Publishable package** (public or private with publishConfig.access): all flags `true`
- **Truly private package** (no publish targets): consults `privatePackages` config
  - `undefined` → all `false`
  - `false` → all `false` (completely ignored)
  - `{ version, tag }` → flags match config; `released = versioned && tagged`

#### ChangesetConfig

`ChangesetConfig` is extended to cover the full `@changesets/config@3.1.1` upstream
spec, including all optional fields: `changelog`, `commit`, `fixed`, `linked`,
`access`, `baseBranch`, `updateInternalDependencies`, `ignore`, `privatePackages`,
`prettier`, `changedFilePatterns`, `bumpVersionsWithWorkspaceProtocolOnly`, and
`snapshot` (with `useCalculatedVersion` and `prereleaseTemplate`).

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

**Composite modules (FileSystem + multiple upstream services):**

- `SilkWorkspaceAnalyzer` / `SilkWorkspaceAnalyzerLive`
  Depends on: `FileSystem`, `WorkspaceDiscovery`, `PackageManagerDetector`,
  `SilkPublishabilityPlugin`, `ChangesetConfigReader`, `VersioningStrategy`, `TagStrategy`

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

## Testing Strategy

### Directory Layout

Tests live in `__test__/` mirroring the source tree:

```text
__test__/
  errors/
    SectionErrors.test.ts
    ToolErrors.test.ts
  schemas/
    PublishabilitySchemas.test.ts
    ResolvedTool.test.ts
    SectionBlock.test.ts
    SectionDefinition.test.ts
    SectionResults.test.ts
    ToolDefinition.test.ts
    ToolResults.test.ts
    WorkspaceAnalysisSchemas.test.ts
  services/
    BiomeSchemaSync.test.ts
    ChangesetConfigReader.test.ts
    ConfigDiscovery.test.ts
    ManagedSection.test.ts
    SilkPublishabilityPlugin.test.ts
    TagStrategy.test.ts
    TargetResolver.test.ts
    ToolDiscovery.test.ts
    VersioningStrategy.test.ts
  utils/
    ToolCommand.test.ts
  integration/
    ManagedSection.int.test.ts
    SilkWorkspaceAnalyzer.int.test.ts
    fixtures/workspaces/
      standalone/{default,silk}/
      node/{pnpm,npm,yarn}/{default,silk}/
      bun/{default,silk}/
```

### Fixture Tree

Integration tests use a hierarchical fixture tree organized by runtime, package
manager, and Silk vs. default configuration:

```text
fixtures/workspaces/
  standalone/
    default/     custom-registry, multi-target, not-publishable, npm-target, private
    silk/        single
  node/
    pnpm/
      default/   basic, explicit-paths, monorepo, multi-root, nested-globs, root-as-package
      silk/      fixed-group, ignored, independent, linked, multi-fixed,
                 private-not-versioned, private-versioned-only,
                 private-versioned-tagged, single
    npm/
      default/   basic, object-form
      silk/      basic
    yarn/
      default/   basic
      silk/      basic
  bun/
    default/     basic
    silk/        basic
```

105 fixture files cover publishConfig permutations, workspace patterns, changeset
configs, fixed/linked groups, private package handling, and multi-registry targets.

### Test Approaches

- **Unit tests** (schemas, errors, utils): Verify construction, encoding/decoding,
  Equal/Hash semantics, getters, and static methods.
- **Property-based tests**: Use `fast-check` to lock down class invariants (e.g.
  `AnalyzedWorkspace` Equal/Hash consistency, `findByName` behavior) independent
  of implementation details.
- **Service tests**: Provide mock layers and verify service contract behavior.
- **Integration tests**: Run `SilkWorkspaceAnalyzer.analyze` against real fixture
  directories using `@effect/platform-node` filesystem. Catches schema decode issues
  and service composition errors that unit tests miss.
- **Pretty printing**: `Pretty.make` is wired on `AnalyzedWorkspace` and
  `WorkspaceAnalysis` for debugging and test output readability.

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

### Why `__test__/` directory?

Vitest auto-discovers test files by pattern matching. A dedicated `__test__/` directory
provides clean separation of source and test code, avoids test files appearing in editor
file explorers alongside source, and allows the test tree to mirror the source tree for
easy navigation. The build pipeline excludes `__test__/` without needing per-file
`*.test.ts` exclusion patterns.

### Why composite SilkWorkspaceAnalyzer?

Workspace analysis requires coordinating seven services in a specific order with
error mapping between service boundaries. A single composite service provides one
entry point for consumers who need a full workspace picture, hiding the orchestration
complexity. Individual services remain available for consumers who only need one
piece (e.g. just publishability or just tag strategy).

### Why fixture-driven integration tests?

Schema decode errors, service composition bugs, and filesystem edge cases only
surface when running against real directory structures. The fixture tree captures
real-world workspace layouts (pnpm with fixed groups, npm with object-form
workspaces, bun monorepos, standalone projects) that exercise the full analysis
pipeline end-to-end. Fixtures are cheap to add and serve as living documentation
of supported workspace patterns.

### Why property-based tests?

Class invariants (Equal/Hash consistency, static filter methods, dual-API
behavior) must hold for all inputs, not just hand-picked examples. Property-based
tests with fast-check lock down these invariants independent of implementation
changes, catching edge cases that example-based tests miss.
