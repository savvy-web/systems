---
module: silk-effects
category: architecture
status: current
completeness: 95
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ./workspace-analysis.md
  - ./issue-references.md
  - ../changelog/architecture.md
  - ../cli/architecture.md
  - ../mcp/architecture.md
---

# Changesets namespace

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Topology](#topology)
- [Linting: one scanner for two engines](#linting-one-scanner-for-two-engines)
- [ConfigInspector](#configinspector)
- [ReleasePlanner](#releaseplanner)
- [VersionFiles](#versionfiles)
- [DepsRegen and DepsRegenDefault](#depsregen-and-depsregendefault)
- [Changelog rendering](#changelog-rendering)
- [Test-only exports](#test-only-exports)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`Changesets` (`src/changesets/`, `export * as Changesets`) holds the business logic of the former `@savvy-web/changesets` package: the changeset transformer and linter, the changelog renderer, the remark plugins and markdownlint rules and the services that inspect config, plan releases and regenerate dependency changesets. `@savvy-web/cli` consumes it as command logic, `@savvy-web/silk` re-exports it as config shims, `@savvy-web/mcp` surfaces it as tools and `@savvy-web/changelog` is the installable identity of its `changelogFunctions` (`../changelog/architecture.md`).

## Current state

Runs on the changesets **v3 engine** (v3 prereleases included, no v1 packages adapter). Release lines are commit-link-free, changeset-less releases render a `### Maintenance` note and dependency-changeset regeneration resolves catalogs per git ref with cross-seeding. The remark pipeline parses locally but emits through `@effected/markdown`'s canonical stringifier (`src/changesets/utils/remark-pipeline.ts`).

## Topology

`src/changesets/index.ts` is the authoritative listing. By directory: `api/` holds the class wrappers (`ChangesetLinter`, `ChangelogTransformer`, `DependencyTable`, `Categories`, `Changelog`); `services/` the `Context.Service`s (`ConfigInspector`, `BranchAnalyzer`, `ReleasePlanner`, `DepsRegen`, `ChangelogService`, `GitHubService`) plus the pure `deriveMaintenanceReason`; `changelog/` the `getReleaseLine`/`getDependencyReleaseLine` pair and the `vanilla` re-export; `remark/` the plugins, presets and remark-side rules; `markdownlint/` the markdownlint-side rules; `schemas/` the Effect schemas that double as the public result types; `utils/` the shared pure helpers; `vendor/` the adapter over `@changesets/get-github-info`.

Result types are `Schema.Struct`s with derived interfaces, so `@savvy-web/mcp` embeds the same schemas in its tool results (`../mcp/architecture.md`).

## Linting: one scanner for two engines

The five `CSH00x` rules exist twice — as remark rules (behind `ChangesetLinter.validateContent`, which the CLI `check`/`lint` commands and the MCP `changeset_validate` tool run) and as markdownlint rules (behind the pre-commit `markdownlint` config). Two things keep them from drifting: `VERSION_RE` (`schemas/dependency-table.ts`) is the one version pattern both consume, widened to accept `catalog:`/`workspace:`/`npm:` specifiers alongside the em-dash sentinel and semver so a `DepsRegen` raw-protocol fallback is never rejected; and `scanDependencySection` (`utils/dependency-section.ts`) is the one CSH005 decision — a valid five-column table anywhere inside `## Dependencies` satisfies it, prose may surround it and a missing table is reported at the heading in both engines. Rule documentation lives in-repo at `packages/silk-effects/docs/rules/`, which is what `RULE_DOCS` (`constants.ts`) points at.

## ConfigInspector

`ConfigInspector` (`services/config-inspector.ts`; `layer` requires `ChangesetConfigReader | WorkspaceDiscovery | FileSystem`) resolves `.changeset/config.json` into package scopes and classifies file paths against them.

- **Release-surface fallback.** With no explicit `packages` record, scopes are built from the discovered workspace packages that are a release surface, per the pure `SilkPublishability.detect` — except that `privatePackages.version: true` makes *every* workspace package a release surface, using the same truth-table as `ChangesetConfig.versionPrivate`. The `ignore` list is deliberately not consulted: an ignored-but-configured package is still a valid changeset target. This fallback is why the layer needs `FileSystem` (it reads manifests and `targets.json` bindings).
- **Fixed attribution precedence, root last.** `classifyOne` resolves a path in order: directory containment (deepest `workspaceDir` wins), `additionalScopes`, `versionFiles`, then a root-as-package fallback. A scope whose `workspaceDir` is the project dir is held out of the containment pass — every file is "inside" the root, so letting it compete shadowed the `additionalScopes`/`versionFiles` a config declared — and step four still applies the containment check so `../` or absolute inputs outside the repo stay unmapped. `checkConflicts` carves the root out of shadowing validation for the same reason. A path that falls through may carry an `unmappedHint` reason: a `versionFiles`/`additionalScopes` glob names it but no file materializes (deleted targets in branch diffs), or it is in the small static `TEMPLATE_MIRRORS` table of repo files kept in byte-lockstep with a shipped template. The hint is context; `package` stays `null`.
- **Per-call-root discovery.** `inspect` derives its root through `WorkspaceDiscovery.listPackagesIn`, which re-reads beneath the directory it is given (memoized per root), so a git worktree — including a nested `.claude/worktrees/*` checkout — answers from its own manifests rather than the layer-bound root's. `refreshIn` invalidates per root.

## ReleasePlanner

`ReleasePlanner` (`services/release-planner.ts`; `layer` requires `ConfigInspector | FileSystem`) backs `plan`, `preview` and `apply` with the genuine `@changesets/get-release-plan` + `@changesets/apply-release-plan` machinery, so all formatting — dependency tables included — comes from the engine. v3's non-throwing `readConfig` is bridged onto `ReleasePlanError`, its warnings surface via `Effect.logWarning` and one caveat is inherited: v3's `readPreState` auto-migrates a legacy `pre.json` in place, so even the read-only paths can touch disk.

- `preview` is otherwise non-destructive: it runs the real `applyReleasePlan` against a `Scope`-managed temp directory (`makeTempDirectoryScoped`) and reads the rendered CHANGELOG blocks back.
- `apply` is the destructive native release the `savvy changeset version` command runs (no `changeset` binary): bump versions, transform each touched CHANGELOG through `ChangelogTransformer`, update configured version files through `ConfigInspector` + `VersionFiles`. It is deliberately not exposed over MCP; only `preview` is.
- **`changelogModules`** maps configured changelog ids to absolute module paths for no-`node_modules` callers such as a bundled GitHub Action. Both rendering members take it through one shared `withChangelogModules` rewrite (`preview` needs it for the same reason `apply` does — without it `preview` dies inside `import-meta-resolve`); `plan` renders nothing and takes none. When set, `config.changelog[0]` must be a key of the map and the engine's `format` integration is disabled. **Membership is an `Object.hasOwn` check, never `map[id] === undefined`** — an id naming an `Object.prototype` member reads back an inherited function through the latter and skips the typed unmapped-id error.
- Maintenance reasons for changeset-less releases are derived from the release plan and threaded into the transformer on both `preview` and `apply` — see [Changelog rendering](#changelog-rendering).

## VersionFiles

`VersionFiles` (`utils/version-files.ts`) patches version files with format-preserving minimal edits — each configured JSONPath is resolved to concrete paths (`utils/jsonpath.ts`) and applied through `@effected/jsonc`'s `modify` + `applyEdits`, so everything outside the edited span is byte-identical and JSONC survives. Never reintroduce a `JSON.parse`/`JSON.stringify` round-trip. A wildcard-free path whose leaf is missing is inserted with the document's detected indent; wildcard paths update existing matches only; a same-value update is a no-op.

All of its I/O goes through the Effect `FileSystem` (no `node:fs`), which is what lets its tests run on a memfs volume; `JSON.parse` sits inside `Effect.try` because a throw inside `Effect.gen` is a defect the fail-soft `orElseSucceed` wrapping would not recover. **The two process entry points differ in error posture on purpose and must not be re-unified:** the shared private `applyOne` fails typed; `processVersionFiles` (legacy) pipes `Effect.orDie` so a per-file failure stays a defect, matching the synchronous throw it had under `node:fs`; `processResolvedVersionFiles` stays typed because `ReleasePlanner.apply` maps it to `ReleasePlanError`, and a defect there would bypass the catch and crash `apply()`. Both postures are pinned by tests.

## DepsRegen and DepsRegenDefault

`DepsRegen` (`services/deps-regen.ts`) owns the `deps regen`/`deps detect` orchestration. `plan(options)` computes the cumulative dependency diff (merge-base→worktree by default, or explicit refs) and returns a complete, side-effect-free `RegenPlan`; `execute(plan)` applies exactly the deletes and writes the plan describes, so dry-run is `plan()` plus rendering. Result contracts are schemas in `schemas/deps-regen.ts`.

- **Both diff sides are snapshotted through the kit's `WorkspaceSnapshots`**, each at its own ref (or the worktree) with its own catalogs, so `catalog:`/`workspace:` specifiers resolve per side to concrete versions *before* the two `WorkspaceStateSnapshot`s are diffed (`utils/dep-diff.ts`); rows equal on both sides are suppressed. Before resolving, the sides are cross-seeded with each other's catalogs at lower precedence via the kit's `WorkspaceStateSnapshot.crossSeed`: a catalog injected by a config-dependency pnpmfile hook is visible only where hook replay ran — never at a git ref — so without seeding the ref side answered from lockfile importers with a concrete version against the worktree's declared range and fabricated a caret→exact row nothing touched. Each side stays authoritative for what it declares; the documented limitation is the inverse — a range change made purely by bumping the config dependency between refs is suppressed.
- `devDependency` rows are dropped unless `includeDevDeps` is set (`deps detect` sets it; `deps regen` does not). `isPureDependencyChangeset` is the strict detection rule — single-package frontmatter, exactly one `## Dependencies` heading, no other body — so mixed changesets are never touched. `coexisting` lists prose-only changesets releasing an in-scope package: informational, never touched, parsed leniently by `parseChangesetPackages`.
- **Gating:** a package is in scope for writes when it is `publishable OR privatePackages.version` and not on the changeset ignore list — ignore wins over an explicit `--package`. **Deletion is strictly narrower:** a pure-dependency changeset is deleted only when its package is in scope *and* rewritten this run (present in `toWrite`) *and* the file was authored on this branch rather than tracked at the merge-base ref (`gitListChangesetFilesAtRef`, tolerant). Either gap destroyed a still-relevant release note with nothing recreated.
- `plan()` opens by refreshing `ConfigInspector` and `ChangesetConfig`, because both caches never self-expire and the `savvy-mcp` server holds one `DepsRegen` for its whole process. Writes are loud, deletes are tolerant and the plan writes before it deletes so an interrupted run is re-runnable; file I/O failures surface as `ChangesetIOError`.

`DepsRegen.layer` is the seam for callers injecting their own dependencies. `makeDepsRegenDefault(options)` and the pre-bound `DepsRegenDefault` compose the batteries-included graph — the kit's `Workspaces.layerWithGitAndConfigDependenciesSubprocess` (config-dependency hook replay in catalog assembly, which is what makes a worktree snapshot carry hook-injected catalogs) plus `ConfigInspector.layer` and `SilkPublishability.layerAdaptive` — leaving only `FileSystem | Path | ChildProcessSpawner` open. The *subprocess* replay variant is deliberate: the consumers are bundled, and a bundler compiles the in-process replay's computed dynamic `import()` into an unresolvable context module. The kit mints a fresh layer per call, so the graph is bound once per builder call; the graph is root-bound at build time, which is why the CLI builds it per invocation and the MCP server once (`../cli/architecture.md`, `../mcp/architecture.md`). Because `WorkspaceSnapshots` reads git history, the platform layer must be spawn-capable.

## Changelog rendering

- **Release lines carry no commit-link prefixes.** Squash-merge workflows make per-changeset commit links point at squash commits, so `getReleaseLine` and `formatChangelogEntry` render none; authored links, issue refs and PR/user attribution are unchanged. A consequence is that identical summaries from separate changesets now genuinely deduplicate — `DeduplicateItemsPlugin`'s seen-set spans all list nodes in a section, because `MergeSectionsPlugin` splices duplicate sections in as sibling lists.
- **The renderer is AST-native.** `parseChangesetSections` (`utils/section-parser.ts`) exposes each section's MDAST `contentNodes`, and `renderSectionNode` (`changelog/getReleaseLine.ts`) decides on node type, never string prefixes: a paragraph becomes a `-` bullet with continuation lines indented; a heading is promoted one level and clamped to depths 4–6 so a changeset `###` can never collide with the changelog's depth-3 category headings; everything else (tables, fences, blockquotes, lists) passes through verbatim as a block. Attribution attaches to the last paragraph of the entry, never into a table cell or heading. `__test__/changesets/pipeline__corpus.test.ts` pins whole rendered entries end to end.
- **Dependency tables carry their own `### Dependencies` heading**, which `AggregateDependencyTablesPlugin` uses to locate and merge per-package tables into one per version block, unwrapping legacy bullet-wrapped tables so historical CHANGELOG shapes converge instead of accumulating duplicates.
- **Thanks aggregate into a `### Thanks` section pinned last** (`ContributorFootnotesPlugin`, priority 1000 in `ReorderSectionsPlugin`). It is the one preset member with an option: `thanks: false` on the changelog options strips attribution entirely while PR references stay (provenance, not thanks); `getReleaseLine` honors the same flag.
- **Changeset-less releases render a Maintenance note.** A release forced by a `fixed`/`linked` co-member is classified by the pure `deriveMaintenanceReason` (group matching via `ChangesetConfig.matches`; richer globs degrade to a generic sentence). `MaintenanceNotePlugin` is deliberately *not* a preset member — it is parameterized per version block by `ReleasePlanner` and fires only on a structurally empty block, so a dependency-bump-only release keeps its table and the note is idempotent.
- `ChangelogTransformer.transformContent` iterates `SilkChangesetTransformPreset` (`remark/presets.ts`) rather than hand-listing plugins, so the chain cannot drift from the preset. `vanillaChangelogFunctions` re-exports `@changesets/changelog-git` at exact upstream parity for consumers who want the stock renderer.

Issue references inside changeset bodies are parsed by the kit grammar — see [Issue references](./issue-references.md).

## Test-only exports

`withChangelogModules` and `extractVersionBlock` carry a bare `export` from `services/release-planner.ts` so tests can import them by source path, and are deliberately absent from `src/changesets/index.ts`. `withChangelogModules` needs direct coverage because the `format: false` half of its rewrite is not observable through the engine: every `format` value resolves through `npx` or an ambient binary, so an engine-level fixture asserts what the host has installed, not what the rewrite did. `__test__/changesets/services__release-planner-changelog-modules.test.ts` owns the rewrite's semantics; the preview/apply suites own the engine wiring around it.

## Rationale

### Why drive the real engine

Re-implementing changesets' release planning would have meant a second formatter for dependency tables and a second source of truth for version resolution; driving `@changesets/*` directly means every rendering rule comes from the engine, and the only silk additions are the transform preset and the version-file patching layered around it.

### Why plan and execute are split

Detect and regen share one code path only if the plan is a complete value: the read-only tool renders the same object the write path applies, so a preview can never disagree with the action it previews.

### Why cross-seed rather than replay hooks at a ref

Hook replay needs a checked-out tree; a git ref has none. Seeding the ref side with the worktree's catalogs at lower precedence is the smallest change that stops a protocol difference from masquerading as a version change, at the cost of one documented blind spot.

## Related documentation

- [Architecture overview](./architecture.md)
- [Publishability and workspace analysis](./workspace-analysis.md) — `detect`, `ChangesetConfig`
- [Issue references](./issue-references.md)
- [`../changelog/architecture.md`](../changelog/architecture.md) — the installable changelog identity
- [`../cli/architecture.md`](../cli/architecture.md) and [`../mcp/architecture.md`](../mcp/architecture.md) — the command and tool adapters
