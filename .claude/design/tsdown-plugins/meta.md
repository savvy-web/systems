---
status: current
module: tsdown-plugins
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ./architecture.md
  - ./build-loop.md
  - ./dts-emission.md
  - ./report.md
  - ../bundler/architecture.md
  - ../silk-effects/architecture.md
---

# Meta generation

`src/meta/` holds all the API Extractor meta behavior the bundler wires; the bundler owns no meta logic of its own. Meta is the `.api.json` model emitted into each prod group's `meta/` bundle and into other packages' `localPaths` for downstream API-doc consumers. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The pipeline](#the-pipeline)
- [The two-input split](#the-two-input-split)
- [Message routing and CI escalation](#message-routing-and-ci-escalation)
- [The virtual TS env trio](#the-virtual-ts-env-trio)
- [Optimistic next versions](#optimistic-next-versions)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`runMetaPass` runs during `--target prod` over each group's already-emitted bundled `.d.ts` and its catalog-resolved prod `package.json`; API Extractor never re-runs the tsdown bundle. It is the single meta entry point that the front door and both self-hosting escape hatches call. Meta reads prod output, not dev, because the dev manifest keeps unresolved `catalog:`/`workspace:` specifiers.

## Current state

- **Orchestration:** `runMetaPass` + `deriveExportPaths`/`applySubdirMetaEntries` (`src/meta/run-pass.ts`); `generateMeta` (`src/meta/generate.ts`); `runApiExtractor`/`writeApiExtractorTsconfig`/`mapExtractorMessage` (`src/meta/api-extractor.ts`).
- **Support:** `normalizeMetaOptions` + the `MetaOptions` types (`config.ts`), `createMessageSuppressor` (`message-suppressor.ts`), `buildTsdocConfig`/`writeTsdocConfig` (`tsdoc-config.ts`), `mergeApiModels`/`rewriteCanonicalReferences` (`merge-models.ts`), `rewriteMetaVersions` (`optimistic.ts`), `resolvePortableTsconfig` (`tsconfig-resolver.ts`).
- **Next versions:** `resolveNextVersions` (`src/changesets/next-versions.ts`).
- **Errors:** `MetaGenerationError` (`src/errors.ts`), thrown by `runApiExtractor` on a failed extraction.

## The pipeline

- **`runMetaPass`** — the per-group orchestrator. It normalizes `MetaOptions`, picks the **canonical group** (the one whose name matches the package, else the first), builds the entry maps while dropping `bin/`-prefixed entries (a bin has no emitted `.d.ts`), derives export paths, repoints each `outSubdir` override's dts basename to `<outSubdir>/index`, resolves the optimistic next-versions once, then loops `generateMeta` once per prod group — each against its own `dist/prod/<id>/pkg`, with `aeInputDir` set to that group's `declarations/` tree, `localPaths` only on the canonical group and diagnostics routed to the collector. `resolveNextVersions` and `generateMeta` are injectable for tests.
- **`generateMeta`** — the per-entry orchestrator. It writes `tsdoc.json`, runs the extractor per entry (see the split below), takes the single model or `mergeApiModels` for multi-entry packages, writes the virtual TS env trio to `outMetaDir`, copies it into each `localPaths` dir and removes the per-entry intermediates. The api-extractor `tsdoc-metadata.json` is written into the built `pkg/` — a published-package artifact — not into the meta bundle.
- **`runApiExtractor`** — the single-entry wrapper over `@microsoft/api-extractor`, configured in memory via `ExtractorConfig.prepare({ configObject })` with `dtsRollup`/`apiReport` disabled. The extractor gets **its own files-scoped tsconfig** from `writeApiExtractorTsconfig`: a temp config that `extends` the resolved one by absolute path but replaces the input set with exactly the entry `.d.ts` plus `types/*.d.ts`. The compile tsconfig's `src/**` include is necessary for dts emit but poison for the extractor — a hand-authored `src/*.d.ts` shim matched by that glob pulls raw `.ts` sources into the Program via the source manifest's `exports` and fires an unsuppressable `ae-wrong-input-file-type`. The doc model is built with `includeForgottenExports: true` so referenced-but-unexported declarations — notably the synthetic `*_base` class TypeScript hoists for Effect class mixins — stay in the model instead of being dropped, keeping it reconstructable downstream.
- **`mergeApiModels`/`rewriteCanonicalReferences`** — a hand-rolled JSON merge keeping the `.` entry canonical and rewriting sub-entry references to `${packageName}/${subpath}!`. Known limitation: it walks `members` only, not `excerptTokens[*].canonicalReference` or `references[*]`, so a cross-entry `@link` authored in a sub-entry may not be rewritten.
- **`buildTsdocConfig`/`writeTsdocConfig`** — deterministic, idempotent `tsdoc.json` emission behind a deep-equal write guard.

## The two-input split

For each entry `generateMeta` runs API Extractor twice when `aeInputDir` differs from `dtsDir` (which it does whenever the build emitted the declarations pass — see [The build loop](./build-loop.md#the-passes)); otherwise the two collapse into one run.

- **Run A** reads the bundled `pkg/<entry>.d.ts` and produces the shipped `.api.json`. Its `fileUrlPath` and excerpts are stable because the bundled input is stable (see [Declaration emission](./dts-emission.md#per-entry-rollups-and-determinism)).
- **Run B** reads the per-module `declarations/<entry>.d.ts` with `emitDocModel: false` to harvest `ae-*`/`tsdoc-*` diagnostics whose locations resolve to the true source declaration, because each per-module `.d.ts.map` references only its own file. Run B is wrapped so a failure degrades to a warning rather than breaking a build whose model already succeeded.
- **Channel routing.** The `ci` escalation switch goes to Run A only; `onSuppressed` and the caller's `onMessage` go to Run B in split mode. Run A's ordinary diagnostics are silenced when Run B will re-harvest them with accurate locations.
- **The rollup-only fatal.** A CI-fatal `ae-forgotten-export` can exist only in the bundled rollup — an external type inlined into the `.d.ts` drags in symbols the entry does not export, while Run B's per-module input keeps that package an external import. Locally, Run A captures its `ciFatal` messages and, after Run B, surfaces the ones Run B did not also report, with the unreliable rollup location stripped (deduped on `code` + `text` against Run B's own CI-fatal entries only). Under CI the escalation makes Run A throw before Run B runs, so Run A forwards its error-level diagnostics straight to the collector first — the failure report names the symbol instead of an opaque count.

## Message routing and CI escalation

Without an `api-extractor.json` file the default message router routes every category at `logLevel: none`, so analyzer and tsdoc messages would reach the callback already silenced and `mapExtractorMessage` (which keys off `logLevel`) would drop them. Two routing decisions therefore hold:

- The `messages` config routes `extractorMessageReporting` and `tsdocMessageReporting` defaults to `warning`, with `ae-internal-missing-underscore` back to `none` (the monorepo does not use the underscore convention for `@internal` exports). `compilerMessageReporting` stays at `none`: API Extractor analyzes the already-typechecked `.d.ts` with its own bundled TypeScript, whose skew against the project compiler emits spurious third-party diagnostics.
- Under `ci`, `ae-forgotten-export` escalates to `error` and fails the build via `MetaGenerationError`; locally it stays a warning tagged `ciFatal`. With `includeForgottenExports` the symbol stays in the model regardless, so the escalation is not about model corruption — it flags a developer who genuinely forgot to export one of their own public symbols.

**Suppression wins over both.** A `suppressWarnings` match (`createMessageSuppressor`: messageId exact-match plus optional regex/substring on the text) is mapped for `onSuppressed` accounting and then set to `None` before it can count toward totals. The self-build uses this for the `_base` synthetics Effect's class mixins generate.

## The virtual TS env trio

The meta bundle written to `outMetaDir` is `<unscoped>.api.json` plus the final transformed `package.json` plus a portable `tsconfig.json`, so a downstream virtual TypeScript environment (shiki/Twoslash, API Extractor) can load the model self-contained. `resolvePortableTsconfig(cwd, fallbackConfigPath?)` resolves the package's own `tsconfig.json` effective options through `@effected/tsconfig-json`'s `TsconfigLoaderSync` (following `extends`), then projects them through the kit's `PortableTsconfig.make` allow-list — compilerOptions only, no absolute paths or emit/file-selection options, `types` kept because it names `@types/*` packages the virtual env must load. It falls back to the build's resolved dts tsconfig, then to a minimal virtual-env config; a loader throw is re-wrapped with the path as context, matching `buildResolvedTsconfig` (see [Declaration emission](./dts-emission.md#the-resolved-dts-tsconfig)).

## Optimistic next versions

`MetaOptions.optimistic` (`"auto" | boolean`, default `"auto"`) resolves to `false` under CI and `true` locally. When on, `runMetaPass` resolves every workspace package's *next* release version from pending changesets and passes `rewriteMetaVersions` as the `manifestTransform` `generateMeta` applies to the bundle `package.json` — bumping the manifest's own `version` and any workspace-sibling dependency to its next value, leaving external and catalog-resolved deps untouched, never mutating the input.

`resolveNextVersions` runs `@changesets/get-release-plan` over `@effected/workspaces`' `WorkspaceDiscovery.listPackages()`, building a fresh layer per call because `cwd` differs per invocation and layers memoize by reference. It **never rejects**: any failure (not a workspace, no `.changeset/config.json`, a parse error) degrades to current versions or an empty map. It is a **deliberate second copy** of silk-effects' `ReleasePlanner.plan` slice (see `../silk-effects/architecture.md`) — silk-effects is built by this toolchain, so importing it would create a package build cycle.

## Boundaries and invariants

- **All meta behavior lives here.** `runMetaPass` is the single entry point the front door and both escape hatches call; the bundler's `run.ts` owns no inline meta loop.
- **Meta runs over already-emitted prod `.d.ts`, never re-bundling**, and before `removeDeclarationMaps` strips the maps it reads.
- **The extractor never receives the compile tsconfig verbatim**; it gets the files-scoped variant from `writeApiExtractorTsconfig`, and never the `stableTypeOrdering` emit variant.
- **The shipped model comes from Run A; accurate diagnostics come from Run B.** The CI gate lives on Run A only; Run B failure is non-fatal.
- **`ae-forgotten-export` is CI-fatal and locally `ciFatal`-tagged; suppression wins over escalation.**
- **`resolveNextVersions` never rejects and never imports silk-effects.**
- **Only the canonical group copies into `localPaths`**; every prod group gets its own `meta/` bundle.

## Rationale

### Why two extractor runs

The bundled `.d.ts` is what ships, so the model has to come from it, but a rolled-up file's source maps point at wherever the roll-up placed a declaration, not where the developer wrote it — diagnostics against it named adjacent declarations. The per-module declarations tree has one-to-one positions but is never published. Reading the model from one input and the diagnostics from the other gets both right, at the cost of a second analysis whose failure is deliberately non-fatal.

### Why the model keeps forgotten exports

Dropping a referenced-but-unexported declaration (API Extractor's default) leaves a model that cannot be reconstructed downstream — the Effect mixin `_base` classes are the common case. Keeping them in the model and reporting the human mistake as a diagnostic are two orthogonal knobs, and this pipeline sets both.

### Why optimistic versions are local-only

A locally generated meta bundle is consumed by the docs site before the release lands, so it should carry the versions the pending changesets will produce. In CI the release plan is about to be applied for real, so the bundle must record current versions.
