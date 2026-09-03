---
module: silk-effects
category: architecture
status: current
completeness: 90
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ./changesets.md
  - ./hook-sections.md
  - ../tsdown-plugins/architecture.md
  - ../mcp/architecture.md
---

# Publishability and workspace analysis

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Publishability (SilkPublishability)](#publishability-silkpublishability)
- [Changeset config (ChangesetConfigReader, ChangesetConfig)](#changeset-config-changesetconfigreader-changesetconfig)
- [Tags](#tags)
- [Workspace analyzer (SilkWorkspaceAnalyzer)](#workspace-analyzer-silkworkspaceanalyzer)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

The Silk publishability rule, the changeset-config accessors and the composite workspace analyzer are the root-level services of silk-effects (`src/services/`, schemas in `src/schemas/`). They sit over `@effected/workspaces`: the kit supplies discovery, the `PublishTarget` value object, the `PublishabilityDetector` tag and the versioning/tag value classes; this package supplies the one thing the kit refuses to read for itself — Silk's `publishConfig` conventions and one release tool's config file.

## Current state

Implemented and consumed by `cli`, `mcp` (`SilkWorkspaceAnalyzer` backs workspace tools) and the `Changesets` namespace (`ConfigInspector` and `DepsRegen` call the same `detect`). Fixture-driven integration tests live in `__test__/integration/`.

## Publishability (SilkPublishability)

`SilkPublishability` (`src/services/SilkPublishability.ts`) is an all-static class so the whole rule surface is visible in one place: the pure `detect(pkgName, raw, binding)`, the Effects `resolveTargets` and `listPublishable` and two detector layers. `readTargetsBinding(fs, pkgPath)` reads `<pkg>/dist/prod/targets.json` and returns `null` when it is missing or malformed (pre-build). Token resolution (`auth`/`tokenEnv`/OIDC) is a consumer concern.

**Binding-driven target resolution is the load-bearing decision.** `detect` recognizes only the bundler's keyed Record-map form of `publishConfig.targets` (`{ npm: true, github: true, … }`) and takes the parsed `targets.json` binding as its third argument:

- With a binding (post-prod-build): one `PublishTarget` per resolved registry target, `directory` taken from the bound group (`dist/prod/<group>/pkg`), never from `publishConfig.directory`. `npm` and `github` collapse into one byte-group deployed to two registries.
- Without a binding (pre-build): one count-accurate placeholder target per declared key, so publishability and target counts are right before the build.

The precedence is targets-first: a non-empty Record-map `targets` makes the package publishable regardless of `private`; else `publishConfig.access` yields one target at `publishConfig.directory`; else `private !== true` yields one default public target; else none. `RawPackageJson`/`RawPublishConfig` describe the unschematized manifest shape `detect` reads, because the upstream `PublishConfig` schema strips `targets`. The `targets.json` contract itself is the bundler's — see `../tsdown-plugins/architecture.md`.

Both detector layers override the kit's `PublishabilityDetector`. `layer` applies the silk rule directly. `layerAdaptive` (also requires `ChangesetConfig`) short-circuits changeset-ignored packages to no targets, then dispatches on `ChangesetConfig.mode`: `none` → nothing, `silk` → `detect`, `vanilla` → the upstream `PublishabilityDetector.npm` value. Both read each package's binding through `readTargetsBinding`.

## Changeset config (ChangesetConfigReader, ChangesetConfig)

`ChangesetConfigReader` reads and decodes `.changeset/config.json` (requires `FileSystem`); `ChangesetConfig` is a per-root cached accessor over it (`mode`, `versionPrivate`, `isIgnored`, `fixed`, …). The bare name `ChangesetConfig` is the *service*; the decoded file types are `ChangesetConfigFile` (the upstream `@changesets/config` spec) and `SilkChangesetConfigFile` (adds `_isSilk: true` when `changelog` references the Silk changelog module), in `src/schemas/VersioningSchemas.ts`.

Two properties matter to callers:

- **`ChangesetConfig` is total.** Every accessor has error channel `never`; a missing or unreadable config collapses to `mode: "none"` with empty defaults, so consumers such as the adaptive detector never handle decode failures.
- **The cache never self-expires.** `refresh()` is the escape hatch a long-lived host (the `savvy-mcp` server holds one instance per process) calls to observe an on-disk edit. `Changesets.ConfigInspector` carries the same cache and a matching `refresh`, and `DepsRegen.plan` refreshes both first — see [Changesets](./changesets.md).

The static `ChangesetConfig.matches` is the single ignore-pattern matcher in the package: exact name, or `@scope/*` where the kept prefix includes the slash (`@scope/*` matches `@scope/anything`, not bare `@scope`). It is a deliberate subset of the micromatch globs changesets accepts.

## Tags

Tag formatting is kit-owned (`ReleaseTag`, `TrackingTag`, `classifyTag`, `TagStyle`). The formats are still the Silk constraint and so are recorded here: single-package repos tag `1.2.3` (strict SemVer, no `v`), scoped packages `@scope/pkg@1.2.3`, unscoped `my-pkg@1.2.3`. `classifyTag` is total; there is no format error to handle.

## Workspace analyzer (SilkWorkspaceAnalyzer)

`SilkWorkspaceAnalyzer` (`src/services/SilkWorkspaceAnalyzer.ts`) is the composite: `analyze(root)` discovers packages, detects publishability, classifies versioning and wires fixed/linked release groups behind one entry point. Its `layer` annotation names the requirements (`FileSystem`, `WorkspaceDiscovery`, `PackageManagerDetector`, `ChangesetConfigReader`); versioning contributes none, because `VersioningStrategy.classify` is a pure kit operation fed the `fixed` groups from the config the pipeline already read.

The result types are two `Schema.TaggedClass` value objects in `src/schemas/WorkspaceAnalysisSchemas.ts`. `AnalyzedWorkspace` is the per-package record, with `linked`/`fixed` cross-references held via `Schema.suspend` and excluded from `toJSON` and the hash to break the cycle. `WorkspaceAnalysis` is the top-level result; its `versioning` is a nullable kit `VersioningStrategy` and `tagStrategy` a nullable kit `TagStyle`. The same file holds `SilkPublishConfig` (upstream `PublishConfig` extended with the Silk `targets` field) and the target *input* schemas, distinct from the `PublishTarget` output that `detect` produces.

Three pipeline details are load-bearing:

- The analyzer does not depend on a publishability *service*: it reads each package's raw manifest plus its `targets.json` binding and calls `SilkPublishability.detect` directly.
- Discovery is passed the requested `root`, so the layer answers for the right workspace even when built from another directory. Topological order comes from the pure `DependencyGraph.make({ packages }).sort()`, falling back to discovery order when the sort does not cover the discovered names.
- `computeReleaseStatus` derives `versioned`/`tagged`/`released` from the changeset config: no config → all false; an ignore match (via `ChangesetConfig.matches`, so wildcards apply) → all false; a publishable package → all true; a truly private package follows `privatePackages` (`{ version, tag }` → flags match, `released = versioned && tagged`).

## Rationale

### Why the publishability rule is pure and static

`detect` runs in three places (the analyzer, `ConfigInspector`'s release-surface fallback, the adaptive detector). A pure function over raw data is the only shape all three can share without dragging a layer graph along, and it is what lets the rule be unit-tested against every `publishConfig` permutation in the fixture tree.

### Why layered changeset config

`ChangesetConfigFile` matches the upstream spec so the module works with any changesets project; `SilkChangesetConfigFile` extends it without breaking compatibility; the total `ChangesetConfig` service on top means callers never branch on decode failure.

### Why a composite analyzer

Workspace analysis coordinates several services in a fixed order with error mapping at each boundary. One composite gives consumers who need the full picture a single entry point, while the pieces stay available to those who need only one.

## Related documentation

- [Architecture overview](./architecture.md)
- [Changesets namespace](./changesets.md) — `ConfigInspector` and `DepsRegen` reuse `detect` and `ChangesetConfig`
- [`../tsdown-plugins/architecture.md`](../tsdown-plugins/architecture.md) — the `dist/prod/targets.json` binding contract
- [`../mcp/architecture.md`](../mcp/architecture.md) — the analyzer as an MCP tool backend
