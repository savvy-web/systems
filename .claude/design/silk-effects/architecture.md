---
module: silk-effects
category: architecture
status: current
completeness: 95
created: 2026-03-06
updated: 2026-07-03
last-synced: 2026-07-03
related:
  - ../silk/architecture.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
dependencies: []
---

# @savvy-web/silk-effects architecture

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

`@savvy-web/silk-effects` is a platform-agnostic Effect library providing Silk Suite-specific conventions. It extracts repeated patterns from across the ecosystem into a single shared package consumed by the Silk Suite repositories.

The library builds on the foundation libraries (`workspaces-effect`, `semver-effect`, `jsonc-effect`, `yaml-effect`) to provide higher-level, Silk-opinionated behavior for publishability detection, versioning strategy, tag formatting, managed sections, config discovery, Biome schema synchronization and CLI tool discovery.

silk-effects **also hosts the per-tool business logic** of the three standalone dev-tooling packages (`@savvy-web/changesets`, `@savvy-web/commitlint`, `@savvy-web/lint-staged`), exposed under three namespace exports — `Changesets`, `Commitlint` and `Lint`. This package is the shared layer that both thin consumers (`@savvy-web/cli` and `@savvy-web/silk`) import. See `../cli/architecture.md` and `../silk/architecture.md`.

`@savvy-web/mcp` (the `savvy-mcp` server) is a third consumer: it composes its own runtime layer from silk-effects services (notably `SilkWorkspaceAnalyzer`, `WorkspaceRoot` and `Turbo.TurboInspector`) plus `workspaces-effect`, and surfaces them as MCP tools. See `../mcp/architecture.md`.

A fourth namespace export, `Turbo`, adds read-only Turborepo inspection built on `ToolDiscovery`/`ToolCommand`. Unlike the three tool namespaces above it is not extracted CLI business logic — it is a small `Context.Tag` service plus pure digest transforms. See [Turbo Inspection](#turbo-inspection-turbo-namespace).

**Package:** `@savvy-web/silk-effects`, in `packages/silk-effects`. Platform-agnostic via `@effect/platform` — consumers provide their own platform layer. Built dual-format (esm + cjs) so config-integration consumers can `require()` it — see [Why dual-format](#why-dual-format-cjs--esm).

**Single root export:** all public API ships from the package root (`"."`); there are no sub-path exports. The three tool namespaces plus `Turbo` are re-exported from the root as `export * as Changesets` / `Commitlint` / `Lint` / `Turbo`. See `src/index.ts` for the full export surface, and the per-area source directories (`errors/`, `schemas/`, `services/`, `utils/`) for the implementation — each error is one `Data.TaggedError`, each value object a `Schema.TaggedClass`/`Schema.Class`, each service a `Context.Tag` with a Live layer.

A type that is flat-exported from the entry must carry its full type closure flat alongside it, not only inside a namespace. `CommitlintUserConfig` is flat-exported so a generated `commitlint.config.ts` can name it for declaration emit, but its fields reference `CommitlintPlugin`/`RulesConfig`/`PromptConfig` and their nested types — when those were reachable only via the `Commitlint` namespace, the bundler's API Extractor pass (now that forgotten-export diagnostics surface and fail CI — see `../tsdown-plugins/architecture.md`) flagged them as forgotten exports. `src/index.ts` flat-exports the whole reachable closure to keep the entry self-contained.

## Current State

Published and consumed by `@savvy-web/cli`, `@savvy-web/silk` and `@savvy-web/mcp`. All modules are implemented with unit, property-based and fixture-driven integration test coverage (see [Testing Strategy](#testing-strategy)). The current published version is in `packages/silk-effects/package.json`.

`SilkPublishability` resolves publish targets from the bundler's `dist/prod/targets.json` binding and recognizes only the keyed Record-map form of `publishConfig.targets` (see [Publish](#publish-silkpublishability)). The `Turbo` namespace adds read-only Turborepo inspection backing the MCP `turbo_inspect` tool (see [Turbo Inspection](#turbo-inspection-turbo-namespace)). The `Changesets` namespace runs on the **changesets v3 engine** (v3 prereleases included; the v1 packages adapter is gone). Changelog release lines are commit-link-free and changeset-less releases render a `### Maintenance` note — see the load-bearing bullets in [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint).

## Tool Namespaces (Changesets, Commitlint, Lint)

The business logic of the three standalone dev-tooling packages lives in silk-effects under three namespace objects. Each namespace is a self-contained subtree under `src/` (`src/changesets/`, `src/commitlint/`, `src/lint/`) with its own `index.ts` barrel.

| Namespace | Holds | Subtree |
| --- | --- | --- |
| `Changesets` | transformer, linter, changelog formatter, remark plugins + presets, markdownlint rules, services (`ConfigInspector`, `BranchAnalyzer`, `ReleasePlanner`, `DepsRegen`, …), schemas and the class API wrappers | `src/changesets/` |
| `Commitlint` | `CommitlintConfig` factory + `staticConfig`, DCO/scope detection, formatter, commitizen prompt adapter, hook logic | `src/commitlint/` |
| `Lint` | the per-tool handlers, `Preset`, `createConfig`, Command/Filter/Workspace utils, managed-section + template data | `src/lint/` |

This table is the topology, not an inventory — each subtree's `index.ts` is the authoritative listing of its contents.

Why these three live here rather than in `silk`: in each source package the CLI commands and the config-export modules share the tool's own internal logic (the changeset `transform` command and the `./remark` export run the same plugins; the `lint` command and the `./markdownlint` export run the same rules). `cli` must not import `silk`, so the shared logic has only one viable home — the library layer both thin packages import. `@savvy-web/cli` consumes the namespaces as command logic; `@savvy-web/silk` re-exports them as config-integration shims.

`ChangesetLinter.validateContent` (`src/changesets/api/linter.ts`) now enforces the dependency-table format: its remark pipeline runs `DependencyTableFormatRule` (plus `remark-gfm`, needed to parse GFM tables) alongside the existing structure rules, so a prose `## Dependencies` section is rejected by the same code path the CLI's `savvy changeset check`/`lint` and the MCP `changeset_validate` tool use — closing the split-brain where only the pre-commit markdownlint CSH005 rule enforced the table shape. Both rule engines share one version pattern: `VERSION_RE`, exported from `src/changesets/schemas/dependency-table.ts` and consumed by `VersionOrEmptySchema` and the markdownlint rule (which previously carried a hand-synced copy). It is widened to accept `catalog:`/`workspace:`/`npm:` (and other pnpm protocol) specifiers in addition to the em-dash sentinel and bare/`~`/`^` semver, so a `DepsRegen`-emitted raw protocol-string fallback (see below) is never rejected.

These `Changesets` decisions are load-bearing for consumers:

- **The `ConfigInspector` release-surface fallback.** When `.changeset/config.json` declares no explicit `packages` record, `ConfigInspector.inspect` does not return empty attribution — it builds package scopes from the discovered workspace packages that are a release surface, determined by calling the pure `SilkPublishability.detect` per package (the same publishConfig-driven rule the analyzer uses). A package with no publishConfig (e.g. a bare private root) is excluded. The changeset `ignore` list is intentionally NOT consulted — an ignored-but-configured package is still a valid changeset target. This is why `ConfigInspectorLive` carries a `FileSystem` requirement (it reads each package's `package.json` and `dist/prod/targets.json`). See the `buildFallbackScopes` helper in `src/changesets/services/config-inspector.ts`.
- **The resolved-output result types are Effect `Schema`, not interfaces.** `BranchAnalyzer` and `ConfigInspector` define their result shapes as `Schema.Struct` (all exported from the root) with the public TypeScript interfaces derived from them. The single source of truth lets `@savvy-web/mcp` embed these schemas directly in its `changeset_inspect` tool result and round-trip them through the effect→zod bridge. See `../mcp/architecture.md`.
- **`ReleasePlanner` drives the genuine `@changesets` engine, not hand-rolled logic.** `ReleasePlanner` (`src/changesets/services/release-planner.ts`, closes #125) backs changeset preview and apply with the real `@changesets/get-release-plan` + `@changesets/apply-release-plan` machinery, so all formatting — dependency tables included — comes from the engine and no changesets internals are re-implemented. The engine is the **changesets v3 line** (named exports, v3 prereleases): v3 consumes `@manypkg/get-packages@3.x` `Packages` directly, so the old v1 packages adapter (`buildPackages`) is gone and workspace discovery is a plain `getPackages(root)` call. v3's non-throwing `readConfig` is bridged so config errors land on the existing `ReleasePlanError` mapping and its warnings surface via `Effect.logWarning`; one caveat: v3's `readPreState` (run inside `getReleasePlan`) auto-migrates a legacy `pre.json` in place, so even the read-only `preview`/`plan` paths can touch disk. Its `preview(root)` is otherwise non-destructive: it runs the real `applyReleasePlan` against a `Scope`-managed temp directory (created via the platform `FileSystem`'s `makeTempDirectoryScoped`, auto-removed when the scope closes) and reads the rendered CHANGELOG blocks back, never mutating the repo. Its `apply(root, { dryRun, changelogModules })` is the destructive native release that the `savvy changeset version` CLI command now calls instead of shelling out to a `changeset` binary — it bumps versions, transforms each touched CHANGELOG via `ChangelogTransformer` and updates configured versionFiles through `ConfigInspector` + `VersionFiles`. `changelogModules` maps configured changelog ids to absolute module paths for callers in no-`node_modules` contexts (e.g. a bundled GitHub Action): when set, `config.changelog[0]` must be a key of the map (rewritten before the engine call; an unmapped id fails) and the engine's `format` integration is disabled — the caller owns formatting. `ReleasePlannerLive` requires `ConfigInspector` and `FileSystem` (the latter resolved once at construction and closed over so its methods stay `R = never`; it backs the preview path's scoped temp dir); its result schemas live in `src/changesets/schemas/release-plan.ts`. `apply` is intentionally NOT exposed over MCP — only the read-only `preview` is (see `../mcp/architecture.md` and `../cli/architecture.md`).
- **`DepsRegen` splits `plan()` from `execute()` so detect and regen share one code path.** `Changesets.DepsRegen` (`src/changesets/services/deps-regen.ts`) lifts the `deps regen`/`deps detect` orchestration out of the CLI into a `Context.Tag` service. `plan(options)` computes the cumulative dependency diff (merge-base→worktree by default, or explicit `from`/`to`) and returns a complete, side-effect-free `RegenPlan` — target filenames chosen up front, each row's From/To resolved, stale pure-dependency changesets marked for deletion; `execute(plan)` only applies the deletes and writes the plan already describes, so dry-run is exactly `plan()` plus rendering. **Both diff sides are snapshotted through `workspaces-effect`'s `PointInTimeWorkspace` service** — each side is read at its own ref (or the worktree via `PointInTimeWorkspace.worktree`) carrying its own catalogs, so `catalog:`/`workspace:` specifiers resolve **per side** to concrete versions *before* the two `WorkspaceStateSnapshot`s are diffed; rows whose resolved values are equal on both sides are suppressed (a specifier that changes protocol but not resolved version produces no row). This replaces the old post-diff `resolveDiffRows` pass and the deleted `WorkspaceSnapshotReader`/`snapshotFromWorktree` readers — the diff itself now lives in `src/changesets/utils/dep-diff.ts` over `WorkspaceStateSnapshot` pairs. `devDependency` rows are dropped unless `includeDevDeps` is set (the `deps detect` read path sets it to show the full diff; `deps regen` does not, since a dependency's devDeps never reach a consumer). `isPureDependencyChangeset` (exported) is the strict-detection rule: single-package frontmatter, exactly one `## Dependencies` heading, no other body content — mixed changesets are never touched. **Gating** (both writes and stale-changeset deletion): a package is in scope when it is `publishable OR privatePackages.version` **and** not on the changeset ignore list — the ignore list wins over an explicit `--package` target. All changeset file I/O flows through the `@effect/platform` `FileSystem` (writes are loud, deletes are tolerant/skip-and-continue, and the plan writes before it deletes so an interrupted run stays re-runnable), surfacing the new `ChangesetIOError`. `DepsRegenLive` requires `PointInTimeWorkspace | ConfigInspector | WorkspaceDiscovery | PublishabilityDetector | ChangesetConfig | FileSystem` (`PointInTimeWorkspace` and `PublishabilityDetector` from `workspaces-effect`; the `FileSystem` is resolved once at construction so `plan`/`execute` stay `R = never`). `plan()` fails with `GitError | WorkspaceDiscoveryError | ChangesetIOError | PointInTimeReadError`; `execute()` fails with `ChangesetIOError`. `gitMergeBase` relocated from the deleted reader's module to `src/changesets/utils/git.ts` (public export path `Changesets.gitMergeBase` unchanged). The CLI and MCP tools are thin adapters over this service (see `../cli/architecture.md` and `../mcp/architecture.md`).
- **`DepsRegenDefault` is the batteries-included layer.** `Changesets.DepsRegenDefault` composes the full `DepsRegen` dependency graph with silk's opinionated defaults — `PointInTimeWorkspaceLive`, `ConfigInspectorLive`, and the adaptive publishability detector (`PublishabilityDetectorAdaptiveLive`, the versionable-minus-ignored gating that matches the savvy CLI and MCP runtimes) — leaving only the platform services open: `R = FileSystem | Path | CommandExecutor`. Because `PointInTimeWorkspace` reads git history, it needs a `CommandExecutor`-capable platform layer (`NodeContext.layer`), not a bare filesystem layer. `DepsRegenLive` stays the seam for callers who inject their own dependencies (test detectors, alternate config sources); `DepsRegenDefault` is purely additive.
- **Release lines carry no commit-link prefixes; dependency tables carry their own heading.** Squash-merge workflows make per-changeset commit links point at squash commits, so `getReleaseLine` and `formatChangelogEntry` (`src/changesets/changelog/`) no longer inject `[short-hash](…)` prefixes into changelog lines — git history is the reference; authored links, issue refs and PR/user attribution are unchanged. A consequence: identical summaries from separate changesets now genuinely deduplicate (the hash prefix previously made every item unique, which had masked a `DeduplicateItemsPlugin` bug — its seen-set now spans all list nodes in a section, not one list, because `MergeSectionsPlugin` splices duplicate sections in as sibling lists). `getDependencyReleaseLine` prefixes its GFM table with a `### Dependencies` heading — the marker `AggregateDependencyTablesPlugin` uses to locate and merge per-package tables. `ChangelogTransformer.transformContent` iterates `SilkChangesetTransformPreset` (`src/changesets/remark/presets.ts`) rather than hand-listing plugins, so the transform chain cannot drift from the preset (a prior hand-list silently omitted `AggregateDependencyTablesPlugin`).
- **Changeset-less releases render a Maintenance note, never an empty version block.** A release with no changesets of its own (forced by a `fixed`/`linked` group co-member) is classified by the pure `deriveMaintenanceReason` (`src/changesets/services/maintenance-reason.ts`); group entries match via `ChangesetConfig.matches` (exact + `@scope/*`), a deliberate subset of the micromatch globs changesets accepts — richer globs degrade gracefully to a generic "unspecified" sentence instead of naming triggers. `MaintenanceNotePlugin` (`src/changesets/remark/plugins/maintenance-note.ts`) inserts the `### Maintenance` section but is deliberately NOT a preset member: it is parameterized per version block via `TransformOptions.maintenance` and only fires on a *structurally empty* block, so a dep-bump-only release (zero changesets but a Dependencies table) is left alone and the plugin is idempotent once the note exists. `ReleasePlanner` derives the reasons from the release plan and threads them into `ChangelogTransformer.transformFile` on both the `preview` and `apply` paths.

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
  turbo/                ← Turbo namespace (TurboInspector service + TurboDigest transforms)

__test__/                ← mirrors the source tree; integration tests under integration/
  integration/fixtures/workspaces/  ← workspace fixture tree (see Testing Strategy)
```

### Publish (SilkPublishability)

Silk publishability rules layered over `workspaces-effect`'s `PublishTarget` value object and `PublishabilityDetector` `Context.Tag`. There is one canonical target shape (`PublishTarget` from `workspaces-effect`) and silk-effects supplies the silk *rule* for producing it. Token resolution (`auth`/`tokenEnv`/OIDC) is a consumer concern, not part of this package.

`SilkPublishability` (`src/services/SilkPublishability.ts`) is an all-static class so the full rule surface is visible in one place: the pure `detect(pkgName, raw, binding)` (the silk targets-first rule), plus the Effects `resolveTargets` (detector + private-dist build filter) and `listPublishable` (discovery + detector). `readTargetsBinding(fs, pkgPath)` reads `<pkg>/dist/prod/targets.json`, returning `null` when missing/malformed (pre-build). See the source file for exact signatures.

**Binding-driven target resolution** is the load-bearing decision. `detect` recognizes only the bundler's keyed Record-map form of `publishConfig.targets` (`{ npm: true, github: true, … }`), and takes the parsed `dist/prod/targets.json` binding as its third argument (or `null` before the prod build has run):

- **With a binding** (post-prod-build): one `PublishTarget` per resolved registry target, with `directory = dist/prod/<group>/pkg` taken from the bound group — NOT `publishConfig.directory`. `npm: true` + `github: true` collapse into ONE byte-group (one tarball/dir) deployed to two registry targets.
- **Without a binding** (pre-build): one count-accurate placeholder `PublishTarget` per declared key, so publishability and target counts are correct even before the build.

`access` resolves to `publishConfig.access ?? "public"`; `provenance` defaults false. The `detect` precedence is: non-empty Record-map `targets` → publishable regardless of `private`; else `publishConfig.access` public/restricted → one target at `publishConfig.directory`; else `private !== true` → one default public target; else `[]`.

`RawPackageJson`/`RawPublishConfig` and the Record-map target types describe the unschematized `package.json`/`publishConfig` shape that `detect` consumes — silk rules read fields (notably `targets`) that the upstream `PublishConfig` schema strips. The binding types are `TargetsBinding`/`TargetBinding`/`TargetGroupBinding`.

**Detector layers** both override the `workspaces-effect` `PublishabilityDetector` Tag. `SilkPublishabilityDetectorLive` (requires `FileSystem`) applies the silk rule directly. `PublishabilityDetectorAdaptiveLive` (also requires `ChangesetConfig`) short-circuits changeset-ignored packages to `[]`, then dispatches on `ChangesetConfig.mode`: `none` → `[]`; `silk` → `SilkPublishability.detect`; `vanilla` → the upstream detector. Both layers read each package's binding via `readTargetsBinding` and thread it into `detect`, so post-build resolution uses the bundler's actual group layout and pre-build resolution falls back to declared-key placeholders.

### Versioning (ChangesetConfigReader, ChangesetConfig, VersioningStrategy)

Three services in `src/services/`: `ChangesetConfigReader` reads the raw config (depends on `FileSystem`), `ChangesetConfig` is a per-root cached accessor over it (`mode`, `versionPrivate`, `isIgnored`, `fixed`, …), and `VersioningStrategy.detect` derives the release strategy from the publishable packages.

`ChangesetConfig` (`src/services/ChangesetConfig.ts`) is total: every accessor has error channel `never`, so a missing or unreadable config collapses to `mode: "none"` with empty/false defaults. The static `ChangesetConfig.matches` is the single ignore-pattern matcher used across the package — exact name match, or `@scope/*` wildcard (the kept prefix includes the trailing slash, so `@scope/*` matches `@scope/anything` but not the bare `@scope`).

The bare name `ChangesetConfig` is the *service*. The decoded config *schema* types are `ChangesetConfigFile`/`SilkChangesetConfigFile` (`src/schemas/VersioningSchemas.ts`), and `ChangesetConfigReader.read` returns that union. `ChangesetConfigFile` matches the upstream `@changesets/config` spec; `SilkChangesetConfigFile` extends it with `_isSilk: true` when the `changelog` field references `@savvy-web/changesets`.

`VersioningStrategy` resolves one of three strategies: `"single"` (0-1 publishable packages), `"fixed-group"` (all publishable packages in one `fixed` group) or `"independent"` (multiple packages not in a single fixed group).

### Tags (TagStrategy)

`TagStrategy` (`src/services/TagStrategy.ts`) determines a `"single"` or `"scoped"` tag format from the versioning result and formats tags accordingly. The formats are the load-bearing constraint:

- Single: `1.2.3` (strict SemVer 2.0.0, no `v` prefix)
- Scoped + `@scope/pkg`: `@scope/pkg@1.2.3`
- Scoped + unscoped: `my-pkg@1.2.3`

### Managed Sections (ManagedSection + SectionDefinition)

Managed section pattern for tool-owned regions in user-editable files. The load-bearing design decision is the split between section *identity* and section *content* (see [the rationale](#why-sectiondefinition-separates-identity-from-content)):

- `SectionDefinition` (and the `#`-only `ShellSectionDefinition`) carries identity — tool name + comment style — and compares on identity. It is the factory for `SectionBlock`s via `block`/`generate`/`generateEffect`.
- `SectionBlock` carries the actual managed lines and compares on *normalized* content (trimmed, whitespace-collapsed), so cosmetic whitespace changes don't register as edits.

The `ManagedSection` service (`src/services/ManagedSection.ts`, depends on `FileSystem`) reads, writes, syncs, checks and removes these sections. All methods support a dual API (data-first and data-last). Identity-only operations (`read`, `isManaged`, `remove`) accept a `SectionDefinition`; content operations (`write`, `sync`, `syncMany`, `check`) accept a `SectionBlock`. See the source for exact signatures.

Two methods have subtle, load-bearing semantics:

- `syncMany` is the multi-section compositor: it ensures every listed block exists with the given content in declared relative order, updating present sections in place, inserting a missing section adjacent to its declared sibling (before the nearest present successor, else after the nearest present predecessor, else appended) and normalizing order when sections are present but out of order. It preserves user content before, after and between managed sections, leaves unrelated tool sections in place, returns one content-based `SyncResult` per input block in input order (a pure reorder of identical content reports `Unchanged`) and is idempotent.
- `remove` deletes a section's `[begin … end]` span including markers, returning `true` if removed and `false` if the section or file was absent (a missing file is not an error). It collapses the leftover blank line so repeated edits never accumulate gaps. The primary use is rename-migration: a consumer removes its old-name section and `syncMany`s the new one.

**Marker format:**

```text
# --- BEGIN {TOOL_NAME} MANAGED SECTION ---
managed content here
# --- END {TOOL_NAME} MANAGED SECTION ---
```

Supports `#` and `//` comment styles. Preserves user content outside markers.

#### SavvySections (shared husky-hook shells)

`src/schemas/SavvySections.ts` centralizes the shell content the Silk Suite husky hooks share, so consumer CLIs no longer hand-write package-manager detection. Two consumers drive it: `@savvy-web/commitlint` (`savvy-commit`) and `@savvy-web/lint-staged` (`savvy-lint`). It exports `SavvyBaseSection`/`savvyBasePreamble()` (the package-manager-detection preamble: `ROOT`, `in_ci`, `detect_pm`/`PM`, `pm_exec`), `SavvyHooksSection`/`savvyHooksHygiene()` (self-guarded `core.fileMode` + `chmod +x`) and `savvyToolSection(toolName, command)`.

The composition contract is the load-bearing part. `savvyToolSection` produces a one-line block whose content is exactly `in_ci || pm_exec <command>` with `command` appended verbatim — no parsing, quoting or interpolation, so shell tokens like `$ROOT` and `$1` survive into the literal. Its precondition is that a `savvy-base` section precedes it in the same hook file so `in_ci`/`pm_exec` are defined; consumers satisfy this by passing `[SavvyBaseSection.block(savvyBasePreamble()), savvyToolSection(…)]` to `syncMany` in that order. `pm_exec` uses local/exec semantics per package manager and `bun x` (space form, not the `bunx` shim) so it works regardless of how bun was installed. See `SavvySections.ts` for the exact shell bodies.

### Config (ConfigDiscovery)

`ConfigDiscovery` (`src/services/ConfigDiscovery.ts`, depends on `FileSystem`) finds config files following the Silk convention, searching `{cwd}/lib/configs/{name}` (source `"lib"`) before `{cwd}/{name}` (source `"root"`).

### Biome (BiomeSchemaSync)

`BiomeSchemaSync` (`src/services/BiomeSchemaSync.ts`, depends on `FileSystem`) scans for `biome.json`/`biome.jsonc`, compares the `$schema` URL against the expected version and optionally updates it in place. It strips semver range prefixes (`^`, `~`, `>=`).

### Tool Discovery (ToolDiscovery)

CLI tool resolution — locating tools globally (PATH) or locally (via package manager), extracting versions, enforcing source and version constraints and caching results. `ToolDiscovery` (`src/services/ToolDiscovery.ts`) depends on `CommandExecutor`, `PackageManagerDetector` and `WorkspaceRoot`; results are cached by tool name (Ref-based Map) and `clearCache` resets the cache.

Two value objects are load-bearing here. `ToolDefinition` (a plain class — see [Value Object Patterns](#value-object-patterns)) carries the tool name plus the resolution policy/source/version-extractor enums and compares on name only. `ResolvedTool` (`Schema.TaggedClass`) carries the resolution result and exposes `exec(...)`/`dlx(...)`, which return a [`ToolCommand`](#toolcommand-util). See the source for fields and methods.

### ToolCommand (util)

`ToolCommand` (`src/utils/ToolCommand.ts`) is a thin wrapper around `@effect/platform` `Command.Command` providing instance-method ergonomics (`string`, `lines`, `exitCode`, `stream`, plus chainable `env`/`workingDirectory`/`stdin`). Returned by `ResolvedTool.exec()` and `ResolvedTool.dlx()`.

### Workspace Analysis (SilkWorkspaceAnalyzer)

`SilkWorkspaceAnalyzer` (`src/services/SilkWorkspaceAnalyzer.ts`) is the composite service that orchestrates full workspace analysis — discovering packages, detecting publishability, computing versioning/tag strategies and wiring up fixed/linked release groups — behind a single `analyze(root)` entry point. Its Live layer requires `FileSystem`, `WorkspaceDiscovery`, `TopologicalSorter`, `PackageManagerDetector`, `ChangesetConfigReader`, `VersioningStrategy` and `TagStrategy`. See [the rationale](#why-composite-silkworkspaceanalyzer).

The result types are two `Schema.TaggedClass` value objects in `src/schemas/WorkspaceAnalysisSchemas.ts`. `AnalyzedWorkspace` is the per-package record (name, version, path, publishability, targets, release flags, and `linked`/`fixed` group cross-references held via `Schema.suspend` for the cycle); its `toJSON` omits `linked`/`fixed` to avoid cycles. `WorkspaceAnalysis` is the top-level result (workspaces, changeset config, versioning, tag strategy, plus query accessors like `findWorkspace` and `publishableWorkspaces`). The same file holds `SilkPublishConfig` (upstream `PublishConfig` extended via `PublishConfig.extend()` with the Silk `targets` field) and the `targets` *input* schemas `PublishTargetShorthand`/`PublishTargetObject` — distinct from the output `PublishTarget` value object that `SilkPublishability.detect` produces. See the source for the full member list.

The analyzer does not depend on a publishability *service*: it reads each package's raw `package.json` plus its `dist/prod/targets.json` binding (via `readTargetsBinding`, `null` pre-build) and calls `SilkPublishability.detect` directly. Two pipeline details are load-bearing:

- Discovery is passed the requested `root` so it resolves the right workspace even when the layer was built from a different working directory (e.g. a server launched from a subdirectory, or a test). The topo reorder falls back to discovery order when the (possibly rootless) topo sort does not contain the discovered package names.
- `computeReleaseStatus` derives the `versioned`/`tagged`/`released` flags from the changeset config: no config → all `false`; an `ignore`-matched package (via `ChangesetConfig.matches`, so `@scope/*` wildcards apply — not exact-string `.includes`) → all `false`; a publishable package → all `true`; a truly private package consults `privatePackages` (`undefined`/`false` → all `false`; `{ version, tag }` → flags match config, with `released = versioned && tagged`).

`ChangesetConfigFile` (`src/schemas/VersioningSchemas.ts`) covers the full upstream `@changesets/config` spec; `SilkChangesetConfigFile` extends it with the `_isSilk` marker.

### Turbo Inspection (Turbo namespace)

The `Turbo` namespace (`src/turbo/`, re-exported from the root as `export * as Turbo`) provides read-only Turborepo introspection. **Every operation invokes `turbo run … --dry=json` and never executes a task** — this is the load-bearing safety invariant of the whole namespace. It exists to back the MCP `turbo_inspect` tool (see `../mcp/architecture.md`); the cache-miss and graph reasoning lives here so the tool file stays glue.

The namespace splits into a service for I/O and a pure transformer for the math, mirroring the rest of the package. `TurboInspector` (`Context.Tag`) exposes `diagnoseCache` (per-package HIT/MISS + per-miss hash-contributor breakdown), `taskGraph` (nodes + memoized-DFS critical path) and `affected` (changed packages + their dependents), all failing with the `TurboError` union. `TurboDigest` (all-static class) holds the pure transforms from a decoded `TurboDryRun` into the three flat result shapes — no DI, directly unit-testable. See `src/turbo/services/TurboInspector.ts` and `src/turbo/digest.ts`.

`TurboInspectorLive` requires `ToolDiscovery | CommandExecutor | FileSystem`. It mirrors `ToolDiscoveryLive`'s discharge pattern: the `CommandExecutor` is captured at layer construction and re-provided onto each command effect with `Effect.provideService`, keeping the public method effects at `R = never`. The methods take an explicit `cwd` (the MCP handler resolves the workspace root and passes it); the layer guards on a `turbo.json` at that `cwd` (`NotATurboRepoError`) before shelling out via a `ToolDefinition.make({ name: "turbo" })` resolution.

**Schemas** (`src/turbo/schemas/`): `TurboDryRun` is the input decode shape for `turbo … --dry=json`; `CacheDiagnosis`, `TaskGraphResult` and `AffectedResult` are the deliberately **flat, bridge-safe** result shapes — no recursion, so the MCP's Effect-Schema→zod bridge round-trips them cleanly. See the structs in `src/turbo/schemas/results.ts`.

**Errors** (`src/turbo/errors.ts`): the `TurboError` union — `TurboNotInstalledError` (binary unresolvable), `NotATurboRepoError` (no `turbo.json`), `DryRunParseError` (bad JSON / decode failure) and `TurboExecError` (non-zero exit). `TurboNotInstalledError` and `TurboExecError` are intentionally distinct so callers can tell "turbo absent" from "turbo ran and failed".

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
export type SectionDiff = Data.TaggedEnum<{
  readonly Unchanged: {};
  readonly Changed: { readonly added: ReadonlyArray<string>; readonly removed: ReadonlyArray<string> };
}>;
export const SectionDiff = Data.taggedEnum<SectionDiff>();
```

This pattern is used for `ManagedSection` results (`SectionDiff`, `SyncResult`, `CheckResult`) and the `ToolDefinition` configuration enums (`VersionExtractor`, `ResolutionPolicy`, `SourceRequirement`). See the schema source files for the variants.

## Dependencies

```text
@savvy-web/silk-effects
  ├── effect (peer)
  ├── @effect/platform (peer)
  ├── workspaces-effect (direct)
  ├── semver-effect (direct)
  ├── jsonc-effect (direct)
  └── yaml-effect (direct)
```

`effect` and `@effect/platform` are peers (consumers already depend on them); the four foundation Effect libraries are direct dependencies. The `Changesets` namespace also depends on the genuine changesets engine at runtime — `@changesets/get-release-plan`, `@changesets/apply-release-plan`, `@changesets/config` and `@manypkg/get-packages` back `ReleasePlanner`, all on the changesets **v3** line (see the third load-bearing bullet in [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint)). The vendored `src/changesets/vendor/github-info.ts` adapter wraps v1 `@changesets/get-github-info`'s `getCommitInfo` and folds its structured, possibly-`undefined` result back into the legacy `GitHubCommitInfo` shape so the changelog pipeline is unaffected. See `package.json` for the complete dependency list.

**Runtime requirement:** Consumers must provide a platform layer (`NodeContext.layer`, `BunContext.layer`, etc.) for modules that use `FileSystem` or `CommandExecutor`.

**Modules requiring FileSystem:**

- `ManagedSection` / `ManagedSectionLive`
- `ConfigDiscovery` / `ConfigDiscoveryLive`
- `BiomeSchemaSync` / `BiomeSchemaSyncLive`
- `ChangesetConfigReader` / `ChangesetConfigReaderLive`
- `SilkPublishabilityDetectorLive` (override of `workspaces-effect`'s `PublishabilityDetector`)
- `PublishabilityDetectorAdaptiveLive` (also requires `ChangesetConfig`)
- `Changesets.ConfigInspectorLive` (also requires `ChangesetConfigReader` + `WorkspaceDiscovery`; `FileSystem` backs its release-surface fallback — see [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint))

**Modules requiring CommandExecutor + PackageManagerDetector + WorkspaceRoot:**

- `ToolDiscovery` / `ToolDiscoveryLive`

**Modules requiring ToolDiscovery + CommandExecutor + FileSystem:**

- `Turbo.TurboInspector` / `Turbo.TurboInspectorLive` (`TurboDigest` itself is pure)

**Modules requiring ChangesetConfigReader:**

- `ChangesetConfig` / `ChangesetConfigLive`
- `VersioningStrategy` / `VersioningStrategyLive`

**Composite modules (FileSystem + multiple upstream services):**

- `SilkWorkspaceAnalyzer` / `SilkWorkspaceAnalyzerLive`
  Depends on: `FileSystem`, `WorkspaceDiscovery`, `TopologicalSorter`, `PackageManagerDetector`,
  `ChangesetConfigReader`, `VersioningStrategy`, `TagStrategy`
- `Changesets.DepsRegen` / `Changesets.DepsRegenLive`
  Depends on: `PointInTimeWorkspace`, `ConfigInspector`, `WorkspaceDiscovery`, `PublishabilityDetector`,
  `ChangesetConfig`, `FileSystem` (`PointInTimeWorkspace` + `PublishabilityDetector` from `workspaces-effect`;
  all changeset file I/O goes through the `FileSystem` Tag, resolved once at construction so `plan`/`execute` stay `R = never`)
- `Changesets.DepsRegenDefault` (batteries-included)
  Requires only `FileSystem | Path | CommandExecutor` — composes `PointInTimeWorkspaceLive`, `ConfigInspectorLive`
  and `PublishabilityDetectorAdaptiveLive` internally; needs a git-capable platform layer (`NodeContext.layer`)
- `Changesets.ReleasePlanner` / `Changesets.ReleasePlannerLive`
  Depends on: `ConfigInspector`, `FileSystem` (the `FileSystem` backs the preview path's `Scope`-managed temp dir)

**Pure modules (no platform requirements):**

- `SilkPublishability` (all-static class — `detect` is pure; `resolveTargets`/`listPublishable` are
  Effects requiring the `PublishabilityDetector` Tag; `readTargetsBinding` is an `Effect` requiring `FileSystem`)
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

`SilkPublishability.detect` is a pure function over a raw `package.json` plus the bundler's resolved `dist/prod/targets.json` binding (`null` pre-build), returning `workspaces-effect` `PublishTarget` records:

```typescript
const targets = SilkPublishability.detect(
  "@my-org/pkg",
  { private: true, publishConfig: { access: "public", targets: { npm: true, github: true } } },
  null, // pre-build: one count-accurate placeholder per declared key
);
// → with a binding: one PublishTarget per resolved registry target (npm+github collapse to one group)
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

Tests live in `__test__/`, mirroring the source tree, with integration tests under `__test__/integration/`. Those run against a hierarchical fixture tree (`__test__/integration/fixtures/workspaces/`) organized by runtime (standalone, node, bun), package manager (pnpm, npm, yarn) and Silk-vs-default configuration. The fixtures cover publishConfig permutations, workspace patterns, changeset configs, fixed/linked groups, private-package handling and multi-registry targets — they double as living documentation of the supported workspace layouts.

Four test approaches are used:

- **Unit tests** (schemas, errors, utils): verify construction, encoding/decoding, Equal/Hash semantics, getters and static methods.
- **Property-based tests**: use `fast-check` to lock down class invariants (e.g. `AnalyzedWorkspace` Equal/Hash consistency) independent of implementation details.
- **Service tests**: provide mock layers and verify service contract behavior.
- **Integration tests**: run `SilkWorkspaceAnalyzer.analyze` against the real fixture directories using the `@effect/platform-node` filesystem, catching schema-decode and service-composition errors that unit tests miss.

`Pretty.make` is wired on `AnalyzedWorkspace` and `WorkspaceAnalysis` for debugging and test-output readability.

## Rationale

### Why platform-agnostic?

The library is consumed by GitHub Actions (Node.js), CLI tools (Node.js), and potentially
Bun-based tools. Using `@effect/platform` abstractions ensures compatibility across all
runtimes without requiring separate implementations.

### Why extract these patterns?

These patterns were independently implemented across several repos. Extracting them eliminates duplication, ensures consistent behavior and provides a single point for version-bumping the shared logic.

### Why `effect` and `@effect/platform` as peer dependencies?

Consumers already depend on both. Bundling them would cause version conflicts and bloated output. As peers, consumers get a single copy.

### Why dual-format (CJS + ESM)?

The driver is `@savvy-web/silk`: its config-integration shims are dual-format because some external loaders `require()` them from CommonJS — notably markdownlint-cli2's custom-rule loader, which loads `@savvy-web/silk/changesets/markdownlint` via a CJS path. `silk` externalizes silk-effects, so silk's CJS output emits `require("@savvy-web/silk-effects")`, which only resolves if silk-effects exposes a CJS entry. Dual-format here is a hard requirement of the consumer chain, not a convenience.

### Why host the three tool namespaces here?

The three dev-tooling packages couple their CLI commands to their config-export modules through shared per-tool logic. Keeping `@savvy-web/cli` and `@savvy-web/silk` thin with neither importing the other forces that shared logic into the one library both import — silk-effects. The namespaces (`Changesets`, `Commitlint`, `Lint`) are that shared home. See the [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint) section.

### Why SectionDefinition separates identity from content?

Separating section identity (`SectionDefinition` — tool name + comment style) from section content (`SectionBlock` — the actual managed lines) enables typed factories via `generate`/`generateEffect`, distinct Equal/Hash semantics (definitions compare on identity, blocks on normalized content), validation hooks attached to a definition rather than inline, and a cleaner service API where identity operations take a `SectionDefinition` while write/sync/check take a `SectionBlock`.

### Why role-based folders instead of domain folders?

The role-based layout (`errors/`, `schemas/`, `services/`, `utils/`) with a single root export keeps the build simple (one entry point, no sub-paths) and the consumer experience flat (everything imports from the package root), rather than organizing by domain and forcing consumers to know which sub-path to import from.

### Why layered changeset config?

`ChangesetConfigFile` matches the upstream `@changesets/config` spec so the module works with any changesets project. `SilkChangesetConfigFile` extends it for Silk-specific features without breaking compatibility. The high-level `ChangesetConfig` service then layers total, cached accessors over the raw file so callers — including the adaptive publishability detector — never handle decode failures themselves.

### Why composite SilkWorkspaceAnalyzer?

Workspace analysis coordinates several services in a specific order with error mapping between boundaries. A single composite service provides one entry point for consumers who need a full workspace picture, hiding the orchestration complexity. The individual services remain available for consumers who only need one piece (e.g. just publishability or just tag strategy).

### Why fixture-driven integration tests?

Schema-decode errors, service-composition bugs and filesystem edge cases only surface against real directory structures. The fixture tree captures real-world workspace layouts that exercise the full analysis pipeline end-to-end, and the fixtures double as living documentation of the supported workspace patterns.
