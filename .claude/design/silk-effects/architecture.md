---
name: silk-effects-architecture
title: "@savvy-web/silk-effects Architecture"
module: silk-effects
category: architecture
status: current
completeness: 95
created: 2026-03-06
updated: 2026-05-31
last-synced: 2026-05-31
depends-on: []
related:
  - ../silk/architecture.md
  - ../cli/architecture.md
dependencies: []
---

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Tool Namespaces (Changesets, Commitlint, Lint)](#tool-namespaces-changesets-commitlint-lint)
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

As of Silk Core sub-project 1, silk-effects **also hosts the per-tool business logic** of the three
standalone dev-tooling packages (`@savvy-web/changesets`, `@savvy-web/commitlint`,
`@savvy-web/lint-staged`), exposed under three namespace exports — `Changesets`, `Commitlint` and
`Lint`. This package is the shared layer that both thin consumers (`@savvy-web/cli` and
`@savvy-web/silk`) import. See `../cli/architecture.md` and `../silk/architecture.md`, and
`docs/superpowers/specs/2026-05-30-silk-subproject-1-merge-design.md` for the merge design.

**Package:** `@savvy-web/silk-effects`
**Location:** `packages/silk-effects` in `savvy-web/systems`
**Runtime:** Platform-agnostic via `@effect/platform` — consumers provide their platform layer
**Build:** dual-format (esm + cjs) so config-integration consumers can `require()` it — see
[Why dual-format](#why-dual-format-cjs--esm)

## Current State

Published at v0.4.1. A pending minor changeset adds the `ManagedSection.syncMany`/`remove` multi-section primitives and the `SavvySections` shared husky-hook shells (`@since 0.5.0`); both are additive. All modules implemented with full test coverage:

| Area | Source | Tests |
| ---- | ------ | ----- |
| Errors | `errors/*.ts` (one `Data.TaggedError` per file) | `__test__/errors/` |
| Schemas | `schemas/*.ts` (value objects and enums) | `__test__/schemas/` |
| Services | `services/*.ts` (`Context.Tag` services with Live layers) | `__test__/services/` |
| Utils | `utils/ToolCommand.ts` | `__test__/utils/` |

Tests live in a dedicated `__test__/` directory mirroring the source structure. Integration tests with real filesystem fixtures live in `__test__/integration/`.

**Single root export:** All public API is exported from the package root (`"."`). There are no
sub-path exports (`./publish`, `./hooks`, etc.). Consumers import everything from
`@savvy-web/silk-effects`. The three tool namespaces are re-exported from the root as
`export * as Changesets` / `Commitlint` / `Lint` (see `src/index.ts`).

## Tool Namespaces (Changesets, Commitlint, Lint)

Sub-project 1 extracted the business logic of the three standalone dev-tooling packages into
silk-effects under three namespace objects. Each namespace is a self-contained subtree under `src/`
(`src/changesets/`, `src/commitlint/`, `src/lint/`) with its own `index.ts` barrel. This is the real
work of the sub-project — a genuine extraction, not a mechanical copy.

| Namespace | Holds | Subtree |
| --- | --- | --- |
| `Changesets` | transformer, linter, changelog formatter (`changelogFunctions`), remark plugins + presets, markdownlint rules, services (ConfigInspector, BranchAnalyzer, WorkspaceSnapshotReader, …), schemas, the class API wrappers (Categories, Changelog, ChangesetLinter, ChangelogTransformer, DependencyTable) | `src/changesets/` |
| `Commitlint` | `CommitlintConfig` factory + `staticConfig`, DCO/scope detection, formatter, commitizen prompt adapter, hook logic | `src/commitlint/` |
| `Lint` | the 7 handlers (Biome, Markdown, PackageJson, Yaml, TypeScript, PnpmWorkspace, ShellScripts), `Preset`, `createConfig`, Command/Filter/Workspace utils, managed-section + template data | `src/lint/` |

Why these three live here rather than in `silk`: in each source package the CLI commands and the
config-export modules share the tool's own internal logic (the changeset `transform` command and the
`./remark` export run the same plugins; the `lint` command and the `./markdownlint` export run the
same rules). `cli` must not import `silk`, so the shared logic has only one viable home — the library
layer both thin packages import. `@savvy-web/cli` consumes the namespaces as command logic;
`@savvy-web/silk` re-exports them as config-integration shims. The namespace contents themselves are
discoverable in each subtree's `index.ts`; this table is the topology, not an inventory.

## Module Architecture

### Source Layout

The package is organized by role, not by domain:

```text
src/
  index.ts              ← single root export (re-exports the three tool namespaces too)
  errors/               ← Data.TaggedError classes (one per file)
  schemas/              ← Schema.TaggedClass / Schema.Class value objects and enums
  services/             ← Context.Tag services with Live layers
  utils/                ← helpers (ToolCommand wrapper)
  changesets/           ← Changesets namespace (extracted @savvy-web/changesets logic)
  commitlint/           ← Commitlint namespace (extracted @savvy-web/commitlint logic)
  lint/                 ← Lint namespace (extracted @savvy-web/lint-staged logic)

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

### Publish (SilkPublishability)

Silk publishability rules layered over `workspaces-effect`'s `PublishTarget` value object and `PublishabilityDetector` Context.Tag. The package no longer maintains its own resolved-target model: there is one canonical target shape (`PublishTarget` from `workspaces-effect`, fields `name`, `registry`, `directory`, `access`, `provenance`) and silk-effects supplies the silk *rule* for producing it. The `auth`/`tokenEnv`/OIDC token-resolution concern has moved out to consumers.

`SilkPublishability` (`src/services/SilkPublishability.ts`) is an all-static class so the full rule surface is visible in one place:

```text
SilkPublishability (static class)
  detect(pkgName, raw) → ReadonlyArray<PublishTarget>     pure, the silk targets-first rule
  expandShorthand(target, parentRegistry) → string        shorthand/URL → registry URL
  resolveTargetAccess(target, parentAccess) → access?      per-target access resolution
  resolveTargets(pkg, root) → Effect<…, PublishabilityDetector | FileSystem>
                                                           detector + private-dist build filter
  listPublishable(root)  → Effect<…, WorkspaceDiscovery | PublishabilityDetector>
                                                           discovery + detector
```

`resolveTargets` runs the configured `PublishabilityDetector`, then drops any target whose built `directory` package.json is `private: true` (the dist-output filter). `listPublishable` discovers packages and keeps those the detector reports as publishable.

`RawPackageJson`, `RawPublishConfig` and `RawTargetSpec` describe the unschematized `package.json`/`publishConfig` shape that `detect` consumes — silk rules read fields (notably `targets`) that the upstream `PublishConfig` schema strips. `PublishablePackage` is the discovery result shape.

**Detector layers** — both override the `workspaces-effect` `PublishabilityDetector` Tag:

```text
SilkPublishabilityDetectorLive : Layer<PublishabilityDetector, never, FileSystem>
  detect reads pkg.packageJsonPath and applies SilkPublishability.detect (silk rule only)

PublishabilityDetectorAdaptiveLive : Layer<PublishabilityDetector, never, FileSystem | ChangesetConfig>
  detect short-circuits to [] for changeset-ignored packages, then dispatches on
  ChangesetConfig.mode: none → []; silk → SilkPublishability.detect;
  vanilla → workspaces-effect PublishabilityDetectorLive
```

**Shorthand expansion** (`expandShorthand`):

- `"npm"` → `https://registry.npmjs.org/`
- `"github"` → `https://npm.pkg.github.com/`
- `"jsr"` → `https://jsr.io/`
- `"http(s)://…"` → verbatim
- anything else → parent `publishConfig.registry`, else the npm default

**Publishability rules** (`SilkPublishability.detect`, targets-first precedence):

1. `publishConfig.targets` non-empty → one `PublishTarget` per target whose resolved access is `public`/`restricted`, regardless of `private`
2. else `publishConfig.access` is `public`/`restricted` → one target
3. else `private !== true` → one default npm target
4. else → `[]`

### Versioning (ChangesetConfigReader, ChangesetConfig, VersioningStrategy)

Changeset configuration reading with Silk detection, a high-level config accessor, and versioning strategy determination.

```text
ChangesetConfigReader (service)
  read(root) → ChangesetConfigFile | SilkChangesetConfigFile
  Depends on: FileSystem

ChangesetConfig (service)
  mode(root) → "silk" | "vanilla" | "none"
  versionPrivate(root) → boolean
  ignorePatterns(root) → ReadonlyArray<string>
  isIgnored(name, root) → boolean
  fixed(root) → ReadonlyArray<ReadonlyArray<string>>
  static matches(name, pattern) → boolean      the one ignore matcher
  Depends on: ChangesetConfigReader

VersioningStrategy (service)
  detect(publishablePackages, root) → VersioningStrategyResult
  Depends on: ChangesetConfigReader
```

`ChangesetConfig` (`src/services/ChangesetConfig.ts`) is a per-root cached accessor over the reader. Every accessor is total (error channel `never`): a missing or unreadable config collapses to `mode: "none"` with empty/false defaults. The static `ChangesetConfig.matches` is the single ignore-pattern matcher used across the package — exact name match, or `@scope/*` wildcard (the kept prefix includes the trailing slash, so `@scope/*` matches `@scope/anything` but not the bare `@scope`).

**Schema vs service naming:** the bare name `ChangesetConfig` is now the *service*. The decoded config *schema* types were renamed to `ChangesetConfigFile` / `SilkChangesetConfigFile` in `src/schemas/VersioningSchemas.ts`, and `ChangesetConfigReader.read` returns that union.

**Config layering:**

- `ChangesetConfigFile` — matches upstream `@changesets/config@3.1.1` spec
- `SilkChangesetConfigFile` — extends with `_isSilk: true` when `changelog` field
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

  syncMany(blocks)  → (path) → Effect<ReadonlyArray<SyncResult>, SectionWriteError>
  syncMany(path, blocks) → Effect<ReadonlyArray<SyncResult>, SectionWriteError>

  check(block) → (path) → Effect<CheckResult, SectionParseError>
  check(path, block) → Effect<CheckResult, SectionParseError>

  remove(definition)  → (path) → Effect<boolean, SectionWriteError>
  remove(path, definition) → Effect<boolean, SectionWriteError>

  Depends on: FileSystem
```

All methods support dual API (data-first and data-last). Identity-only operations (`read`, `isManaged`, `remove`) accept a `SectionDefinition`. Content operations (`write`, `sync`, `syncMany`, `check`) accept a `SectionBlock`.

`syncMany` (`@since 0.5.0`) is the multi-section compositor: it ensures every listed block exists with the given content in declared relative order, updating present sections in place, inserting a missing section adjacent to its declared sibling (before the nearest present successor, else after the nearest present predecessor, else appended) and normalizing order when sections are present but out of order. It preserves user content before, after and between managed sections and leaves unrelated tool sections in place. It returns one content-based `SyncResult` per input block in input order — a pure reorder of identical content reports `Unchanged` — and is idempotent. Single-section `sync` parses one tool at a time via `parseContent`; `syncMany` needs the general all-tools marker parser `findAllSections` plus a text/section tokenization to rebuild the file around fixed content, both internal to `ManagedSection.ts`.

`remove` (`@since 0.5.0`) deletes a section's `[begin … end]` span including markers, returning `true` if removed and `false` if the section (or the file) was absent — a missing file is not an error. It collapses the leftover blank line so repeated edits never accumulate gaps. The primary use is rename-migration: a consumer removes its old-name section and `syncMany`s the new one.

**Marker format:**

```text
# --- BEGIN {TOOL_NAME} MANAGED SECTION ---
managed content here
# --- END {TOOL_NAME} MANAGED SECTION ---
```

Supports `#` and `//` comment styles. Preserves user content outside markers.

#### SavvySections (shared husky-hook shells)

`src/schemas/SavvySections.ts` centralizes the shell content the Silk Suite husky hooks share, so consumer CLIs no longer hand-write package-manager detection. Two consumers drive this: `@savvy-web/commitlint` (`savvy-commit`) and `@savvy-web/lint-staged` (`savvy-lint`). All symbols are `@since 0.5.0` and exported from the package root.

```text
SavvyBaseSection : ShellSectionDefinition   toolName "savvy-base"
savvyBasePreamble() → string                ROOT, in_ci, detect_pm/PM, pm_exec (side-effect-free)
SavvyHooksSection : ShellSectionDefinition  toolName "savvy-hooks"
savvyHooksHygiene() → string                self-guarded core.fileMode + chmod +x
savvyToolSection(toolName, command) → SectionBlock
```

The composition contract is the load-bearing part. `savvyToolSection` produces a one-line block whose content is exactly `in_ci || pm_exec <command>` with `command` appended verbatim — no parsing, quoting or interpolation, so shell tokens like `$ROOT` and `$1` survive into the literal. Its precondition is that a `savvy-base` section precedes it in the same hook file so `in_ci`/`pm_exec` are defined; consumers satisfy this by passing `[SavvyBaseSection.block(savvyBasePreamble()), savvyToolSection(…)]` to `syncMany` in that order. `pm_exec` uses local/exec semantics per package manager and `bun x` (space form, not the `bunx` shim) so it works regardless of how bun was installed. See `SavvySections.ts` for the exact shell bodies.

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
extension for multi-registry publishing, using `PublishConfig.extend()`:

```text
SilkPublishConfig extends PublishConfig
  targets: optional Array<PublishTargetShorthand | PublishTargetObject>
```

The `targets` input schemas (`PublishTargetShorthand`, `PublishTargetObject`) are module-local to `src/schemas/WorkspaceAnalysisSchemas.ts`. These are the *input* shapes that describe what may be written in `publishConfig.targets`; they are distinct from the output `PublishTarget` value object that `SilkPublishability.detect` produces.

#### Value Objects

```text
AnalyzedWorkspace (Schema.TaggedClass)
  name: string
  version: { current: string }
  path: string
  root: boolean
  publishConfig: SilkPublishConfig | null
  publishable: boolean
  targets: Array<PublishTarget>
  versioned: boolean
  tagged: boolean
  released: boolean
  linked: Array<AnalyzedWorkspace>     (circular ref via Schema.suspend)
  fixed: Array<AnalyzedWorkspace>      (circular ref via Schema.suspend)

  ── get isRoot / isPublishable / isReleasable / isFixed / isLinked → boolean
  ── publishesTo(registry) → boolean
  ── hasTarget("npm" | "github" | "jsr") → boolean (matches via the shorthand's registry URL,
       e.g. "jsr" → https://jsr.io/)
  ── targetFor(registry) → Option<PublishTarget>
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
  changesetConfig: ChangesetConfigFile | SilkChangesetConfigFile | null
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
    FileSystem, WorkspaceDiscovery, TopologicalSorter,
    PackageManagerDetector, ChangesetConfigReader,
    VersioningStrategy, TagStrategy
```

The analyzer no longer depends on a publishability *service*: it calls `SilkPublishability.detect(pkg.name, raw)` directly (pure, synchronous) on the raw `package.json` read from disk. The live layer orchestrates a 10-step pipeline:

1. Detect package manager and runtime
2. Discover workspace packages
3. Topologically sort packages (dependencies first)
4. Read changeset config (optional)
5. For each package: read raw `package.json`, detect publishability via
   `SilkPublishability.detect`, compute release status
6. Wire up fixed/linked group cross-references (immutable reconstruction)
7. Compute versioning strategy
8. Determine tag strategy
9. Build final `WorkspaceAnalysis`

#### Release Status Computation

The `computeReleaseStatus` function determines `versioned`, `tagged`, and `released`
flags per-package based on the changeset config:

- **No changesets config:** all flags `false`
- **Package in `ignore` list:** all flags `false` (matched with `ChangesetConfig.matches`, so
  `@scope/*` wildcards apply — not exact-string `.includes`)
- **Publishable package** (public or private with publishConfig.access): all flags `true`
- **Truly private package** (no publish targets): consults `privatePackages` config
  - `undefined` → all `false`
  - `false` → all `false` (completely ignored)
  - `{ version, tag }` → flags match config; `released = versioned && tagged`

#### ChangesetConfigFile schema

`ChangesetConfigFile` covers the full `@changesets/config@3.1.1` upstream spec, including all optional fields: `changelog`, `commit`, `fixed`, `linked`, `access`, `baseBranch`, `updateInternalDependencies`, `ignore`, `privatePackages`, `prettier`, `changedFilePatterns`, `bumpVersionsWithWorkspaceProtocolOnly`, and `snapshot` (with `useCalculatedVersion` and `prereleaseTemplate`). `SilkChangesetConfigFile` extends it with the `_isSilk` marker.

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
- `SilkPublishabilityDetectorLive` (override of `workspaces-effect`'s `PublishabilityDetector`)
- `PublishabilityDetectorAdaptiveLive` (also requires `ChangesetConfig`)

**Modules requiring CommandExecutor + PackageManagerDetector + WorkspaceRoot:**

- `ToolDiscovery` / `ToolDiscoveryLive`

**Modules requiring ChangesetConfigReader:**

- `ChangesetConfig` / `ChangesetConfigLive`
- `VersioningStrategy` / `VersioningStrategyLive`

**Composite modules (FileSystem + multiple upstream services):**

- `SilkWorkspaceAnalyzer` / `SilkWorkspaceAnalyzerLive`
  Depends on: `FileSystem`, `WorkspaceDiscovery`, `TopologicalSorter`, `PackageManagerDetector`,
  `ChangesetConfigReader`, `VersioningStrategy`, `TagStrategy`

**Pure modules (no platform requirements):**

- `SilkPublishability` (all-static class — `detect`/`expandShorthand`/`resolveTargetAccess` are pure;
  `resolveTargets`/`listPublishable` are Effects requiring the `PublishabilityDetector` Tag)
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
  SilkPublishability,
  ManagedSection,
  ManagedSectionLive,
  SectionDefinition,
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";
```

**Pure publishability rule (no platform layer needed):**

`SilkPublishability.detect` is a pure function over a raw `package.json`, returning `workspaces-effect` `PublishTarget` records:

```typescript
const targets = SilkPublishability.detect("@my-org/pkg", {
  private: true,
  publishConfig: { access: "public", targets: ["npm", "github"] },
});
// → one PublishTarget per public/restricted target
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
    ResolvedTool.test.ts
    SectionBlock.test.ts
    SectionDefinition.test.ts
    SectionResults.test.ts
    ToolDefinition.test.ts
    ToolResults.test.ts
    WorkspaceAnalysisSchemas.test.ts
  services/
    BiomeSchemaSync.test.ts
    ChangesetConfig.test.ts
    ChangesetConfigReader.test.ts
    ConfigDiscovery.test.ts
    ManagedSection.test.ts
    SilkPublishability.test.ts
    TagStrategy.test.ts
    ToolDiscovery.test.ts
    VersioningStrategy.test.ts
  utils/
    ToolCommand.test.ts
  integration/
    ManagedSection.int.test.ts
    publishability.int.test.ts
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

Fixtures cover publishConfig permutations, workspace patterns, changeset configs, fixed/linked groups, private package handling and multi-registry targets.

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

### Why dual-format (CJS + ESM)?

silk-effects now builds both ESM and CJS. The driver is `@savvy-web/silk`: its config-integration
shims are dual-format because some external loaders `require()` them from CommonJS — notably
markdownlint-cli2's custom-rule loader, which loads `@savvy-web/silk/changesets/markdownlint` via a
CJS path. `silk` externals silk-effects, so silk's CJS output emits `require("@savvy-web/silk-effects")`,
which only resolves if silk-effects exposes a CJS entry. Dual-format here is therefore a hard
requirement of the consumer chain, not a convenience.

### Why host the three tool namespaces here?

The three dev-tooling packages couple their CLI commands to their config-export modules through
shared per-tool logic. The merge (sub-project 1) keeps `@savvy-web/cli` and `@savvy-web/silk` thin
with neither importing the other, which forces the shared logic into the one library both import —
silk-effects. The namespaces (`Changesets`, `Commitlint`, `Lint`) are that shared home. See the
[Tool Namespaces](#tool-namespaces-changesets-commitlint-lint) section.

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

`ChangesetConfigFile` matches the upstream `@changesets/config` spec so the module works with any changesets project. `SilkChangesetConfigFile` extends it for Silk-specific features without breaking compatibility. The high-level `ChangesetConfig` service then layers total, cached accessors (`mode`, `isIgnored`, `fixed`, …) over the raw file so callers — including the adaptive publishability detector — never handle decode failures themselves.

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
