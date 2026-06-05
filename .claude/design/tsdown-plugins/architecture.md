---
status: current
module: tsdown-plugins
category: architecture
created: 2026-06-05
updated: 2026-06-05
last-synced: 2026-06-05
completeness: 85
related:
  - ../bundler/architecture.md
  - ../cli/architecture.md
dependencies:
  - ../bundler/architecture.md
---

# @savvy-web/tsdown-plugins architecture

The interface-only plugin pack that holds every build behavior `@savvy-web/bundler` drives — entry detection, manifest emission, catalog resolution, the dts tsconfig port, the per-TargetGroup build loop, the full Effect output reporter and the API Extractor meta-generation pipeline. Authored against rolldown's plugin *type* only, so it imports no tsdown runtime and carries no tsdown peer dependency. This doc covers the SP1 foundation plus the Track A meta capability.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The interface-only boundary](#the-interface-only-boundary)
- [Effect service and helper map](#effect-service-and-helper-map)
- [Entry detection](#entry-detection)
- [Manifest emission and catalog delegation](#manifest-emission-and-catalog-delegation)
- [The dts resolved-tsconfig port](#the-dts-resolved-tsconfig-port)
- [The per-TargetGroup build loop](#the-per-targetgroup-build-loop)
- [The output reporter](#the-output-reporter)
- [The meta-generation pipeline](#the-meta-generation-pipeline)
- [The escape-hatch contract](#the-escape-hatch-contract)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/tsdown-plugins` is the building blocks; `@savvy-web/bundler` is the thin orchestrator over them (see `../bundler/architecture.md`). Everything the bundler's front door does is exposed here as a helper or a rolldown `Plugin`, so a hand-written `tsdown.config.ts` reproduces the front door by importing the same surface — the published escape hatch.

The package is implemented in Effect (`Data.TaggedError` typed errors, `Context.Tag` services, `Schema`, `Layer`s for the reporter), but Effect runs *behind* the tsdown plugin boundary: the catalog wrapper exposes a `Promise`, and the reporter is rendered via `Effect.runPromise` at the bundler's call site. The plugin objects themselves stay plain rolldown-conformant values.

**Package:** `@savvy-web/tsdown-plugins`
**Location:** `packages/tsdown-plugins` in `savvy-web/systems`
**Public surface:** `src/index.ts` — the semver'd export surface (entry helpers, manifest transforms + `emitManifest`, `resolveManifest`, dts tsconfig helpers, `deriveTargetGroupOptions`/`buildTargetGroups`, the reporter pipeline + formatters + `BuildReport` schema, the meta surface `normalizeMetaOptions`/`generateMeta` + its option/result types + `MetaGenerationError`, re-exported catalog errors)
**Versioning:** independent; auto-bumps the bundler when it changes.
**Status:** Silk bundler program SP1 (Foundation). Spec/plan (local/gitignored): `docs/superpowers/specs/2026-06-04-savvy-bundler-sp1-foundation-design.md`, `docs/superpowers/plans/2026-06-04-savvy-bundler-sp1.md`.

## Current State

SP1 implemented, plus Track A (API Extractor meta generation, the `src/meta/` module). Built by `@savvy-web/rslib-builder` until the stack self-hosts (post-SP1). Runtime `dependencies` are `workspaces-effect` (`^1.2.0`, for `CatalogResolver`), `@effect/platform-node` (provides `NodeContext` at the resolution boundary), `sort-package-json`, `std-env`, `picocolors`, `json-schema-effect`, plus the meta deps `@microsoft/api-extractor`, `@microsoft/tsdoc`, `@microsoft/tsdoc-config` and `deep-equal`; `effect` is a `catalog:silkPeers` peer. `tsdown`/`rolldown` are devDependencies — types only.

Out of SP1/Track A: the SP2 preflight findings the reporter will later carry, multi-byte-variant manifests (SP4), dual-format CJS interop. The error set, formatter set and service set are discoverable in source — this doc documents the topology, not the enumerations.

## The interface-only boundary

The cardinal architectural decision: **plugins are authored against `import type { Plugin } from "rolldown"` only.** No tsdown runtime is imported anywhere in the source except one lazy dynamic import behind an injectable seam (`build-target-groups.ts` does `(await import("tsdown")).build` only when the caller does not inject a `build` fn). Consequences:

- No tsdown peer dependency. The bundler brings tsdown; an escape-hatch user brings their own. A documented compat range against tsdown's plugin type is the only coupling.
- Effect lives behind the boundary. Plugin hooks and the catalog wrapper present plain values (`Plugin`, `Promise`); the bundler runs the reporter Effect at its own call site.

## Effect service and helper map

The surface divides into pure helpers, one rolldown plugin, one async catalog wrapper and the reporter's Effect services. Point of entry for each is its source file:

- **Entry:** `extractEntries` (pure, `src/entry/extract.ts`), `packageJsonEntries` (`src/entry/package-json-entries.ts`).
- **Manifest:** pure transforms `transformManifest`/`transformExports`/`transformBin`/`normalizeBinPaths` (`src/manifest/transform.ts`); the `emitManifest` rolldown plugin + `buildEmittedManifest` (`src/manifest/emit-manifest.ts`).
- **Catalog:** `resolveManifest` — a thin async `Promise` wrapper over `workspaces-effect`'s `CatalogResolver` (`src/catalog/resolve-catalogs.ts`).
- **dts:** `buildResolvedTsconfig`/`writeResolvedTsconfig` (`src/dts/resolved-tsconfig.ts`).
- **Build loop:** `deriveTargetGroupOptions` (pure, `src/build/target-groups.ts`), `buildTargetGroups` (`src/build/build-target-groups.ts`).
- **Reporter:** four `Context.Tag` services `EnvironmentDetector → ExecutorResolver → FormatSelector → OutputRenderer` each with a sibling `*Live` layer, composed into `ReportPipelineLive`; the `renderReport` program; five formatters; the `BuildReport` `Schema` and its SchemaStore export. See [The output reporter](#the-output-reporter).
- **Meta:** the `src/meta/` module — `normalizeMetaOptions` + types (`config.ts`), `createMessageSuppressor` (`message-suppressor.ts`), `buildTsdocConfig`/`writeTsdocConfig` (`tsdoc-config.ts`), `mergeApiModels`/`rewriteCanonicalReferences` (`merge-models.ts`), `runApiExtractor` (`api-extractor.ts`) and the `generateMeta` orchestrator (`generate.ts`). See [The meta-generation pipeline](#the-meta-generation-pipeline).
- **Errors:** typed `Data.TaggedError`s in `src/errors.ts` (including `MetaGenerationError`, thrown by `runApiExtractor` on a failed extraction and re-exported from `src/index.ts` so consumers can `catchTag` meta failures by type); the catalog errors (`CatalogAssemblyError`, `CatalogResolutionError`) are owned by `workspaces-effect` and re-exported from `src/index.ts` so consumers and the reporter can `catchTag` them.

## Entry detection

`extractEntries` ports rslib-builder's `EntryExtractor` rules **exactly** — this is core identity that must not drift. The rules (source of truth if in doubt: rslib `entry-extractor.ts`): read `exports`; skip `./package.json` and any `*.json`; resolve an export value as `import || default || types` (never `require`); `resolveToTypeScript` remaps `/dist/`→`/src/` and `.js`→`.ts`; keep only `.ts`/`.tsx`; name `.`→`index`, else strip leading `./` and flatten `/`→`-` (or nest under `<name>/index` when `exportsAsIndexes`); `bin` string → `bin/cli`, object → `bin/<command>`, each through `resolveToTypeScript`. `packageJsonEntries` is the tsdown-facing wrapper returning the `Record<name, path>` that tsdown's `entry` accepts, reading either an in-memory package.json or `<cwd>/package.json`.

## Manifest emission and catalog delegation

`emitManifest` is the one rolldown plugin: in `generateBundle` it reads the source `package.json`, builds the transformed manifest via `buildEmittedManifest`, emits it as `package.json` into the output `pkg/` and copies `LICENSE`/`README.md`. The transform pipeline (ported from rslib's `package-json-transformer.ts`): resolve catalogs (prod, or dev when `devManifest: "resolve"`) → strip `publishConfig`/`scripts` → set `private` from `publishConfig.access` → rewrite `exports`/`bin`/`types` to built `.js`/`.d.ts` → run the user `transform({ pkg, targetGroup })` → **strip leading `./` from bin paths as the final guard** (npm 11.x silently drops `./`-prefixed bins) → `sort-package-json`. The `__PACKAGE_VERSION__` define is injected by the build loop, not here.

**Catalog delegation is the key revision from the original plan and the load-bearing topology fact here.** `resolveManifest` does *not* reimplement catalog/`workspace:` resolution — it wraps `workspaces-effect`'s `CatalogResolver`, which assembles a workspace's complete pnpm catalog set generically (inline `pnpm-workspace.yaml` + config-dependency pnpmfile hook-replay + lockfile) and resolves specifiers durably **without** depending on the transient `.pnpm-workspace-state-v1.json` — the fix for the `catalog:silkPeers` ordering bug. The resolver discovers the workspace root from `process.cwd()` (no cwd parameter), so `resolveManifest` must run from inside the target workspace; catalogs are workspace-wide so any cwd inside it yields the same set. `buildEmittedManifest` only resolves when `targetGroup.isProd || devManifest === "resolve"`, so a `dev` group with `devManifest: "preserve"` (the default) keeps `catalog:`/`workspace:` specifiers intact for injected dev packages to resolve through the workspace.

## The dts resolved-tsconfig port

SP1 decision: **tsdown native dts on the tsc path, NOT isolatedDeclarations.** Without `isolatedDeclarations`, rolldown-plugin-dts falls back to the TS compiler for emit, which under pnpm symlinks reproduces rslib's TS2742/TS2883 portability failures. The fix is ported from rslib's `writeBundleTempConfig`: `writeResolvedTsconfig` writes a temp tsconfig with **absolute** `rootDir`/`include`/`typeRoots`, explicit `types` (forwarded from the project tsconfig, default `["node"]`) and `composite: false`/`incremental: false` so stale build info never skips emit. The orchestrator passes that temp path to tsdown's `dts: { tsconfig }`. See `src/dts/resolved-tsconfig.ts` for the exact compilerOptions.

## The per-TargetGroup build loop

`deriveTargetGroupOptions` (pure) maps a `TargetGroupId` (`"dev" | "npm"`) to the tsdown options: `outDir` (`dev → dist/dev/pkg`, prod → `dist/prod/<group>/pkg`), `sourcemap`/`minify` (dev lenient, prod minified), `format: ["esm"]`, `unbundle: true`, `platform: "node"`, `fixedExtension: false`, the `dts.tsconfig` path and the `__PACKAGE_VERSION__` define. `buildTargetGroups` runs `tsdown.build()` once per group with `config: false`, wiring in the per-group `emitManifest` plugin, `deps.neverBundle` externals and a `public/` auto-copy. Two SP1 facts cross into tsdown here: `unbundle: true` is the `disableSharedChunks` analogue (rolldown `preserveModules`, no shared runtime chunk), and `fixedExtension: false` forces package-`type`-ambient extensions over tsdown's node default. The loop is exposed as a composable helper — **not** locked inside the bundler — so the escape hatch gets multi-group builds too. `tsdown.build` is injectable on the options for tests, the only place tsdown's runtime is touched.

## The output reporter

Mirrored (copied, not shared) from the `spencerbeggs/vitest-llm-reporter` / `vitest-agent-reporter` pattern — own the code now, consolidate to a shared package later only if it proves worth it. It replaces rslib's `build-logger.ts` (rsbuild-logger-coupled, human-only); the generic `createTimer`/`formatTime` helpers carry over (`src/report/timer.ts`).

- **Pipeline:** four `Context.Tag` services with `*Live` layers — `EnvironmentDetector → ExecutorResolver → FormatSelector → OutputRenderer` — composed in `ReportPipelineLive`. `renderReport(reports, options)` is the Effect program threading them (`src/report/pipeline.ts`); the bundler runs it via `Effect.runPromise`.
- **Modes/executors:** `human` (pretty terminal, picocolors), `agent` (markdown, failures-first/deduped/token-efficient — the agent-token-burn fix), `ci` (GitHub `::error::` annotations).
- **Mode selection:** auto-detect via `std-env` (`isAgent`) > `GITHUB_ACTIONS` > `CI` > TTY default; explicit override wins (`output.format` in `savvy.build.ts`, or a `--format` flag). Precedence is settled in `FormatSelector.select(executor, explicitFormat?, env?)`.
- **Formatter contract:** `render(reports, ctx) → RenderedOutput[]`, each `{ target, content, contentType }`, sync and pure. Formatters: `terminal`, `json`, `markdown`, `ci-annotations`, `silent`.
- **`BuildReport` Schema (SP1 shape):** per package → per TargetGroup `{ entries, emittedFiles, timings, warnings[], errors[] }`. SP2 extends it with `wouldFailProd[]`. A SchemaStore-compatible JSON Schema is emitted via `json-schema-effect` (`src/report/schema-export.ts`) so the structured `json`/`markdown` output validates and editors get autocomplete.

## The meta-generation pipeline

Track A added `src/meta/`, which holds **all** the meta behavior the bundler wires; the bundler owns no meta logic of its own (see `../bundler/architecture.md`). Meta is the API Extractor `.api.json` model the bundler emits into other packages' `localPaths` (for downstream API-doc consumers like mcp) and, on a prod build, into the `meta/` release-asset bundle. It is deliberately **decoupled from the prod tsdown build**: generating meta runs API Extractor over the already-emitted dev `.d.ts`, not as part of bundling.

The module is a set of separately-tested units; each file is the source of truth for its own mechanics:

- **`generateMeta` (`generate.ts`)** — the orchestrator. Writes `tsdoc.json`, runs the extractor once per entry into `outMetaDir`, takes the single model or `mergeApiModels` when more than one entry, writes `<unscoped>.api.json` + `tsdoc-metadata.json` (main entry only) + a copied resolved `tsconfig.json` into `outMetaDir`, copies that bundle into each `localPaths` dir, and removes the per-entry `*.entry.api.json` intermediates so they never leak into the bundle.
- **`runApiExtractor` (`api-extractor.ts`)** — single-entry wrapper over the real `@microsoft/api-extractor`, configured in-memory via `ExtractorConfig.prepare({ configObject })` (no `api-extractor.json` file) with `dtsRollup`/`apiReport` disabled and the message suppressor wired into the `messageCallback`. It runs over the tsdown-emitted per-file `.d.ts` (unbundle dts) using the SP1 resolved tsconfig — **not** rslib's spawn-tsgo-to-temp approach.
- **`mergeApiModels`/`rewriteCanonicalReferences` (`merge-models.ts`)** — multi-entry merge, ported verbatim from rslib-builder, using hand-rolled JSON surgery rather than `@microsoft/api-extractor-model`. Keeps the main `.` entry canonical and rewrites sub-entry canonical references to `${packageName}/${subpath}!`.
- **`buildTsdocConfig`/`writeTsdocConfig` (`tsdoc-config.ts`)** — deterministic, idempotent `tsdoc.json` emission, standard tags populated from `@microsoft/tsdoc`'s `StandardTags`, behind a deep-equal write guard so an unchanged config is not rewritten.
- **`createMessageSuppressor` (`message-suppressor.ts`)** — an API Extractor message matcher (messageId exact-match AND optional regex/substring on the text, with a regex→substring fallback).
- **`normalizeMetaOptions` + types (`config.ts`)** — `MetaOptions`/`TsdocOptions`/`TsdocTagDefinition`/`WarningSuppressionRule`/`NormalizedMeta`.

**Known limitation (verbatim parity port):** `rewriteCanonicalReferences` only walks `members`, not `excerptTokens[*].canonicalReference` or `references[*]`, so cross-entry `@link`s authored in a sub-entry may not be rewritten. This matches rslib-builder's behavior and is not fixed by Track A.

## The escape-hatch contract

A power user composes the same plugins by hand:

```ts
import { defineConfig } from "tsdown";
import { packageJsonEntries, emitManifest } from "@savvy-web/tsdown-plugins";

export default defineConfig({
  entry: packageJsonEntries(),
  plugins: [emitManifest({ /* ... */ })],
  // …override anything tsdown natively supports
});
```

Four guarantees hold this together: **parity** (the plugins *are* the front door's building blocks), **stability** (the plugin API in `src/index.ts` is the semver'd public surface, not leaked bundler internals), **interface-only coupling** (plugins target rolldown's plugin type with a documented compat range; the user brings their own tsdown) and **no second-class paths** (anything the orchestrator does that isn't a plugin — the multi-group loop — is still a helper, `buildTargetGroups`).

## Boundaries and Invariants

- **Interface-only to tsdown.** Type-only imports of rolldown's `Plugin`; the single `import("tsdown")` is lazy and injectable. No tsdown peer dependency.
- **No catalog-source logic.** `resolveManifest` delegates entirely to `workspaces-effect`'s `CatalogResolver`; the catalog error types are re-exported, not redefined.
- **Effect stays behind the boundary.** Plugin objects and `resolveManifest` are plain values/Promises; the reporter Effect is run by the consumer.
- **Entry rules and the bin leading-`./` strip are exact rslib parity** — they must not drift, since they determine output bytes and (for bins) npm-install correctness.
- **All meta behavior lives here.** `generateMeta` and its units own the API Extractor pipeline; the bundler only wires it. Meta runs over the emitted dev `.d.ts`, decoupled from the prod tsdown build.
- **`src/index.ts` is the semver'd contract.** It is what the escape hatch and the bundler both depend on.

## Rationale

### Why interface-only, not a tsdown peer

A maintained peer on the bundler core is exactly the drift that triggered this program (rslib-builder's `@rslib/core` peer). Coupling to tsdown's plugin *type* with a documented compat range — and letting the bundler/escape-hatch user supply the runtime — keeps a tsdown upgrade a single bundler release rather than an ecosystem-wide peer bump.

### Why delegate catalog resolution to workspaces-effect

The original plan reproduced rslib's multi-source catalog merge here and shipped a silk-specific durable asset to fix the state-file ordering bug. `workspaces-effect@^1.2.0` shipped a generic, durable `CatalogResolver` that already solves it (with its own state-file-absent regression test), so this package wraps it in a few lines instead of owning the logic — deleting a milestone of cross-repo work. The trade is the `process.cwd()` workspace-discovery constraint documented above.

### Why copy the reporter instead of sharing

The vitest reporter pattern is proven but the SP1 `BuildReport` is intentionally simpler than vitest-agent's `AgentReport`. Owning the code now keeps the bundler shippable without coupling to an external reporter package's release cadence; a shared/extracted reporting package is a later consolidation if it earns its keep.
