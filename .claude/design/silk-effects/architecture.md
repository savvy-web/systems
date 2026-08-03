---
module: silk-effects
category: architecture
status: current
completeness: 95
created: 2026-03-06
updated: 2026-07-26
last-synced: 2026-07-26
related:
  - ../silk/architecture.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
  - ../testing/effect-vitest.md
dependencies: []
---

# @savvy-web/silk-effects architecture

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [What the kit owns now](#what-the-kit-owns-now)
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

The library builds on the `@effected/*` kit (`workspaces`, `commands`, `templates`, `git`, `glob`, `jsonc`, `package-json`, `walker`, `yaml`) to provide higher-level, Silk-opinionated behavior for publishability detection, workspace analysis, changesets configuration, config discovery, Biome schema synchronization and the shared hook-section content.

**The seam is policy-versus-mechanism, and it moved.** Generic mechanisms that once lived here — versioning/tag classification, CLI tool discovery, the managed-section engine — are now kit surfaces, and silk-effects keeps only the Silk *policy* layered over them. See [What the kit owns now](#what-the-kit-owns-now) for the exact map; the short version is that a service deleted from this package was not lost, it was upstreamed.

silk-effects **also hosts the per-tool business logic** of the three standalone dev-tooling packages (`@savvy-web/changesets`, `@savvy-web/commitlint`, `@savvy-web/lint-staged`), exposed under three namespace exports — `Changesets`, `Commitlint` and `Lint`. This package is the shared layer that both thin consumers (`@savvy-web/cli` and `@savvy-web/silk`) import. See `../cli/architecture.md` and `../silk/architecture.md`.

`@savvy-web/mcp` (the `savvy-mcp` server) is a third consumer: it composes its own runtime layer from silk-effects services (notably `SilkWorkspaceAnalyzer`, `WorkspaceRoot` and `Turbo.TurboInspector`) plus the `@effected/*` kit, and surfaces them as MCP tools. See `../mcp/architecture.md`.

A fourth namespace export, `Turbo`, adds read-only Turborepo inspection built on `@effected/commands` (`ToolDiscovery` + `Tool` + `Run`). Unlike the three tool namespaces above it is not extracted CLI business logic — it is a small `Context.Service` plus pure digest transforms. See [Turbo Inspection](#turbo-inspection-turbo-namespace). A fifth, `Repos`, owns the vendored-reference-repo manifest and submodule plumbing.

**Package:** `@savvy-web/silk-effects`, in `packages/silk-effects`. Platform-agnostic via effect's in-core platform abstractions — consumers provide their own platform layer. Built dual-format (esm + cjs) so config-integration consumers can `require()` it — see [Why dual-format](#why-dual-format-cjs--esm).

**Single root export:** all public API ships from the package root (`"."`); there are no sub-path exports. The three tool namespaces plus `Turbo` are re-exported from the root as `export * as Changesets` / `Commitlint` / `Lint` / `Turbo`. See `src/index.ts` for the full export surface, and the per-area source directories (`errors/`, `schemas/`, `services/`, `utils/`) for the implementation — each error is one `Data.TaggedError`, each value object a `Schema.TaggedClass`/`Schema.Class`, each service a `Context.Service` with a Live layer.

A type that is flat-exported from the entry must carry its full type closure flat alongside it, not only inside a namespace. `CommitlintUserConfig` is flat-exported so a generated `commitlint.config.ts` can name it for declaration emit, but its fields reference `CommitlintPlugin`/`RulesConfig`/`PromptConfig` and their nested types — when those were reachable only via the `Commitlint` namespace, the bundler's API Extractor pass (now that forgotten-export diagnostics surface and fail CI — see `../tsdown-plugins/architecture.md`) flagged them as forgotten exports. `src/index.ts` flat-exports the whole reachable closure to keep the entry self-contained.

## Current State

Published and consumed by `@savvy-web/cli`, `@savvy-web/silk` and `@savvy-web/mcp`. All modules are implemented with unit, property-based and fixture-driven integration test coverage (see [Testing Strategy](#testing-strategy)). The current published version is in `packages/silk-effects/package.json`.

`SilkPublishability` resolves publish targets from the bundler's `dist/prod/targets.json` binding and recognizes only the keyed Record-map form of `publishConfig.targets` (see [Publish](#publish-silkpublishability)). The `Turbo` namespace adds read-only Turborepo inspection backing the MCP `turbo_inspect` tool (see [Turbo Inspection](#turbo-inspection-turbo-namespace)). The `Changesets` namespace runs on the **changesets v3 engine** (v3 prereleases included; the v1 packages adapter is gone). Changelog release lines are commit-link-free and changeset-less releases render a `### Maintenance` note — see the load-bearing bullets in [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint).

## What the kit owns now

The `@effected` github-split wave (kit releases: `commands`/`templates` 0.1.0, `workspaces` 0.9.0, `npm` 0.5.0, `package-json` 0.6.0) took three mechanisms out of this package. The table is the migration map — read it before going looking for a service that a stale note, an old test name or an action repo still mentions.

| Deleted from silk-effects | Now in the kit | Shape change worth knowing |
| --- | --- | --- |
| `VersioningStrategy` service + `VersioningStrategyResult`/`VersioningStrategyType` schemas + `VersioningDetectionError` | `@effected/workspaces` `VersioningStrategy` | A **value class**, not a service. `VersioningStrategy.classify({ packages, fixedGroups })` is pure and **total** (hence no error type), `VersioningStrategy.detect({ fixedGroups })` is the Effect that enumerates the workspace itself, and `tagsFor` is an instance method. |
| `TagStrategy` service + `TagStrategySchemas` + `TagFormatError` | `@effected/workspaces` `TagStyle`, `ReleaseTag`, `TrackingTag`, `classifyTag` | Also values. The tag style follows from the classification (`versioning.tagStyle`), so there is no second service call and no separate determination step. |
| `ToolDiscovery` service + `ToolDefinition`/`ResolvedTool`/`ToolResults` schemas + `ToolNotFoundError`/`ToolResolutionError`/`ToolVersionMismatchError` + the `ToolCommand` util | `@effected/commands` `ToolDiscovery` (`resolve`/`isAvailable`/`invalidate`/`invalidateAll`), `Tool.named`, the `Run` free functions | `ResolvedTool.command(...)` returns a core `ChildProcess.Command` rather than a bespoke wrapper, and the caller pipes it through `Run.text`/`Run.lines`/`Run.exitCode`. Resolution failure is a four-member union whose members carry no `reason` field — map from `e.message`. |
| `ManagedSection` service + `SectionDefinition`/`SectionBlock`/`SectionResults`/`CommentStyle` schemas + `SectionParseError`/`SectionValidationError`/`SectionWriteError` | `@effected/templates` `ManagedSection`, `Section`, `SectionId`, `CommentStyle` | Data-first, and the outcome enums flattened: `CheckOutcome` is `UpToDate`/`Drifted`/`Absent` (previously a nested `Found` + `isUpToDate` boolean), `syncMany` is now `syncAll`, and `read` returns an `Option`. |
| `Changesets.MarkdownService`/`MarkdownLive` | — (deleted outright) | Pure indirection with zero call sites. The changesets engine still uses mdast/remark internally; removing it narrowed `ChangelogService`'s `R` to `GitHubService` alone. |

Two consequences are load-bearing:

- **`src/index.ts` re-exports nothing from the kit.** Consumers import `ManagedSection`, `VersioningStrategy`, `Section`, `ToolDiscovery` and friends from `@effected/*` directly. A convenience re-export here would give the same type two import paths and one more version to keep in step, so the policy is: silk-effects exports Silk policy, the kit exports itself. `packages/silk`'s manifest gained a direct `@effected/templates` dependency for exactly this reason — see `../silk/architecture.md`.
- **Deleting a service can delete an error.** `classify` is total, so code that used to `Effect.catch` a `VersioningDetectionError` or a `TagFormatError` now has nothing to catch, and the analyzer's error channel narrowed accordingly.

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

- **The `ConfigInspector` release-surface fallback, and what `privatePackages.version` does to it.** When `.changeset/config.json` declares no explicit `packages` record, `ConfigInspector.inspect` does not return empty attribution — it builds package scopes from the discovered workspace packages that are a release surface, determined by calling the pure `SilkPublishability.detect` per package (the same publishConfig-driven rule the analyzer uses). A package with no publishConfig is normally excluded, **except when the config sets `privatePackages.version: true`**: changesets versions private packages in that mode, so every workspace package is a release surface regardless of publishConfig (#360 — a private single-root repo with `privatePackages.version: true` otherwise produced an empty release surface and left every file unmapped). The flag is derived inline with the same truth-table `ChangesetConfig.versionPrivate` uses (`pp !== undefined && pp !== false && pp.version === true`) and threaded into `buildFallbackScopes`, so the fallback path and the explicit-record augmentation path agree. The changeset `ignore` list is intentionally NOT consulted — an ignored-but-configured package is still a valid changeset target. This is why `ConfigInspector.layer` carries a `FileSystem` requirement (it reads each package's `package.json` and `dist/prod/targets.json`). See the `buildFallbackScopes` helper in `src/changesets/services/config-inspector.ts`.
- **File attribution has a fixed precedence, and a versioned root is always LAST.** `classifyOne` resolves a path to a package in order: (1) directory containment, deepest `workspaceDir` wins; (2) `additionalScopes`; (3) `versionFiles`; (4) a root-as-package fallback. A scope whose `workspaceDir` IS the project dir is deliberately held OUT of the containment pass and applied only at step 4, because every file in the repo is "inside" the root by definition — letting the root compete on containment made it win any path outside a sub-package directory and silently shadow the `additionalScopes` and `versionFiles` the config declared for that path. The last-resort placement is what lets a single-package repo whose only package IS the root attribute its files at all, without outranking a more specific claim. `checkConflicts` carves the root out of shadowing validation for the same reason: the root represents the whole repo, not a sub-package whose directory claims ownership. Step 4 still applies `isInside(projectDir, abs)` before returning the root — `resolve` accepts `../` and absolute inputs, and the root owning a path that is not in the repo would be a worse answer than owning nothing.
- **The resolved-output result types are Effect `Schema`, not interfaces.** `BranchAnalyzer` and `ConfigInspector` define their result shapes as `Schema.Struct` (all exported from the root) with the public TypeScript interfaces derived from them. The single source of truth lets `@savvy-web/mcp` embed these schemas directly in its `changeset_inspect` tool result and round-trip them through the effect→zod bridge. See `../mcp/architecture.md`.
- **`ReleasePlanner` drives the genuine `@changesets` engine, not hand-rolled logic.** `ReleasePlanner` (`src/changesets/services/release-planner.ts`, closes #125) backs changeset preview and apply with the real `@changesets/get-release-plan` + `@changesets/apply-release-plan` machinery, so all formatting — dependency tables included — comes from the engine and no changesets internals are re-implemented. The engine is the **changesets v3 line** (named exports, v3 prereleases): v3 consumes `@manypkg/get-packages@3.x` `Packages` directly, so the old v1 packages adapter (`buildPackages`) is gone and workspace discovery is a plain `getPackages(root)` call. v3's non-throwing `readConfig` is bridged so config errors land on the existing `ReleasePlanError` mapping and its warnings surface via `Effect.logWarning`; one caveat: v3's `readPreState` (run inside `getReleasePlan`) auto-migrates a legacy `pre.json` in place, so even the read-only `preview`/`plan` paths can touch disk. Its `preview(root, { changelogModules })` is otherwise non-destructive: it runs the real `applyReleasePlan` against a `Scope`-managed temp directory (created via the platform `FileSystem`'s `makeTempDirectoryScoped`, auto-removed when the scope closes) and reads the rendered CHANGELOG blocks back, never mutating the repo. Its `apply(root, { dryRun, changelogModules })` is the destructive native release that the `savvy changeset version` CLI command now calls instead of shelling out to a `changeset` binary — it bumps versions, transforms each touched CHANGELOG via `ChangelogTransformer` and updates configured versionFiles through `ConfigInspector` + `VersionFiles`. `changelogModules` maps configured changelog ids to absolute module paths for callers in no-`node_modules` contexts (e.g. a bundled GitHub Action): when set, `config.changelog[0]` must be a key of the map (rewritten before the engine call; an unmapped id fails) and the engine's `format` integration is disabled — the caller owns formatting. A config with `changelog: false` has no id to map and picks up only the `format: false` half. Both members that render a changelog take it, off one shared `withChangelogModules` rewrite: rendering `changelogEntry` resolves the configured module exactly as applying does, so a zero-install caller needs the option on `preview` for the same reason it needs it on `apply` — without it, `preview` dies inside `import-meta-resolve` reporting only `expected to be defined`. `plan` renders nothing and so needs no mapping. **Membership in the map is an `Object.hasOwn` check, never `changelogModules[id] === undefined`** — an id naming an `Object.prototype` member (`toString`, `constructor`, `valueOf`, `hasOwnProperty`) reads back an *inherited function* through the latter, so it skipped the typed unmapped-id error and handed the engine a non-string where a module specifier belongs, failing deep in resolution instead. The defect predates `preview` gaining the option (the inline rewrite `apply` used to carry had it), so extracting the shared helper fixed it for both members at once. `ReleasePlanner.layer` requires `ConfigInspector` and `FileSystem` (the latter resolved once at construction and closed over so its methods stay `R = never`; it backs the preview path's scoped temp dir); its result schemas live in `src/changesets/schemas/release-plan.ts`. `apply` is intentionally NOT exposed over MCP — only the read-only `preview` is (see `../mcp/architecture.md` and `../cli/architecture.md`).
- **`VersionFiles` patches documents with format-preserving minimal edits, never a parse/re-serialize round-trip.** `VersionFiles.updateFile` (`src/changesets/utils/version-files.ts`, closes #234) resolves each configured JSONPath to concrete paths via `jsonPathResolve` (`src/changesets/utils/jsonpath.ts`) and applies each edit through `@effected/jsonc`'s `modify` + `applyEdits`, so everything outside the edited value span is preserved byte-for-byte — the old `JSON.parse`/`JSON.stringify` round-trip exploded inline arrays and dropped comments — and JSONC version files (comments, trailing commas) work end-to-end. Semantics: a wildcard-free path whose leaf property is missing is INSERTED using the document's detected indent (previously silently skipped); wildcard paths only update existing matches (out-of-bounds numeric leaves are guarded so `modify` never appends to arrays); a same-value update is a no-op with no write. Requires `@effected/jsonc >= 0.3.1` for tight edit spans.
- **`DepsRegen` splits `plan()` from `execute()` so detect and regen share one code path.** `Changesets.DepsRegen` (`src/changesets/services/deps-regen.ts`) lifts the `deps regen`/`deps detect` orchestration out of the CLI into a `Context.Service`. `plan(options)` computes the cumulative dependency diff (merge-base→worktree by default, or explicit `from`/`to`) and returns a complete, side-effect-free `RegenPlan` — target filenames chosen up front, each row's From/To resolved, stale pure-dependency changesets marked for deletion; `execute(plan)` only applies the deletes and writes the plan already describes, so dry-run is exactly `plan()` plus rendering. **Both diff sides are snapshotted through `@effected/workspaces`' `WorkspaceSnapshots` service** (renamed from `PointInTimeWorkspace`; that name no longer exists in the kit) — each side is read at its own ref (or the worktree via `WorkspaceSnapshots.worktree`) carrying its own catalogs, so `catalog:`/`workspace:` specifiers resolve **per side** to concrete versions *before* the two `WorkspaceStateSnapshot`s are diffed; rows whose resolved values are equal on both sides are suppressed (a specifier that changes protocol but not resolved version produces no row). This replaces the old post-diff `resolveDiffRows` pass and the deleted `WorkspaceSnapshotReader`/`snapshotFromWorktree` readers — the diff itself now lives in `src/changesets/utils/dep-diff.ts` over `WorkspaceStateSnapshot` pairs. `devDependency` rows are dropped unless `includeDevDeps` is set (the `deps detect` read path sets it to show the full diff; `deps regen` does not, since a dependency's devDeps never reach a consumer). `isPureDependencyChangeset` (exported) is the strict-detection rule: single-package frontmatter, exactly one `## Dependencies` heading, no other body content — mixed changesets are never touched. **Gating** (in-scope for writes): a package is in scope when it is `publishable OR privatePackages.version` **and** not on the changeset ignore list — the ignore list wins over an explicit `--package` target. **Deletion is strictly narrower than write-scope** (#258): a pre-existing pure-dependency changeset is a delete candidate only when its package is in scope **and** actually rewritten this run (present in the plan's `toWrite` — a package whose only diff rows were `devDependency`-only, and so dropped, has zero rewritten rows and keeps its changeset) **and** its file was authored on this branch rather than already committed at the merge-base ref (`gitListChangesetFilesAtRef` lists `.changeset/*.md` tracked at `fromRef` via `git ls-tree`; tolerant — a non-repo cwd or unresolvable ref yields the empty set, degrading the authorship filter to a no-op). Either gap previously destroyed a still-relevant release note with nothing recreated. **Cache refresh:** `plan()` opens by refreshing `ConfigInspector` (which subsumes the standalone `WorkspaceDiscovery.refresh`) **and** `ChangesetConfig`, because both hold per-root caches that never self-expire — a long-lived host (the `savvy-mcp` server) holds one `DepsRegen` for its whole process, so a `.changeset/config.json` edit between two `plan()` calls would otherwise stay invisible (#229). All changeset file I/O flows through the core `FileSystem` (writes are loud, deletes are tolerant/skip-and-continue, and the plan writes before it deletes so an interrupted run stays re-runnable), surfacing the new `ChangesetIOError`. `DepsRegen.layer` requires `WorkspaceSnapshots | ConfigInspector | WorkspaceDiscovery | PublishabilityDetector | ChangesetConfig | Git | FileSystem` (`WorkspaceSnapshots`, `PublishabilityDetector` and `Git` from `@effected/workspaces`; the `FileSystem` is resolved once at construction so `plan`/`execute` stay `R = never`). `plan()` fails with `GitError | WorkspaceDiscoveryError | ChangesetIOError | PointInTimeReadError`; `execute()` fails with `ChangesetIOError`. `gitMergeBase` relocated from the deleted reader's module to `src/changesets/utils/git.ts` (public export path `Changesets.gitMergeBase` unchanged). The CLI and MCP tools are thin adapters over this service (see `../cli/architecture.md` and `../mcp/architecture.md`).
- **`DepsRegenDefault` is the batteries-included layer.** `Changesets.DepsRegenDefault` composes the full `DepsRegen` dependency graph with silk's opinionated defaults — the kit graph via `Workspaces.layerWithGit`, `ConfigInspector.layer`, and the adaptive publishability detector (`SilkPublishability.layerAdaptive`, the versionable-minus-ignored gating that matches the savvy CLI and MCP runtimes) — leaving only the platform services open: `R = FileSystem | Path | ChildProcessSpawner`. Because `WorkspaceSnapshots` reads git history, it needs a spawn-capable platform layer (`NodeContext.layer`), not a bare filesystem layer. `DepsRegen.layer` stays the seam for callers who inject their own dependencies (test detectors, alternate config sources); `DepsRegenDefault` is purely additive.
- **Release lines carry no commit-link prefixes; dependency tables carry their own heading.** Squash-merge workflows make per-changeset commit links point at squash commits, so `getReleaseLine` and `formatChangelogEntry` (`src/changesets/changelog/`) no longer inject `[short-hash](…)` prefixes into changelog lines — git history is the reference; authored links, issue refs and PR/user attribution are unchanged. A consequence: identical summaries from separate changesets now genuinely deduplicate (the hash prefix previously made every item unique, which had masked a `DeduplicateItemsPlugin` bug — its seen-set now spans all list nodes in a section, not one list, because `MergeSectionsPlugin` splices duplicate sections in as sibling lists). `getDependencyReleaseLine` prefixes its GFM table with a `### Dependencies` heading — the marker `AggregateDependencyTablesPlugin` uses to locate and merge per-package tables. `ChangelogTransformer.transformContent` iterates `SilkChangesetTransformPreset` (`src/changesets/remark/presets.ts`) rather than hand-listing plugins, so the transform chain cannot drift from the preset (a prior hand-list silently omitted `AggregateDependencyTablesPlugin`).
- **Changeset-less releases render a Maintenance note, never an empty version block.** A release with no changesets of its own (forced by a `fixed`/`linked` group co-member) is classified by the pure `deriveMaintenanceReason` (`src/changesets/services/maintenance-reason.ts`); group entries match via `ChangesetConfig.matches` (exact + `@scope/*`), a deliberate subset of the micromatch globs changesets accepts — richer globs degrade gracefully to a generic "unspecified" sentence instead of naming triggers. `MaintenanceNotePlugin` (`src/changesets/remark/plugins/maintenance-note.ts`) inserts the `### Maintenance` section but is deliberately NOT a preset member: it is parameterized per version block via `TransformOptions.maintenance` and only fires on a *structurally empty* block, so a dep-bump-only release (zero changesets but a Dependencies table) is left alone and the plugin is idempotent once the note exists. `ReleasePlanner` derives the reasons from the release plan and threads them into `ChangelogTransformer.transformFile` on both the `preview` and `apply` paths.

These `Lint` decisions are load-bearing for consumers:

- **A lint handler's byte-format step is a public static, not private handler-internal code, because two entry points share it.** Every `Lint` handler is reachable two ways — as a lint-staged handler (`<Handler>.create()`) and as a `savvy lint fmt <name>` CLI subcommand — and any formatting step that lives inside only one of them silently rewrites the file differently depending on which path ran. `Lint.PnpmWorkspace.formatContent` (`src/lint/handlers/PnpmWorkspace.ts`) is the worked example: it stringifies the sorted content through `@effected/yaml` under `DEFAULT_STRINGIFY_OPTIONS` (`indentSequences: true`, `quoteStyle: "double"`), and both `create()` and the CLI subcommand call it, so neither writes a differently-shaped file. Those options reproduce the repo's canonical byte format directly — the former Prettier post-process (which existed only to re-indent block sequences and re-quote single-quoted scalars) is gone as of `@effected/yaml 0.5.0`, which can now express both, so there is no second printer to drift from; `formatContent` dropped its now-unused `filepath` parameter but stays `async` for source compat. `Lint.PackageJson.sortContent` (`src/lint/handlers/PackageJson.ts`) is the same invariant over `@effected/package-json`'s `PackageJsonFormat.formatToString` (the tolerant text path — it sorts a private or version-less root rather than rejecting it, and returns unparseable content unchanged). When adding a handler that formats rather than merely checks, put the whole stringify/sort step behind one exported static and route both entry points through it. A regression test in `__test__/lint/index.test.ts` pins the resulting shape, and the operation must be idempotent — a second pass over an already-formatted file is a byte-for-byte no-op.
- **`Lint.Yaml.formatFile` still runs Prettier, deliberately, until effected#127.** The generic YAML handler (`src/lint/handlers/Yaml.ts`, every `**/*.{yml,yaml}` except the two pnpm files) formats arbitrary user-authored YAML where comment fidelity matters, and `@effected/yaml`'s `YamlFormat.formatToString` currently drops trailing and own-line comments (tracked upstream as effected#127), so swapping Prettier out here would silently strip user comments. This is the one surviving Prettier dependency in the `Lint` namespace and it stays until #127 lands. `PnpmWorkspace` could drop Prettier because it rewrites a fully-managed file from a sorted in-memory object (comments were never preserved on that path anyway); `Yaml` cannot.

## Module Architecture

### Source Layout

The package is organized by role, not by domain:

```text
src/
  index.ts              ← single root export (re-exports the tool namespaces too; no kit re-exports)
  errors/               ← Data.TaggedError classes (one per file)
  schemas/              ← Schema.TaggedClass / Schema.Class value objects and enums
  services/             ← Context.Service services with `layer` static members
  utils/                ← small shared helpers
  changesets/           ← Changesets namespace (extracted @savvy-web/changesets logic)
  commitlint/           ← Commitlint namespace (extracted @savvy-web/commitlint logic)
  lint/                 ← Lint namespace (extracted @savvy-web/lint-staged logic)
  turbo/                ← Turbo namespace (TurboInspector service + TurboDigest transforms)
  repos/                ← Repos namespace (.repos manifest, submodule plumbing, drift report)

__test__/                ← mirrors the source tree; integration tests under integration/
  integration/fixtures/workspaces/  ← workspace fixture tree (see Testing Strategy)
```

### Publish (SilkPublishability)

Silk publishability rules layered over `@effected/workspaces`' `PublishTarget` value object and `PublishabilityDetector` service. There is one canonical target shape (`PublishTarget` from `@effected/workspaces`) and silk-effects supplies the silk *rule* for producing it. Token resolution (`auth`/`tokenEnv`/OIDC) is a consumer concern, not part of this package.

`SilkPublishability` (`src/services/SilkPublishability.ts`) is an all-static class so the full rule surface is visible in one place: the pure `detect(pkgName, raw, binding)` (the silk targets-first rule), plus the Effects `resolveTargets` (detector + private-dist build filter) and `listPublishable` (discovery + detector). `readTargetsBinding(fs, pkgPath)` reads `<pkg>/dist/prod/targets.json`, returning `null` when missing/malformed (pre-build). See the source file for exact signatures.

**Binding-driven target resolution** is the load-bearing decision. `detect` recognizes only the bundler's keyed Record-map form of `publishConfig.targets` (`{ npm: true, github: true, … }`), and takes the parsed `dist/prod/targets.json` binding as its third argument (or `null` before the prod build has run):

- **With a binding** (post-prod-build): one `PublishTarget` per resolved registry target, with `directory = dist/prod/<group>/pkg` taken from the bound group — NOT `publishConfig.directory`. `npm: true` + `github: true` collapse into ONE byte-group (one tarball/dir) deployed to two registry targets.
- **Without a binding** (pre-build): one count-accurate placeholder `PublishTarget` per declared key, so publishability and target counts are correct even before the build.

`access` resolves to `publishConfig.access ?? "public"`; `provenance` defaults false. The `detect` precedence is: non-empty Record-map `targets` → publishable regardless of `private`; else `publishConfig.access` public/restricted → one target at `publishConfig.directory`; else `private !== true` → one default public target; else `[]`.

`RawPackageJson`/`RawPublishConfig` and the Record-map target types describe the unschematized `package.json`/`publishConfig` shape that `detect` consumes — silk rules read fields (notably `targets`) that the upstream `PublishConfig` schema strips. The binding types are `TargetsBinding`/`TargetBinding`/`TargetGroupBinding`.

**Detector layers** both override the `@effected/workspaces` `PublishabilityDetector`. `SilkPublishability.layer` (requires `FileSystem`) applies the silk rule directly. `SilkPublishability.layerAdaptive` (also requires `ChangesetConfig`) short-circuits changeset-ignored packages to `[]`, then dispatches on `ChangesetConfig.mode`: `none` → `[]`; `silk` → `SilkPublishability.detect`; `vanilla` → the upstream detector. Both layers read each package's binding via `readTargetsBinding` and thread it into `detect`, so post-build resolution uses the bundler's actual group layout and pre-build resolution falls back to declared-key placeholders.

### Versioning (ChangesetConfigReader, ChangesetConfig)

Two services in `src/services/`: `ChangesetConfigReader` reads the raw config (depends on `FileSystem`) and `ChangesetConfig` is a per-root cached accessor over it (`mode`, `versionPrivate`, `isIgnored`, `fixed`, …). The classification itself is no longer a service here — `VersioningStrategy` is a kit value class (see [What the kit owns now](#what-the-kit-owns-now)); silk-effects supplies it the one thing it deliberately refuses to read for itself, the `fixed` groups out of one release tool's config file. The per-root cache never self-expires, so `ChangesetConfig.refresh()` clears it — the escape hatch a long-lived host (the `savvy-mcp` server, one instance for its whole process) calls to observe an on-disk `.changeset/config.json` edit made since the last accessor call (#229). `ConfigInspector` carries the same never-expiring cache and matching `refresh()` (which also refreshes the underlying `WorkspaceDiscovery` snapshot).

`ChangesetConfig` (`src/services/ChangesetConfig.ts`) is total: every accessor has error channel `never`, so a missing or unreadable config collapses to `mode: "none"` with empty/false defaults. The static `ChangesetConfig.matches` is the single ignore-pattern matcher used across the package — exact name match, or `@scope/*` wildcard (the kept prefix includes the trailing slash, so `@scope/*` matches `@scope/anything` but not the bare `@scope`).

The bare name `ChangesetConfig` is the *service*. The decoded config *schema* types are `ChangesetConfigFile`/`SilkChangesetConfigFile` (`src/schemas/VersioningSchemas.ts`), and `ChangesetConfigReader.read` returns that union. `ChangesetConfigFile` matches the upstream `@changesets/config` spec; `SilkChangesetConfigFile` extends it with `_isSilk: true` when the `changelog` field references `@savvy-web/changesets`.

The kit's `VersioningStrategy` resolves one of three strategies: `"single"` (0-1 publishable packages), `"fixed-group"` (all publishable packages in one `fixed` group) or `"independent"` (multiple packages not in a single fixed group), and exposes the matching `tagStyle` plus `tagsFor`. Verify the exact surface against `node_modules/@effected/workspaces`, not against this paragraph.

### Tags

Tag formatting is kit-owned (`ReleaseTag`, `TrackingTag`, `classifyTag`, `TagStyle` in `@effected/workspaces`). The formats it produces are still the load-bearing Silk constraint, so they are recorded here:

- Single: `1.2.3` (strict SemVer 2.0.0, no `v` prefix)
- Scoped + `@scope/pkg`: `@scope/pkg@1.2.3`
- Scoped + unscoped: `my-pkg@1.2.3`

`classifyTag` is total — there is no `TagFormatError` to handle any more.

### Managed Sections (kit-owned; SavvySections is the Silk content)

The managed-section pattern — tool-owned regions inside user-editable files, delimited by `BEGIN`/`END` marker comments — is implemented by `@effected/templates` (`ManagedSection` service, `Section`, `SectionId`, `CommentStyle`). silk-effects keeps only the Silk-specific *content* and identities (see [SavvySections](#savvysections-shared-husky-hook-shells)).

What a reader coming from the old silk-effects API needs to know:

- Identity is `SectionId.make({ key, commentStyle })` and content is `sectionId.section(body)`; `SectionDefinition`/`SectionBlock` are gone.
- `syncMany` is now `syncAll` and keeps the multi-section compositor semantics: every listed section ends up present, in declared relative order, with user content before/after/between preserved and unrelated tool sections untouched; it is idempotent.
- `check` returns a flat `CheckOutcome` — `UpToDate` / `Drifted` / `Absent` — instead of a nested `Found` variant carrying an `isUpToDate` boolean, so consumer branching is a three-way `$is` match.
- `read` returns an `Option` rather than a nullable block.

**Marker format** (unchanged bytes, which is why the uppercase-key guard below exists):

```text
# --- BEGIN {KEY} MANAGED SECTION ---
managed content here
# --- END {KEY} MANAGED SECTION ---
```

#### SavvySections (shared husky-hook shells)

`src/schemas/SavvySections.ts` centralizes the shell content the Silk Suite husky hooks share, so consumer CLIs no longer hand-write package-manager detection. Two consumers drive it: `@savvy-web/commitlint` (`savvy-commit`) and `@savvy-web/lint-staged` (`savvy-lint`). It exports `SavvyBaseSection`/`savvyBasePreamble()` (the package-manager-detection preamble: `ROOT`, `in_ci`, `detect_pm`/`PM`, `pm_exec`), `SavvyHooksSection`/`savvyHooksHygiene()` (self-guarded `core.fileMode` + `chmod +x`) and `savvyToolSection(toolName, command)`.

The composition contract is the load-bearing part. `savvyToolSection` produces a one-line section whose content is exactly `in_ci || pm_exec <command>` with `command` appended verbatim — no parsing, quoting or interpolation, so shell tokens like `$ROOT` and `$1` survive into the literal. Its precondition is that a `savvy-base` section precedes it in the same hook file so `in_ci`/`pm_exec` are defined; consumers satisfy this by passing `[SavvyBaseSection.section(savvyBasePreamble()), savvyToolSection(…)]` to `syncAll` in that order. `pm_exec` uses local/exec semantics per package manager and `bun x` (space form, not the `bunx` shim) so it works regardless of how bun was installed. See `SavvySections.ts` for the exact shell bodies.

**The section keys are UPPERCASED at `SectionId` construction, and that one line is load-bearing.** The deleted silk-effects section model uppercased `toolName` on the way in; the kit renders a key *verbatim* into its markers. A lowercase key would therefore emit `# --- BEGIN savvy-base MANAGED SECTION ---` and stop matching the `SAVVY-BASE` markers already written into every consumer repo's hook files — `check` would report `Absent` and `sync` would append a second copy beside the first, silently duplicating hook logic. The private `shellSection(toolName)` helper in `SavvySections.ts` does the uppercasing in one place; the CLI's own section ids (`SAVVY-COMMIT` in `packages/cli/src/commands/commit/init.ts`, `SAVVY-LINT` in `src/lint/cli/sections.ts`) are spelled uppercase literally for the same reason. Any new Silk section identity must go through the same guard.

### Config (ConfigDiscovery)

`ConfigDiscovery` (`src/services/ConfigDiscovery.ts`, depends on `FileSystem`) finds config files following the Silk convention, searching `{cwd}/lib/configs/{name}` (source `"lib"`) before `{cwd}/{name}` (source `"root"`).

### Biome (BiomeSchemaSync)

`BiomeSchemaSync` (`src/services/BiomeSchemaSync.ts`, depends on `FileSystem`) scans for `biome.json`/`biome.jsonc`, compares the `$schema` URL against the expected version and optionally updates it in place. It strips semver range prefixes (`^`, `~`, `>=`).

### Tool Discovery (kit-owned)

CLI tool resolution — locating a binary globally (PATH) or locally (through the package manager), extracting versions, enforcing constraints and caching probes — is `@effected/commands`' `ToolDiscovery`. silk-effects holds no copy: `Tool.named("turbo")` builds the definition, `discovery.resolve(tool)` yields a `ResolvedTool` whose `command(...)` returns a core `ChildProcess.Command`, and the `Run` free functions (`Run.text`, `Run.lines`, `Run.exitCode`) execute it. Its `LocalExec` contract — the argv prefix that runs a project-local binary — is supplied by `@effected/workspaces`' `Workspaces.localExecLayer()`, which reads the detected package manager and workspace root. See `../cli/architecture.md` and `../mcp/architecture.md` for how each host wires it.

**Environment extension goes through `Run.extendEnv`, never core's bare `setEnv`.** `ChildProcess.setEnv` *replaces* the child environment outright rather than merging onto the parent's, so a command given one extra variable loses `PATH` and fails to spawn at all. This was a live bug found on this branch, fixed upstream in the kit, and pinned here by a mutation-tested case in `__test__/turbo/TurboInspector.int.test.ts` — if that test ever stops failing when `extendEnv` is swapped back to `setEnv`, the pin has rotted.

### Workspace Analysis (SilkWorkspaceAnalyzer)

`SilkWorkspaceAnalyzer` (`src/services/SilkWorkspaceAnalyzer.ts`) is the composite service that orchestrates full workspace analysis — discovering packages, detecting publishability, classifying versioning/tag strategy and wiring up fixed/linked release groups — behind a single `analyze(root)` entry point. Its Live layer requires four services: `FileSystem`, `WorkspaceDiscovery`, `PackageManagerDetector` and `ChangesetConfigReader`. See [the rationale](#why-composite-silkworkspaceanalyzer).

It used to require six. Versioning and tag classification are now pure kit value operations, so neither contributes a requirement: step 8 calls `VersioningStrategy.classify({ packages, fixedGroups })` with the `fixed` groups taken from the changeset config **already read at step 4** (the duplicate config read the old `VersioningStrategy.detect(names, root)` service performed is gone), and step 9 is just `versioning.tagStyle`. The pipeline is shorter and its error channel narrower — `classify` is total, so the old `VersioningDetectionError` mapping disappeared with it.

The result types are two `Schema.TaggedClass` value objects in `src/schemas/WorkspaceAnalysisSchemas.ts`. `AnalyzedWorkspace` is the per-package record (name, version, path, publishability, targets, release flags, and `linked`/`fixed` group cross-references held via `Schema.suspend` for the cycle); its `toJSON` omits `linked`/`fixed` to avoid cycles. `WorkspaceAnalysis` is the top-level result (workspaces, changeset config, versioning, tag strategy, plus query accessors like `findWorkspace` and `publishableWorkspaces`); its `versioning` field is a nullable kit `VersioningStrategy` and `tagStrategy` a nullable kit `TagStyle`, not local schemas. The same file holds `SilkPublishConfig` (upstream `PublishConfig` extended via `PublishConfig.extend()` with the Silk `targets` field) and the `targets` *input* schemas `PublishTargetShorthand`/`PublishTargetObject` — distinct from the output `PublishTarget` value object that `SilkPublishability.detect` produces. See the source for the full member list.

The analyzer does not depend on a publishability *service*: it reads each package's raw `package.json` plus its `dist/prod/targets.json` binding (via `readTargetsBinding`, `null` pre-build) and calls `SilkPublishability.detect` directly. Two pipeline details are load-bearing:

- Discovery is passed the requested `root` so it resolves the right workspace even when the layer was built from a different working directory (e.g. a server launched from a subdirectory, or a test). The topological order comes from a pure `DependencyGraph.make({ packages }).sort()` value — no sorter service — and the reorder falls back to discovery order when the (possibly rootless) sort does not contain the discovered package names.
- `computeReleaseStatus` derives the `versioned`/`tagged`/`released` flags from the changeset config: no config → all `false`; an `ignore`-matched package (via `ChangesetConfig.matches`, so `@scope/*` wildcards apply — not exact-string `.includes`) → all `false`; a publishable package → all `true`; a truly private package consults `privatePackages` (`undefined`/`false` → all `false`; `{ version, tag }` → flags match config, with `released = versioned && tagged`).

`ChangesetConfigFile` (`src/schemas/VersioningSchemas.ts`) covers the full upstream `@changesets/config` spec; `SilkChangesetConfigFile` extends it with the `_isSilk` marker.

### Turbo Inspection (Turbo namespace)

The `Turbo` namespace (`src/turbo/`, re-exported from the root as `export * as Turbo`) provides read-only Turborepo introspection. **Every operation invokes `turbo run … --dry=json` and never executes a task** — this is the load-bearing safety invariant of the whole namespace. It exists to back the MCP `turbo_inspect` tool (see `../mcp/architecture.md`); the cache-miss and graph reasoning lives here so the tool file stays glue.

The namespace splits into a service for I/O and a pure transformer for the math, mirroring the rest of the package. `TurboInspector` (`Context.Service`) exposes `diagnoseCache` (per-package HIT/MISS + per-miss hash-contributor breakdown), `taskGraph` (nodes + memoized-DFS critical path) and `affected` (changed packages + their dependents), all failing with the `TurboError` union. `TurboDigest` (all-static class) holds the pure transforms from a decoded `TurboDryRun` into the three flat result shapes — no DI, directly unit-testable. See `src/turbo/services/TurboInspector.ts` and `src/turbo/digest.ts`.

`TurboInspector.layer` requires `ToolDiscovery` (from `@effected/commands`) `| ChildProcessSpawner | FileSystem | Git`. The spawner is captured at layer construction and re-provided onto each `Run` effect with `Effect.provideService`, keeping the public method effects at `R = never`. The methods take an explicit `cwd` (the MCP handler resolves the workspace root and passes it); the layer guards on a `turbo.json` at that `cwd` (`NotATurboRepoError`) before resolving the binary via `Tool.named("turbo")`, setting the working directory with `ChildProcess.setCwd` and merging any extra environment with `Run.extendEnv` (see the `setEnv` warning under [Tool Discovery](#tool-discovery-kit-owned)). The kit's resolution failure is a four-member union whose members expose no `reason` field, so `TurboNotInstalledError` is built from `e.message`.

**Schemas** (`src/turbo/schemas/`): `TurboDryRun` is the input decode shape for `turbo … --dry=json`; `CacheDiagnosis`, `TaskGraphResult` and `AffectedResult` are the deliberately **flat, bridge-safe** result shapes — no recursion, so the MCP's Effect-Schema→zod bridge round-trips them cleanly. See the structs in `src/turbo/schemas/results.ts`.

**Errors** (`src/turbo/errors.ts`): the `TurboError` union — `TurboNotInstalledError` (binary unresolvable), `NotATurboRepoError` (no `turbo.json`), `DryRunParseError` (bad JSON / decode failure) and `TurboExecError` (non-zero exit). `TurboNotInstalledError` and `TurboExecError` are intentionally distinct so callers can tell "turbo absent" from "turbo ran and failed".

## Service Patterns

All services follow the same Effect-TS patterns:

### Service Definition

Each service is a `Context.Service` class with a companion `*Shape` interface — the shape is exported so consumers (and test doubles) can name it. Its `layer` is a `static readonly` member on the class itself, not a sibling exported const in a separate `*-live.ts` module:

```typescript
export interface ServiceNameShape {
  readonly method: (arg: string) => Effect.Effect<Result, ErrorType>;
}

export class ServiceName extends Context.Service<ServiceName, ServiceNameShape>()(
  "@savvy-web/silk-effects/ServiceName",
) {}
```

### Layer Implementation

The `layer` static carries an explicit `Layer.Layer<Service, Error, Requirements>` annotation so a requirement added by accident shows up as a type error rather than silently widening the consumer graph. Build it with `this` as the `Layer.succeed`/`Layer.effect` constructor's first argument, not the class's own name repeated — `this` is correct inside a class expression body, but the class's own name is not: `Layer.succeed`/`Layer.effect` evaluate their first argument eagerly, in the static initializer, so a reference to the class's own name there throws a temporal-dead-zone error immediately, at class-evaluation time (i.e. at import) — not later, once the layer is actually built:

```typescript
export class ServiceName extends Context.Service<ServiceName, ServiceNameShape>()(
  "@savvy-web/silk-effects/ServiceName",
) {
  // Pure service (no dependencies)
  static readonly layer: Layer.Layer<ServiceName> = Layer.succeed(this, { ... });
}

export class ServiceWithDeps extends Context.Service<ServiceWithDeps, ServiceWithDepsShape>()(
  "@savvy-web/silk-effects/ServiceWithDeps",
) {
  // Service with dependencies
  static readonly layer: Layer.Layer<ServiceWithDeps, never, FileSystem.FileSystem> = Layer.effect(
    this,
    Effect.gen(function* () {
      const dep = yield* FileSystem.FileSystem;
      return { ... };
    }),
  );
}
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
`[Equal.symbol]` and `[Hash.symbol]` to control comparison semantics — `AnalyzedWorkspace`
is the surviving worked example, comparing on identity fields while its `linked`/`fixed`
cross-references stay out of the hash to avoid the cycle.

**Plain class** (for non-serialisable types with complex construction): Implement
`Equal.Equal` directly with a private constructor and a static `make()` factory. Reach for
this when a field is function-valued (a tagged enum with behavior, a comparator) and so
cannot round-trip through Schema.

Both patterns are now mostly *consumed* rather than defined here: the section, tool and
versioning value objects moved to the kit (see [What the kit owns now](#what-the-kit-owns-now)),
and the kit's own value classes follow the same Equal/Hash discipline.

## Tagged Enum Patterns

Discriminated union types that don't need Schema round-tripping use `Data.taggedEnum`:

```typescript
export type SyncOutcome = Data.TaggedEnum<{
  readonly Unchanged: {};
  readonly Changed: { readonly added: ReadonlyArray<string>; readonly removed: ReadonlyArray<string> };
}>;
export const SyncOutcome = Data.taggedEnum<SyncOutcome>();
```

Consumers match on these with `$is`. The section outcomes silk-effects used to define this
way now come from `@effected/templates` in a flattened form (`CheckOutcome` is
`UpToDate`/`Drifted`/`Absent`, not a nested `Found` variant carrying a boolean), so a
branch written against the old three-state shape does not typecheck — it silently changes
meaning only if the compiler is bypassed.

## Dependencies

```text
@savvy-web/silk-effects
  ├── effect (peer + dev)
  └── @effected/* (direct): commands · git · glob · jsonc · package-json ·
                            templates · walker · workspaces · yaml
```

`effect` is the sole peer (consumers already depend on it; v4 absorbed the `@effect/platform` surface into core). The `@effected/*` kit packages are direct dependencies — `package.json` holds the authoritative ranges, and the github-split wave pinned `commands`/`templates` at 0.1.0, `workspaces` 0.9.0, `npm` 0.5.0 and `package-json` 0.6.0. The `Changesets` namespace also depends on the genuine changesets engine at runtime — `@changesets/get-release-plan`, `@changesets/apply-release-plan`, `@changesets/config` and `@manypkg/get-packages` back `ReleasePlanner`, all on the changesets **v3** line (see the third load-bearing bullet in [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint)). The vendored `src/changesets/vendor/github-info.ts` adapter wraps v1 `@changesets/get-github-info`'s `getCommitInfo` and folds its structured, possibly-`undefined` result back into the legacy `GitHubCommitInfo` shape so the changelog pipeline is unaffected. See `package.json` for the complete dependency list.

**Runtime requirement:** Consumers must provide a platform layer (`NodeServices.layer` / `NodeContext.layer`, `BunContext.layer`, etc.) for modules that use `FileSystem` or `ChildProcessSpawner`.

**Modules requiring FileSystem:**

- `ConfigDiscovery` / `ConfigDiscovery.layer`
- `BiomeSchemaSync` / `BiomeSchemaSync.layer`
- `ChangesetConfigReader` / `ChangesetConfigReader.layer`
- `SilkPublishability.layer` (override of `@effected/workspaces`' `PublishabilityDetector`)
- `SilkPublishability.layerAdaptive` (also requires `ChangesetConfig`; its vanilla branch reads the
  `PublishabilityDetector.npm` **value** — the kit deleted the bare `.layer` static, because policies are values)
- `Changesets.ConfigInspector.layer` (also requires `ChangesetConfigReader` + `WorkspaceDiscovery`; `FileSystem` backs its release-surface fallback — see [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint))

**Modules requiring the kit `ToolDiscovery` + ChildProcessSpawner + FileSystem + Git:**

- `Turbo.TurboInspector` / `Turbo.TurboInspector.layer` (`TurboDigest` itself is pure)

**Modules requiring ChangesetConfigReader:**

- `ChangesetConfig` / `ChangesetConfig.layer`

**Composite modules (FileSystem + multiple upstream services):**

- `SilkWorkspaceAnalyzer` / `SilkWorkspaceAnalyzer.layer`
  Depends on: `FileSystem`, `WorkspaceDiscovery`, `PackageManagerDetector`, `ChangesetConfigReader`
- `Changesets.DepsRegen` / `Changesets.DepsRegen.layer`
  Depends on: `WorkspaceSnapshots`, `ConfigInspector`, `WorkspaceDiscovery`, `PublishabilityDetector`,
  `ChangesetConfig`, `Git`, `FileSystem` (`WorkspaceSnapshots` + `PublishabilityDetector` + `Git` from `@effected/workspaces`;
  all changeset file I/O goes through the `FileSystem` Tag, resolved once at construction so `plan`/`execute` stay `R = never`)
- `Changesets.DepsRegenDefault` (batteries-included)
  Requires only the platform services — `FileSystem | Path | ChildProcessSpawner`. Composes the kit graph via
  `Workspaces.layerWithGit`, plus `ConfigInspector.layer` and `SilkPublishability.layerAdaptive` internally;
  `WorkspaceSnapshots` reads git history, so the platform layer must be spawn-capable (`NodeServices.layer`)
- `Changesets.ReleasePlanner` / `Changesets.ReleasePlanner.layer`
  Depends on: `ConfigInspector`, `FileSystem` (the `FileSystem` backs the preview path's `Scope`-managed temp dir)
- `Changesets.ChangelogService` — requires `GitHubService` only; the `MarkdownService` indirection that used to
  sit in this channel is deleted

**Pure modules (no platform requirements):**

- `SilkPublishability` (all-static class — `detect` is pure; `resolveTargets`/`listPublishable` are
  Effects requiring the `PublishabilityDetector` Tag; `readTargetsBinding` is an `Effect` requiring `FileSystem`)
- All value objects and tagged enums

Kit services silk-effects consumers commonly need alongside these — `ManagedSection` (`@effected/templates`),
`ToolDiscovery` (`@effected/commands`), `WorkspaceDiscovery`/`PackageManagerDetector`/`WorkspaceRoot`
(`@effected/workspaces`) — are provided from the kit packages directly, not from here.

## Consumer Guide

### Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform-node
```

A consumer that also touches managed sections or tool discovery declares those kit packages itself — silk-effects re-exports nothing from `@effected/*`, so a transitive resolution would be an undeclared dependency (this is why `@savvy-web/silk` gained a direct `@effected/templates` dependency).

### Usage

All silk-effects exports come from the package root; kit types come from their own packages:

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { ManagedSection, SectionId, CommentStyle } from "@effected/templates";
import { ToolDiscovery, Tool, Run } from "@effected/commands";
import { SilkPublishability, SavvyBaseSection, savvyBasePreamble } from "@savvy-web/silk-effects";
```

**Pure publishability rule (no platform layer needed):**

`SilkPublishability.detect` is a pure function over a raw `package.json` plus the bundler's resolved `dist/prod/targets.json` binding (`null` pre-build), returning `@effected/workspaces` `PublishTarget` records:

```typescript
const targets = SilkPublishability.detect(
  "@my-org/pkg",
  { private: true, publishConfig: { access: "public", targets: { npm: true, github: true } } },
  null, // pre-build: one count-accurate placeholder per declared key
);
// → with a binding: one PublishTarget per resolved registry target (npm+github collapse to one group)
```

**Silk section content through the kit's `ManagedSection`** (note the uppercase key):

```typescript
const id = SectionId.make({ key: "MY-TOOL", commentStyle: CommentStyle.hash });

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    return yield* ms.sync(".husky/pre-commit", id.section("npx lint-staged"));
  }).pipe(
    Effect.provide(ManagedSection.layer),
    Effect.provide(NodeServices.layer),
  )
);
```

**Tool discovery through the kit** (`LocalExec` comes from `@effected/workspaces`):

```typescript
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const td = yield* ToolDiscovery;
    const tool = yield* td.resolve(Tool.named("biome"));
    return yield* Run.text(tool.command("check", "."));
  }).pipe(
    Effect.provide(ToolDiscovery.layer.pipe(Layer.provide(Workspaces.localExecLayer()))),
    Effect.provide(NodeServices.layer),
  )
);
```

## Testing Strategy

Tests live in `__test__/`, mirroring the source tree, with integration tests under `__test__/integration/`. Those run against a hierarchical fixture tree (`__test__/integration/fixtures/workspaces/`) organized by runtime (standalone, node, bun), package manager (pnpm, npm, yarn) and Silk-vs-default configuration. The fixtures cover publishConfig permutations, workspace patterns, changeset configs, fixed/linked groups, private-package handling and multi-registry targets — they double as living documentation of the supported workspace layouts.

Four test approaches are used:

- **Unit tests** (schemas, errors, utils): verify construction, encoding/decoding, Equal/Hash semantics, getters and static methods.
- **Property-based tests**: use `fast-check` to lock down class invariants (e.g. `AnalyzedWorkspace` Equal/Hash consistency) independent of implementation details.
- **Service tests**: provide mock layers and verify service contract behavior.
- **Integration tests**: run `SilkWorkspaceAnalyzer.analyze` against the real fixture directories using the `@effect/platform-node` platform layer, catching schema-decode and service-composition errors that unit tests miss.

Effect-running test files use `@effect/vitest` (`it.effect` bodies, per-test `Effect.provide`, `Effect.flip` for typed-failure assertions); the pure-function unit and property-based tests above have no Effect surface and stay on plain `vitest`. The suite-wide conventions — including the `TestConsole`-vs-`process.stderr` discrimination that `__test__/commitlint/hook/silence-logger.test.ts` turns on — are in [../testing/effect-vitest.md](../testing/effect-vitest.md).

**Some helpers are exported from their own module for tests only, and must not reach the index.** `withChangelogModules` and `extractVersionBlock` (both in `src/changesets/services/release-planner.ts`) carry a bare `export` so a test can import them through the source path, but neither is re-exported from `src/changesets/index.ts` — they are internal, not public API, and adding them to the index would turn an implementation detail into a surface consumers pin against. Keep that arrangement when adding another; the deliberate asymmetry is the convention, not an oversight to tidy up.

The reason `withChangelogModules` needs direct unit coverage rather than a fixture driven through the engine is that **the `format: false` half of the rewrite is not observable from the outside.** Every value the changesets config accepts for `format` resolves through `npx` (network) or an ambient binary, so a fixture that names a formatter asserts what the host machine happens to have installed, not what the rewrite did. That was established empirically — the rewrite was mutated and the engine-level preview/apply suites stayed green — so treat the split as load-bearing: `__test__/changesets/services__release-planner-changelog-modules.test.ts` owns the rewrite's semantics (mapping, unmapped-id failure, own-property membership, `changelog: false` passthrough) and the preview/apply suites own the engine wiring around it.

`Pretty.make` is wired on `AnalyzedWorkspace` and `WorkspaceAnalysis` for debugging and test-output readability.

## Rationale

### Why platform-agnostic?

The library is consumed by GitHub Actions (Node.js), CLI tools (Node.js), and potentially
Bun-based tools. Depending on effect's platform abstractions (`FileSystem`, `ChildProcessSpawner`,
in-core since v4) rather than on Node APIs ensures compatibility across all runtimes without
requiring separate implementations.

### Why extract these patterns?

These patterns were independently implemented across several repos. Extracting them eliminates duplication, ensures consistent behavior and provides a single point for version-bumping the shared logic.

### Why give three of them away to the kit?

The same argument, one level up. `VersioningStrategy`, `TagStrategy`, `ToolDiscovery` and `ManagedSection` were *mechanisms* with no Silk opinion in them — every consumer of the kit wants tag classification and marker-delimited managed regions, not a Silk-flavored copy. Keeping them here meant the action repos (which do not depend on silk-effects) either re-implemented them or took a dependency on Silk policy to get generic behavior. Upstreaming the mechanism and keeping the policy (`SavvySections` content, the silk publishability rule, the changesets config shapes) is the durable seam; the residue in this package is exactly the part that is *about Silk*. See [What the kit owns now](#what-the-kit-owns-now).

### Why `effect` as the only peer dependency?

Consumers already depend on it, and bundling it would cause version conflicts and bloated output. As a peer, consumers get a single copy. Effect v4 folded the platform surface into core, so the former `@effect/platform` peer is gone.

### Why dual-format (CJS + ESM)?

The driver is `@savvy-web/silk`: its config-integration shims are dual-format because some external loaders `require()` them from CommonJS — notably markdownlint-cli2's custom-rule loader, which loads `@savvy-web/silk/changesets/markdownlint` via a CJS path. `silk` externalizes silk-effects, so silk's CJS output emits `require("@savvy-web/silk-effects")`, which only resolves if silk-effects exposes a CJS entry. Dual-format here is a hard requirement of the consumer chain, not a convenience.

### Why host the three tool namespaces here?

The three dev-tooling packages couple their CLI commands to their config-export modules through shared per-tool logic. Keeping `@savvy-web/cli` and `@savvy-web/silk` thin with neither importing the other forces that shared logic into the one library both import — silk-effects. The namespaces (`Changesets`, `Commitlint`, `Lint`) are that shared home. See the [Tool Namespaces](#tool-namespaces-changesets-commitlint-lint) section.

### Why the section keys are uppercased rather than the marker format changed

The kit renders a section key verbatim; the deleted local model uppercased it. Either convention is defensible in isolation, but the markers are **already on disk in every consumer repo's hook files**, and a mismatch does not error — `check` reports the section absent and `sync` writes a second copy, so the hook quietly grows a duplicate block. Uppercasing at `SectionId` construction keeps the marker bytes byte-identical across the migration, which is the only property that matters here. Changing the kit's rendering instead would have imposed Silk's historical spelling on every other kit consumer.

### Why role-based folders instead of domain folders?

The role-based layout (`errors/`, `schemas/`, `services/`, `utils/`) with a single root export keeps the build simple (one entry point, no sub-paths) and the consumer experience flat (everything imports from the package root), rather than organizing by domain and forcing consumers to know which sub-path to import from.

### Why layered changeset config?

`ChangesetConfigFile` matches the upstream `@changesets/config` spec so the module works with any changesets project. `SilkChangesetConfigFile` extends it for Silk-specific features without breaking compatibility. The high-level `ChangesetConfig` service then layers total, cached accessors over the raw file so callers — including the adaptive publishability detector — never handle decode failures themselves.

### Why composite SilkWorkspaceAnalyzer?

Workspace analysis coordinates several services in a specific order with error mapping between boundaries. A single composite service provides one entry point for consumers who need a full workspace picture, hiding the orchestration complexity. The individual pieces remain available for consumers who only need one (silk's publishability rule here, versioning/tag classification from the kit).

### Why fixture-driven integration tests?

Schema-decode errors, service-composition bugs and filesystem edge cases only surface against real directory structures. The fixture tree captures real-world workspace layouts that exercise the full analysis pipeline end-to-end, and the fixtures double as living documentation of the supported workspace patterns.
