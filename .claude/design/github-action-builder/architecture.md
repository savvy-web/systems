---
status: current
module: github-action-builder
category: architecture
created: 2026-01-29
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ../bundler/architecture.md
  - ../testing/effect-vitest.md
---

# @savvy-web/github-action-builder architecture

A zero-config build tool that bundles TypeScript source into self-contained, single-file Node.js 24 GitHub Actions with `@rsbuild/core`, validates `action.yml` against GitHub's metadata schema and syncs the output to a local action directory for [nektos/act](https://github.com/nektos/act) testing.

## Table of contents

1. [Overview](#overview)
2. [Current state](#current-state)
3. [Services and layers](#services-and-layers)
4. [Configuration](#configuration)
5. [Build pipeline and rsbuild interop](#build-pipeline-and-rsbuild-interop)
6. [Validation](#validation)
7. [API and CLI](#api-and-cli)
8. [Error handling](#error-handling)
9. [Testing](#testing)
10. [Rationale](#rationale)

## Overview

The package lives at `packages/github-action-builder` and ships a `github-action-builder` bin plus a programmatic `GitHubAction` class. It is itself built by `@savvy-web/bundler` through the front-door `savvy.build.ts` — see [`../bundler/architecture.md`](../bundler/architecture.md). Its `public/` assets (the `tsconfig/action.json` preset and the `loaders/webpack-ignore-dynamic-imports.cjs` rspack loader) ship verbatim under the `exports` map in `package.json`.

The Effect services the bundled action code itself consumes come from the `@effected` kit (`@effected/github-actions` for the Actions runtime protocol, plus `@effected/github`, `@effected/sbom`, `@effected/npm` and `@effected/commands`). They and this builder are independent, with no build-time dependency between them.

The hard constraint that shapes everything else: **Node.js 24 ESM only**. The `action.yml` schema requires `runs.using: "node24"` exactly and the bundle is single-file ESM. Most of the rsbuild interop work below exists to make CJS dependencies behave correctly inside that ESM output.

## Current state

The pipeline runs load config → detect entries → validate → build → persist-local, each stage owned by one service. Persist runs automatically after a successful build unless disabled via `--no-persist` or `persistLocal.enabled: false`.

```text
Consumer layer:   CLI (effect/unstable/cli)  +  GitHubAction class (Promise wrapper)
Service layer:    ConfigService → ValidationService → BuildService → PersistLocalService
Foundation:       typed errors (Data.TaggedError) + effect Schema + layer composition
```

The design is Effect-first on Effect v4: services are class-based `Context.Service` definitions (each with a companion `*Shape` interface), live layers provide the implementations, the CLI consumes services directly and the `GitHubAction` class wraps them behind a `ManagedRuntime` for non-Effect consumers.

## Services and layers

Each service is one file under `src/services/`, its `layer` static defined alongside the `Context.Service` class rather than in a separate `*-live.ts` module. The single-responsibility split is load-bearing: persist is a standalone service, not embedded in build.

- **ConfigService** (`config.ts`) — discovers `action.config.{ts,js,mjs}` in cwd (loading `.ts` through `jiti`), resolves partial input against schema defaults and detects entry points. Only `src/main.ts` is required; `src/pre.ts` and `src/post.ts` are auto-detected by existence. Beyond the three lifecycle entries, `entries.workers` (a name → source-path map) declares extra non-lifecycle bundles, each emitted as `dist/<name>.js`. Because the worker name becomes both the rsbuild entry key and the emitted filename, `detectEntries` rejects names that collide with a lifecycle bundle or contain path separators that would escape `dist/` (`WorkerEntryInvalidName`) and fails a missing worker source with `WorkerEntryMissing`. A `DetectedEntry.type` is therefore an arbitrary validated worker name, not just the `main`/`pre`/`post` literals.
- **ValidationService** (`validation.ts`) — validates project structure and `action.yml` (parsed via `@effected/yaml`) against the schema and resolves strict mode. In CI (`CI` or `GITHUB_ACTIONS` truthy) warnings become errors and the build fails; locally they stay warnings and the build continues. `validation.strict` overrides the auto-detection.
- **BuildService** (`build.ts`) — bundles each detected entry with `@rsbuild/core`, writes `dist/package.json` (`{ "type": "module" }`) and cleans `dist/` first by default. This file holds every rsbuild interop decision documented below.
- **PersistLocalService** (`persist-local.ts`) — syncs build output to the local action directory using SHA-256 comparison (copies only changed files, removes stale ones), checks that the `action.yml` `runs.main/pre/post` paths resolve in the destination and generates `act` boilerplate (`.actrc`, `act-test.yml`) only when absent. It has no service dependencies.

Layer composition lives in `src/layers/app.ts`: `ConfigLayer` stands alone, `ValidationLayer` and `BuildLayer` each provide `ConfigService.layer`, `PersistLocalLayer` stands alone and `AppLayer` merges them all.

## Configuration

Configuration is an optional `action.config.ts` (or `.js`/`.mjs`) resolved from cwd, overridable with `-c`/`--config`. The `defineConfig` helper decodes user input through `ConfigSchema`, applying defaults.

Schemas use `Schema` from `effect` (v4), with `Schema.withDecodingDefaultType` supplying defaults — see `src/schemas/config.ts` for the `Config`, `BuildOptions`, `ValidationOptions` and `PersistLocalOptions` shapes and `src/schemas/action-yml.ts` for the `action.yml` schema. The schemas are the source of truth for defaults; do not restate them here.

Three `build` knobs control what leaves the bundle, and `ignore` takes precedence over `externals`:

- **`externals`** — packages left as runtime imports, expected to be present at runtime. `node:` builtins are always external (see below).
- **`ignore`** — packages removed from the bundle and replaced with a stub that throws if loaded at runtime. Use for optional transitive deps the action never exercises (e.g. native modules).
- **`nativeDynamicImports`** — packages whose dynamic `import(...)` calls must stay native runtime `import()` instead of being compiled into an rspack context module. Use for packages that resolve a module path at runtime and dynamically import it (e.g. `@changesets/apply-release-plan` loading a configured changelog module).

## Build pipeline and rsbuild interop

Each entry is bundled by `bundleEntry` in `src/services/build.ts`. The output is enforced single-file: `chunkSplit: { strategy: "all-in-one" }` plus `tools.rspack.output.asyncChunks: false`, so dynamic `import()` calls fold back into the parent chunk rather than emitting separate numbered chunks. Tree-shaking is unaffected. The one exception is `build.nativeDynamicImports`: a listed package's dynamic imports are left as native runtime `import()` calls, resolved for real when the action runs. The result is always exactly one `.js` per detected entry — `dist/main.js`, `dist/pre.js`, `dist/post.js` and one `dist/<name>.js` per declared worker.

The non-obvious interop decisions, all in `build.ts`, are the reason rsbuild was chosen over the unmaintained ncc:

- **`node:` builtins → `node-commonjs` external** (#79). With ESM output, the default external type makes `require("node:*")` inside a bundled CJS dep return an ESM namespace, breaking the TypeScript `__importDefault` helper with "instanceof is not callable". The `node-commonjs` type preserves real `require()` semantics.
- **Single externals function, not a function-plus-array** (#81). Leading an `externals` array with a function made rspack stop consulting trailing string entries, so user-configured string externals were silently bundled and failed to resolve. One function handles every case: `node:` → `node-commonjs`, user externals (not also ignored) → runtime import, everything else → bundle.
- **`build.ignore` stub** — a single throwing `.mjs` is written to a deterministic project-local path (`node_modules/.cache/github-action-builder/ignore-stub.mjs`) and each ignored specifier is aliased to it via `resolve.alias` with a `$` exact-match suffix. The fixed path keeps the committed bundle reproducible across builds (#94); a `mkdtemp` path changed the output every run.
- **`build.nativeDynamicImports` → the `webpackIgnore`-injecting loader.** rspack compiles a fully dynamic `import(expr)` — a non-literal argument or an interpolated template literal — into a context module that throws `Cannot find module` at runtime even when the file exists on disk. For each listed package, `buildNativeDynamicImportRules` (`src/services/native-dynamic-imports.ts`) adds one rspack module rule matching that package's resolved path under `node_modules` (flat and pnpm layouts) and routes its source through `webpack-ignore-dynamic-imports.cjs`, a pure string-transform loader that injects `/* webpackIgnore: true */` into every fully-dynamic `import(` call so rspack leaves those calls as native `import()`. The loader ships as a genuine on-disk `.cjs` asset (rspack loaders are `require()`d at build time) under `public/loaders/`, exported at `./loaders/webpack-ignore-dynamic-imports.cjs` and resolved via `import.meta.resolve` through the package's own exports map so the path is correct from both `src` and built `dist`. See the loader file for the exact injection rules and its documented non-AST limitations.
- **`__dirname` / `__filename` shims** via `tools.rspack.node: "node-module"`. CJS deps that reference these globals (e.g. `@cyclonedx/cyclonedx-library`) throw "__dirname is not defined" inside ESM; rspack derives them from `import.meta.url` instead.
- **`mode: "production"` is pinned, not inherited.** Through rsbuild's JS API the mode resolves from `NODE_ENV` and falls back to `"none"` when it is unset, and minification only applies in `"production"` — so a bare local build would silently emit an unminified bundle while CI, which sets `NODE_ENV=production`, minifies. This tool only ever produces committed production artifacts, so the mode is hardcoded and `build.minify` alone decides minification. Never make the pin conditional.
- **`legalComments: "linked"` plus a sidecar fold-in, NOT `"inline"`.** Attribution must survive into the committed bundle (#94) and a committed action must carry no `*.LICENSE.txt` sidecar — those two requirements pull in opposite directions and the obvious mode is the wrong one. `"inline"` relies on the SWC minimizer's comment preservation, which never receives the bundled module banners, so under real minification it silently drops attribution entirely. `"linked"` is the only mode whose extraction sees those banners, so the build takes the sidecar it emits and folds it back in: `inlineLicenseSidecar` (`src/services/build.ts`) reads `<out>.js.LICENSE.txt`, replaces the `/*! LICENSE: … */` reference banner in the bundle with the verbatim license blocks (prepending them if the reference is absent), then deletes the sidecar. Attribution inline, no extra dist file.

## Validation

`action.yml` is validated against the `Schema` definition in `src/schemas/action-yml.ts`, based on GitHub's metadata spec. The critical constraint is `runs.using: Schema.Literal("node24")` — `node16`, `node20`, `composite` and `docker` all fail. Validation catches structural issues (missing required fields, malformed inputs/outputs, invalid branding); input/output business logic (mutual exclusivity, type coercion) is left to the action author's code. The builder validates structure, not semantics.

## API and CLI

The `GitHubAction` class (`src/github-action.ts`) is a Promise-based wrapper over the services for non-Effect consumers, backed by a `ManagedRuntime` over `AppLayer` (or a caller-supplied layer). `GitHubAction.create()` works zero-config; `build()` runs the full workflow and persists locally when enabled. Effect consumers can instead `yield*` the services directly under `AppLayer`.

The CLI (`src/cli/`) is built on `effect/unstable/cli` (Effect v4's `Command`/`Flag`), runs under `NodeRuntime.runMain` with `NodeServices.layer` merged into `AppLayer` and exposes `build`, `validate` and `init` commands. Flags are declared in `src/cli/commands/` — `build` is the one whose flags change pipeline behaviour (config path, quiet output, skipping validation or persist). The public surface is re-exported from `src/index.ts`; that barrel is the source of truth for exported types, schemas, services, layers and errors.

## Error handling

All errors use `Data.TaggedError` for type-safe pattern matching via `Effect.catchTags`. The tagged union groups (`ConfigError`, `ValidationError`, `BuildError`, `PersistError`, aggregated as `AppError`) are defined in `src/errors.ts` — read the file for the members and their field shapes. Each error class also exports a `*Base` constant: api-extractor needs the anonymous `Data.TaggedError` base class named to avoid forgotten-export warnings (the bundler's `tsdoc.suppressWarnings` in `savvy.build.ts` covers the rest). Do not delete them.

## Testing

Unit tests live under a sibling `__test__/` directory mirroring `src/` (`*.test.ts`). The ones that run Effect programs — the service and schema tests — use `@effect/vitest` per the suite-wide conventions in [`../testing/effect-vitest.md`](../testing/effect-vitest.md); the rest have no Effect surface and stay on plain `vitest`. Integration tests under `__test__/integration/` (`*.int.test.ts`, classified as an `:int` project by the root `@vitest-agent/plugin`) build a fixture via `GitHubAction.create()` then run the emitted `dist/main.js` with Node to assert runtime behaviour. The interop decisions above are pinned by the fixtures under `__test__/integration/fixtures/`; add a fixture there when adding another.

## Rationale

- **`@rsbuild/core` over ncc** — ncc's webpack-4 runtime emitted `eval("require")` that broke Node 24's strict ESM format detection. rsbuild gives clean ESM output, working CJS→ESM interop and tree-shaking, and is already in the Savvy Web ecosystem.
- **Effect-TS** — typed errors, layer-based service composition, dependency injection for testability and resource safety for file operations.
- **`effect` `Schema`** — native Effect integration, decoding defaults and path-aware error messages, with no separate schema package to version.
- **Node 24 only** — modern native ESM, no CJS fallbacks, simpler code.
- **Source maps off by default** — smaller committed bundles; actions rarely need them.
- **Auto-persist to `.github/actions/local/`** — removes friction for `act` testing; SHA-256 sync avoids redundant copies; boilerplate is generated once.
- **No watch mode** — actions can't be exercised in real time, and builds are fast enough to run manually.
