---
status: current
module: tsdown-plugins
category: architecture
created: 2026-06-05
updated: 2026-06-05
last-synced: 2026-06-05
completeness: 88
related:
  - ../bundler/architecture.md
  - ../cli/architecture.md
dependencies:
  - ../bundler/architecture.md
---

# @savvy-web/tsdown-plugins architecture

The interface-only plugin pack that holds every build behavior `@savvy-web/bundler` drives — entry detection, manifest emission, catalog resolution, the dts tsconfig port, the per-TargetGroup build loop, the full Effect output reporter, the API Extractor meta-generation pipeline, the `publishConfig.targets` derivation, the JSX tsconfig→rolldown mapping, the SEA exe-compile wrapper and the fast-fail config validator. Authored against rolldown's plugin *type* only, so it imports no tsdown runtime and carries no tsdown peer dependency. This doc covers the SP1 foundation plus Track A (meta), Track C (multi-target derivation), Track D (JSX/React) and Track B (SEA executables) plus the §8 config-validation service.

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
- [The targets derivation](#the-targets-derivation)
- [JSX resolution](#jsx-resolution)
- [The SEA exe-compile wrapper](#the-sea-exe-compile-wrapper)
- [The config-validation service](#the-config-validation-service)
- [The escape-hatch contract](#the-escape-hatch-contract)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/tsdown-plugins` is the building blocks; `@savvy-web/bundler` is the thin orchestrator over them (see `../bundler/architecture.md`). Everything the bundler's front door does is exposed here as a helper or a rolldown `Plugin`, so a hand-written `tsdown.config.ts` reproduces the front door by importing the same surface — the published escape hatch.

The package is implemented in Effect (`Data.TaggedError` typed errors, `Context.Tag` services, `Schema`, `Layer`s for the reporter), but Effect runs *behind* the tsdown plugin boundary: the catalog wrapper exposes a `Promise`, and the reporter is rendered via `Effect.runPromise` at the bundler's call site. The plugin objects themselves stay plain rolldown-conformant values.

**Package:** `@savvy-web/tsdown-plugins`
**Location:** `packages/tsdown-plugins` in `savvy-web/systems`
**Public surface:** `src/index.ts` — the semver'd export surface (entry helpers, manifest transforms + `emitManifest`, `resolveManifest`, dts tsconfig helpers, `deriveTargetGroupOptions`/`buildTargetGroups` + `BuildGroupSpec`, the reporter pipeline + formatters + `BuildReport` schema, the meta surface `normalizeMetaOptions`/`generateMeta` + its option/result types + `MetaGenerationError`, the targets surface `resolveTargets`/`isTargetObject`/`writeTargetsBinding` + the `PublishTargets`/`TargetResolution` types, the jsx surface `resolveJsxConfig`/`readTsconfigJsx` + `JsxConfig`/`TsconfigJsx`, the exe surface `normalizeExeOptions`/`runExeBuild` + its config types + `DEFAULT_EXE_NODE_VERSION`, the config-validation surface `ConfigValidator`/`ConfigValidatorLive` + `ValidationInput` + `ConfigValidationError`, re-exported catalog errors)
**Versioning:** independent; auto-bumps the bundler when it changes.
**Status:** Silk bundler program SP1 (Foundation). Spec/plan (local/gitignored): `docs/superpowers/specs/2026-06-04-savvy-bundler-sp1-foundation-design.md`, `docs/superpowers/plans/2026-06-04-savvy-bundler-sp1.md`.

## Current State

SP1 implemented, plus Track A (API Extractor meta generation, the `src/meta/` module), Track C (the `src/targets/` module — `publishConfig.targets` derivation into byte-variant groups, plus the name-aware TargetGroup plumbing that lets the build loop carry a per-group renamed manifest), Track D (the `src/jsx/` module — tsconfig→rolldown JSX mapping threaded through the dts tsconfig and the build loop) and Track B (the `src/exe/` module — SEA executable compilation over `@tsdown/exe`) plus the §8 config-validation service (`src/config-validation/`). Built by `@savvy-web/rslib-builder` until the stack self-hosts (post-SP1). Runtime `dependencies` are `workspaces-effect` (`^1.2.0`, for `CatalogResolver`), `@effect/platform-node` (provides `NodeContext` at the resolution boundary), `sort-package-json`, `std-env`, `picocolors`, `json-schema-effect`, plus the meta deps `@microsoft/api-extractor`, `@microsoft/tsdoc`, `@microsoft/tsdoc-config` and `deep-equal`; `effect` is a `catalog:silkPeers` peer. `tsdown`/`rolldown` are devDependencies — types only. (The `@tsdown/exe` runtime dependency lives on the *bundler*, not here — tsdown lazily imports it; see `../bundler/architecture.md`.)

Out of SP1/Tracks A/B/C/D: the SP2 preflight findings the reporter will later carry, per-variant meta (meta is still emitted once into the canonical group), dual-format CJS interop and **Track E (publishability + self-hosting)**, which is not done in this branch. The error set, formatter set, service set, the `resolveTargets` validation cases and the `ConfigValidator` rule set are discoverable in source — this doc documents the topology, not the enumerations.

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
- **Build loop:** `deriveTargetGroupOptions` (pure, `src/build/target-groups.ts`), `buildTargetGroups` (`src/build/build-target-groups.ts`). The loop is driven by `ReadonlyArray<BuildGroupSpec>` (`{ id, name }`), so each group carries its own resolved manifest name.
- **Targets:** the pure `src/targets/` module — `resolveTargets`/`isTargetObject` + the public/resolved types (`config.ts`, `resolve-targets.ts`) and `writeTargetsBinding` (`binding.ts`). See [The targets derivation](#the-targets-derivation).
- **JSX:** the pure `src/jsx/config.ts` — `resolveJsxConfig` (tsconfig→rolldown mapping) and `readTsconfigJsx` (best-effort source-tsconfig read). See [JSX resolution](#jsx-resolution).
- **Exe:** the `src/exe/` module — `normalizeExeOptions` + its config types (`config.ts`) and `runExeBuild` (`build.ts`, the interface-only tsdown-exe wrapper). See [The SEA exe-compile wrapper](#the-sea-exe-compile-wrapper).
- **Config validation:** the `src/config-validation/` module — the `ConfigValidator` `Context.Tag` service + `ValidationInput` (`ConfigValidator.ts`) and `ConfigValidatorLive` (`ConfigValidatorLive.ts`). See [The config-validation service](#the-config-validation-service).
- **Reporter:** four `Context.Tag` services `EnvironmentDetector → ExecutorResolver → FormatSelector → OutputRenderer` each with a sibling `*Live` layer, composed into `ReportPipelineLive`; the `renderReport` program; five formatters; the `BuildReport` `Schema` and its SchemaStore export. See [The output reporter](#the-output-reporter).
- **Meta:** the `src/meta/` module — `normalizeMetaOptions` + types (`config.ts`), `createMessageSuppressor` (`message-suppressor.ts`), `buildTsdocConfig`/`writeTsdocConfig` (`tsdoc-config.ts`), `mergeApiModels`/`rewriteCanonicalReferences` (`merge-models.ts`), `runApiExtractor` (`api-extractor.ts`) and the `generateMeta` orchestrator (`generate.ts`). See [The meta-generation pipeline](#the-meta-generation-pipeline).
- **Errors:** typed `Data.TaggedError`s in `src/errors.ts` (including `MetaGenerationError`, thrown by `runApiExtractor` on a failed extraction, and `ConfigValidationError` `{ path, reason }`, the single typed error every structural-config guard raises — `resolveTargets`, the exe/meta checks and the `ConfigValidator` — both re-exported from `src/index.ts` so consumers can `catchTag` by type); the catalog errors (`CatalogAssemblyError`, `CatalogResolutionError`) are owned by `workspaces-effect` and re-exported from `src/index.ts` so consumers and the reporter can `catchTag` them.

## Entry detection

`extractEntries` ports rslib-builder's `EntryExtractor` rules **exactly** — this is core identity that must not drift. The rules (source of truth if in doubt: rslib `entry-extractor.ts`): read `exports`; skip `./package.json` and any `*.json`; resolve an export value as `import || default || types` (never `require`); `resolveToTypeScript` remaps `/dist/`→`/src/` and `.js`→`.ts`; keep only `.ts`/`.tsx`; name `.`→`index`, else strip leading `./` and flatten `/`→`-` (or nest under `<name>/index` when `exportsAsIndexes`); `bin` string → `bin/cli`, object → `bin/<command>`, each through `resolveToTypeScript`. `packageJsonEntries` is the tsdown-facing wrapper returning the `Record<name, path>` that tsdown's `entry` accepts, reading either an in-memory package.json or `<cwd>/package.json`.

## Manifest emission and catalog delegation

`emitManifest` is the one rolldown plugin: in `generateBundle` it reads the source `package.json`, builds the transformed manifest via `buildEmittedManifest`, emits it as `package.json` into the output `pkg/` and copies `LICENSE`/`README.md`. The transform pipeline (ported from rslib's `package-json-transformer.ts`): resolve catalogs (prod, or dev when `devManifest: "resolve"`) → **apply the declarative rename** (`base.name = targetGroup.name`) → strip `publishConfig`/`scripts` → set `private` from `publishConfig.access` → rewrite `exports`/`bin`/`types` to built `.js`/`.d.ts` → run the user `transform({ pkg, targetGroup })` → **strip leading `./` from bin paths as the final guard** (npm 11.x silently drops `./`-prefixed bins) → `sort-package-json`. The `__PACKAGE_VERSION__` define is injected by the build loop, not here.

**The declarative rename (Track C) is load-bearing for ordering.** `buildEmittedManifest` sets `base.name = targetGroup.name` AFTER the catalog resolve and BEFORE the user `transform`, so the user transform and the emitted manifest both observe the renamed package — this is how a `github`/string-override group emits a differently-named manifest (and therefore distinct publishable bytes) without per-group transform code. `TargetGroupRef` carries `name` alongside `id`/`isProd` for this reason.

**Catalog delegation is the key revision from the original plan and the load-bearing topology fact here.** `resolveManifest` does *not* reimplement catalog/`workspace:` resolution — it wraps `workspaces-effect`'s `CatalogResolver`, which assembles a workspace's complete pnpm catalog set generically (inline `pnpm-workspace.yaml` + config-dependency pnpmfile hook-replay + lockfile) and resolves specifiers durably **without** depending on the transient `.pnpm-workspace-state-v1.json` — the fix for the `catalog:silkPeers` ordering bug. The resolver discovers the workspace root from `process.cwd()` (no cwd parameter), so `resolveManifest` must run from inside the target workspace; catalogs are workspace-wide so any cwd inside it yields the same set. `buildEmittedManifest` only resolves when `targetGroup.isProd || devManifest === "resolve"`, so a `dev` group with `devManifest: "preserve"` (the default) keeps `catalog:`/`workspace:` specifiers intact for injected dev packages to resolve through the workspace.

## The dts resolved-tsconfig port

SP1 decision: **tsdown native dts on the tsc path, NOT isolatedDeclarations.** Without `isolatedDeclarations`, rolldown-plugin-dts falls back to the TS compiler for emit, which under pnpm symlinks reproduces rslib's TS2742/TS2883 portability failures. The fix is ported from rslib's `writeBundleTempConfig`: `writeResolvedTsconfig` writes a temp tsconfig with **absolute** `rootDir`/`include`/`typeRoots`, explicit `types` (forwarded from the project tsconfig, default `["node"]`) and `composite: false`/`incremental: false` so stale build info never skips emit. The orchestrator passes that temp path to tsdown's `dts: { tsconfig }`. `ResolvedTsconfigOptions` also takes optional `jsx`/`jsxImportSource` (Track D) so the dts compiler sees the same JSX runtime the build does — otherwise `.tsx` declaration emit fails. See `src/dts/resolved-tsconfig.ts` for the exact compilerOptions.

## The per-TargetGroup build loop

`deriveTargetGroupOptions` (pure) maps a `TargetGroupId` to the tsdown options: `outDir` (`dev → dist/dev/pkg`, prod → `dist/prod/<group>/pkg`), `sourcemap`/`minify` (dev lenient, prod minified), `format: ["esm"]`, `unbundle: true`, `platform: "node"`, `fixedExtension: false`, the `dts.tsconfig` path and the `__PACKAGE_VERSION__` define. Track C widened `TargetGroupId` from the SP1 `"dev" | "npm"` union to any `string` — a prod group id is now an arbitrary `publishConfig.targets` key (`npm`, `github`, a custom key) — and the loop input is `ReadonlyArray<BuildGroupSpec>` (`{ id, name }`) rather than bare ids, so each group threads `group.id` into `deriveTargetGroupOptions`/the output dir and `group.name` into its `TargetGroupRef` for the declarative rename. `buildTargetGroups` runs `tsdown.build()` once per group with `config: false`, wiring in the per-group `emitManifest` plugin, `deps.neverBundle` externals and a `public/` auto-copy. Track D threads an optional `jsx?: JsxConfig` through `DeriveOptions`/`DerivedTsdownOptions`/`BuildTargetGroupsOptions` into the build's `inputOptions.jsx`, so a `.tsx` package gets the right rolldown JSX transform. Two SP1 facts cross into tsdown here: `unbundle: true` is the `disableSharedChunks` analogue (rolldown `preserveModules`, no shared runtime chunk), and `fixedExtension: false` forces package-`type`-ambient extensions over tsdown's node default. The loop is exposed as a composable helper — **not** locked inside the bundler — so the escape hatch gets multi-group builds too. `tsdown.build` is injectable on the options for tests, the only place tsdown's runtime is touched.

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

## The targets derivation

Track C added `src/targets/`, the **single source of truth for turning `publishConfig.targets` into the groups to build and the registry endpoints to publish them to** (spec §6.1). The bundler reads `publishConfig.targets`, calls `resolveTargets` and threads the result into the build loop and the binding artifact (see `../bundler/architecture.md`); the bundler owns no derivation logic. Track E (the release action) will consume the binding and may import `resolveTargets` directly.

`resolveTargets({ targets, baseName })` (`resolve-targets.ts`, pure) returns a `TargetResolution` of `{ groups, targets }`:

- **Groups are byte-variants.** Every `true` target collapses into ONE canonical base-name group (folder id `npm` if present, else the first true id). A string or object `name` override gets its own group (folder id = its key, manifest name = the override). A group `dir` is always `dist/prod/<id>/pkg`.
- **`from` reuses bytes.** An object target with `from: <id>` adds no new group — it binds a registry endpoint to a referenced group's already-built bytes. This is the N-Targets:1-TargetGroup relationship made declarative.
- **Default registries** fill in for the well-known keys (`npm` → `registry.npmjs.org`, `github` → `npm.pkg.github.com`); a custom key must supply `{ registry }`.
- **Structural validation throws `ConfigValidationError`** (`{ path, reason }`, the single typed error in `src/errors.ts`) for the invalid shapes: empty targets, `from`+`name` together, dangling/chained/self-referencing `from`, a custom key with no registry and `github: true` against an unscoped base name. `resolveTargets` is pure and throws synchronously outside the Effect boundary, but it throws the *typed* error (§8 made it the single source of truth — the verbatim reason strings are preserved); the `ConfigValidator` layer delegates target validation to it and re-surfaces the throw as a typed Effect failure. The exact case list lives in `resolve-targets.ts`.

`writeTargetsBinding(cwd, resolution)` (`binding.ts`) writes the `TargetResolution` to `dist/prod/targets.json` (tab-indented, trailing newline) and returns the path. This file is the bundler→release-action contract: it records which groups exist and which registry each target deploys to, so the release action uploads the built `dist/prod/<id>/pkg` bytes to the right endpoints without re-deriving anything.

## JSX resolution

Track D added `src/jsx/config.ts`, the **tsconfig→rolldown JSX mapping** so a `.tsx` package builds with the right runtime without per-package wiring. Two pure functions:

- **`resolveJsxConfig(tsconfig, override)`** maps a TS `compilerOptions.jsx` to the rolldown `JsxConfig` the build forwards: `react-jsx`/`react-jsxdev` → `{ runtime: "automatic", importSource: jsxImportSource ?? "react" }`, `react` → `{ runtime: "classic" }`, `preserve`/`react-native`/absent → `undefined` (nothing to configure). An explicit `override` wins (and the automatic-runtime importSource still defaults to `"react"`).
- **`readTsconfigJsx(cwd)`** is the best-effort inference source: it reads `<cwd>/tsconfig.json` `compilerOptions.jsx`/`jsxImportSource`, returning `{}` on absence or parse error.

The resolved `JsxConfig` flows two ways from the bundler: into the dts tsconfig (the `jsx`/`jsxImportSource` fields above) and into the build loop's `inputOptions.jsx`. Keeping the mapping here means the bundler only resolves *effective* jsx (override ?? inference) once and threads the result; see `../bundler/architecture.md`.

## The SEA exe-compile wrapper

Track B added `src/exe/`, the **interface-only wrapper over tsdown's exe (SEA) mode** for packages that ship a single-executable binary. Two units:

- **`normalizeExeOptions(exe, pkgOsCpu)` (`config.ts`, pure)** turns the `ExeConfig` (object or array) into one fully-resolved `NormalizedExe` per binary: entry defaults to `./src/bin.ts`; targets are inferred from the package's `os`/`cpu` when not stated (`win32` → the `win` token, `arm64`/`x64` only); `nodeVersion` defaults to `DEFAULT_EXE_NODE_VERSION`; `seaConfig` defaults `{ disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false }`. It does no structural validation — empty-fileName/empty-targets checks live in the config validator.
- **`runExeBuild(options)` (`build.ts`)** runs one tsdown build per spec in exe mode, `config: false`, `format: "esm"`, `platform: "node"`, with `deps.alwaysBundle = id => !id.startsWith("node:")` (a SEA must bundle every non-builtin import — nothing is resolvable from disk inside the binary). The tsdown `build` fn is injectable (a lazy `import("tsdown")` default), so this stays interface-only and unit-testable; `ExeBuild` is deliberately loose-typed (`config: unknown`) so no tsdown runtime type leaks in. The actual `@tsdown/exe` runtime dep lives on the *bundler*; tsdown lazily imports it when the exe option is used.

Real binary compilation is a CI/mac-runner manual step, out of the hermetic test suite; the in-repo tests inject a fake build and assert the spec/options.

## The config-validation service

§8 added `src/config-validation/`, the **fast-fail validator the bundler runs first** over the resolved config so a structurally-bad `savvy.build.ts` or `publishConfig.targets` fails before any build work across the dev/npm/meta/exe paths.

- **`ConfigValidator` (`ConfigValidator.ts`)** is a `Context.Tag` service with one method `validate(input: ValidationInput) → Effect<void, ConfigValidationError>`. `ValidationInput` is the normalized fact bundle the bundler assembles (baseName, `hasExports`, optional `targets`/`exe`/`osCpu`/`meta`).
- **`ConfigValidatorLive` (`ConfigValidatorLive.ts`)** is a `Layer.succeed` wrapping a **synchronous** `check` in `Effect.try`, surfacing the throw as a typed `ConfigValidationError` failure. The rules: targets are delegated to `resolveTargets` (single source of truth); exe is run through `normalizeExeOptions` then checked for empty fileName and empty targets; meta validates tsdoc `tagDefinitions` syntaxKind (`block`/`inline`/`modifier`) and that any existing `localPaths` are directories, gated behind a **prerequisite `!hasExports` cross-field guard** (a package with no exports cannot emit an api-model, so that fails fast first).

The validator is the bundler-facing entry point, but every individual rule reuses the same pure functions the build paths use (`resolveTargets`, `normalizeExeOptions`) — it adds the cross-field and presence checks, not a parallel rule set.

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
- **`resolveTargets` is the single source of truth for the targets derivation.** The bundler and Track E both derive from it rather than reimplementing the `publishConfig.targets` → groups/targets mapping. The declarative rename (`base.name = targetGroup.name`) is the only mechanism that produces a renamed manifest variant.
- **`ConfigValidationError` is the single typed config error.** §8 made every structural-config guard (`resolveTargets`, the exe/meta checks, the cross-field rules) throw it rather than a plain `Error`; the `ConfigValidator` layer composes those same pure checks and re-surfaces the throw as a typed Effect failure.
- **The exe path keeps the interface-only boundary.** `runExeBuild` touches tsdown only through the injectable, loose-typed `ExeBuild` seam (lazy `import("tsdown")`); the `@tsdown/exe` runtime dep is the bundler's, not this package's.
- **`src/index.ts` is the semver'd contract.** It is what the escape hatch and the bundler both depend on.

## Rationale

### Why interface-only, not a tsdown peer

A maintained peer on the bundler core is exactly the drift that triggered this program (rslib-builder's `@rslib/core` peer). Coupling to tsdown's plugin *type* with a documented compat range — and letting the bundler/escape-hatch user supply the runtime — keeps a tsdown upgrade a single bundler release rather than an ecosystem-wide peer bump.

### Why delegate catalog resolution to workspaces-effect

The original plan reproduced rslib's multi-source catalog merge here and shipped a silk-specific durable asset to fix the state-file ordering bug. `workspaces-effect@^1.2.0` shipped a generic, durable `CatalogResolver` that already solves it (with its own state-file-absent regression test), so this package wraps it in a few lines instead of owning the logic — deleting a milestone of cross-repo work. The trade is the `process.cwd()` workspace-discovery constraint documented above.

### Why copy the reporter instead of sharing

The vitest reporter pattern is proven but the SP1 `BuildReport` is intentionally simpler than vitest-agent's `AgentReport`. Owning the code now keeps the bundler shippable without coupling to an external reporter package's release cadence; a shared/extracted reporting package is a later consolidation if it earns its keep.
