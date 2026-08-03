---
title: GitHub Action Builder Architecture
status: current
module: github-action-builder
category: architecture
type: architecture
completeness: 95
created: 2026-01-29
updated: 2026-07-25
last-synced: 2026-07-25
related:
  - ../testing/effect-vitest.md
  - ../_archive/github-action-effects/index.md
dependencies: []
authors:
  - C. Spencer Beggs
tags:
  - architecture
  - github-actions
  - build-tool
  - rsbuild
  - effect-ts
  - node24
---

## Overview

`@savvy-web/github-action-builder` is a zero-config build tool that bundles TypeScript source into self-contained, single-file Node.js 24 GitHub Actions. It uses `@rsbuild/core` (rspack-based) to emit committable ESM bundles, validates `action.yml` against GitHub's metadata schema, and persists output to a local action directory for testing with [nektos/act](https://github.com/nektos/act).

The package lives at `packages/github-action-builder` and ships a `github-action-builder` bin plus a programmatic `GitHubAction` class. It is itself built by `@savvy-web/bundler` via the front-door `savvy.build.ts` — see `@./.claude/design/bundler/architecture.md`.

The Effect services consumed by the action code this builder bundles come from the `@effected` kit — `@effected/github-actions` (Actions runtime protocol), `@effected/github`, `@effected/sbom`, `@effected/npm`, `@effected/commands`. They and this builder are independent, with no build-time dependency between them. The former in-repo `@savvy-web/github-action-effects` that filled that role was deleted in the github-split adoption; its design docs are archived at [`../_archive/github-action-effects/index.md`](../_archive/github-action-effects/index.md) for history only.

The hard constraint that shapes everything else: **Node.js 24 ESM only**. The `action.yml` schema requires `runs.using: "node24"` exactly, and the bundle is single-file ESM. Most of the rsbuild interop work below exists to make CJS dependencies behave correctly inside that ESM output.

## Architecture

The design is Effect-first. Four services define interfaces as class-based `Context.Service` (each with a companion `*Shape` interface); live layers provide implementations; the CLI consumes services directly while the `GitHubAction` class wraps them with `ManagedRuntime.runPromise` for non-Effect consumers.

```text
Consumer layer:   CLI (@effect/cli)  +  GitHubAction class (Promise wrapper)
Service layer:    ConfigService → ValidationService → BuildService → PersistLocalService
Foundation:       typed errors (Data.TaggedError) + @effect/schema schemas + layer composition
```

The pipeline runs load config → detect entries → validate → build → persist-local, each stage owned by one service. Persist runs automatically after a successful build unless disabled via `--no-persist` or `persistLocal.enabled: false`.

## Services

Each service is one file under `src/services/`, its `layer` static defined alongside the `Context.Service` class rather than in a separate `*-live.ts` module. The single-responsibility split is load-bearing: persist is a standalone service, not embedded in build.

- **ConfigService** (`config.ts`) — loads `action.config.ts` from cwd, resolves partial input against schema defaults and detects entry points. Only `src/main.ts` is required; `src/pre.ts` and `src/post.ts` are auto-detected via `existsSync`. Beyond the three lifecycle entries, `entries.workers` (a name → source-path map) declares extra non-lifecycle bundles, each emitted as `dist/<name>.js`; a missing worker source fails with `WorkerEntryMissing`. Because the worker name becomes both the rsbuild entry key and the emitted filename, `detectEntries` rejects names that collide with a lifecycle bundle (`main`/`pre`/`post`) or contain path separators that would escape `dist/`, failing with `WorkerEntryInvalidName`. A `DetectedEntry.type` is therefore an arbitrary (validated) worker name, not just the `main`/`pre`/`post` literals.
- **ValidationService** (`validation.ts`) — validates project structure and `action.yml` against the schema, and resolves strict mode. In CI (`CI` or `GITHUB_ACTIONS` truthy) warnings become errors and the build fails; locally they are warnings and the build continues.
- **BuildService** (`build.ts`) — bundles each detected entry with `@rsbuild/core`, writes `dist/package.json` (`{ "type": "module" }`) and cleans `dist/` first by default. This file holds all the rsbuild interop decisions documented below.
- **PersistLocalService** (`persist-local.ts`) — syncs build output to a local action directory using SHA-256 comparison (copies only changed files, removes stale ones), validates that `action.yml` `runs.main/pre/post` paths resolve in the destination and generates `act` boilerplate (`.actrc`, `act-test.yml`) only when absent. It has no service dependencies.

Layer composition lives in `src/layers/app.ts`: `ValidationLayer` and `BuildLayer` each provide `ConfigService.layer`, `PersistLocalLayer` stands alone and `AppLayer` merges all four.

## Configuration

Configuration is an optional `action.config.ts` resolved from cwd (override with `-c`/`--config`). Only `.ts` is supported, for Node 24 ESM and full IDE typing. The `defineConfig` helper decodes user input through `ConfigSchema`, applying defaults.

All schemas use `@effect/schema` (not Zod) with `Schema.optionalWith` for defaults — see `src/schemas/config.ts` for the `Config`, `BuildOptions`, `ValidationOptions` and `PersistLocalOptions` shapes, and `src/schemas/action-yml.ts` for the `action.yml` schema. The schemas are the source of truth for defaults; do not restate them here.

Three `build` knobs control what leaves the bundle, and `ignore` takes precedence over `externals`:

- **`externals`** — packages left as runtime imports, expected to be present at runtime. `node:` builtins are always external (see below).
- **`ignore`** — packages removed from the bundle and replaced with a stub that throws if loaded at runtime. Use for optional transitive deps the action never exercises (e.g. native modules).
- **`nativeDynamicImports`** — packages whose dynamic `import(...)` calls must stay native runtime `import()` instead of being compiled into an rspack context module. Use for packages that resolve a module path at runtime and dynamically import it (e.g. `@changesets/apply-release-plan` loading a configured changelog module). See the interop bullet below.

## Build pipeline and rsbuild interop

Each entry is bundled by `bundleEntry` in `src/services/build.ts`. The output is enforced single-file: `chunkSplit: { strategy: "all-in-one" }` plus `tools.rspack.output.asyncChunks: false`, so dynamic `import()` calls fold back into the parent chunk rather than emitting separate numbered chunks. Tree-shaking is unaffected. The one exception is `build.nativeDynamicImports` (see below): a listed package's dynamic imports are left as native runtime `import()` calls, resolved for real when the action runs, rather than being folded or context-moduled. The result is always exactly one `.js` per detected entry — `dist/main.js`, `dist/pre.js`, `dist/post.js` and one `dist/<name>.js` per declared worker.

The non-obvious interop decisions, all in `build.ts`, are the reason rsbuild was chosen over the unmaintained ncc:

- **`node:` builtins → `node-commonjs` external** (issue #79). With ESM output, the default external type makes `require("node:*")` inside a bundled CJS dep return an ESM namespace, breaking the TypeScript `__importDefault` helper with "instanceof is not callable". The `node-commonjs` type preserves real `require()` semantics.
- **Single externals function, not a function-plus-array** (issue #81). Leading an `externals` array with a function made rspack stop consulting trailing string entries, so user-configured string externals were silently bundled and failed to resolve. One function handles every case: `node:` → `node-commonjs`, user externals (not also ignored) → runtime import, everything else → bundle.
- **`build.ignore` stub** — a single throwing `.mjs` is written to a deterministic project-local path (`node_modules/.cache/github-action-builder/ignore-stub.mjs`) and each ignored specifier is aliased to it via `resolve.alias` with a `$` exact-match suffix. The fixed path keeps the committed bundle reproducible across builds (issue #94); a `mkdtemp` path changed the output every run.
- **`build.nativeDynamicImports` → the `webpackIgnore`-injecting loader.** rspack compiles a fully dynamic `import(expr)` — a non-literal argument or an interpolated template literal — into a context module that throws `Cannot find module` at runtime even when the file exists on disk, which breaks packages that resolve a module path at runtime and import it. For each listed package, `buildNativeDynamicImportRules` (`src/services/native-dynamic-imports.ts`) adds one rspack module rule matching that package's resolved path under `node_modules` (flat and pnpm layouts) and routes its source through `webpack-ignore-dynamic-imports.cjs` — a pure string-transform loader that injects `/* webpackIgnore: true */` into every fully-dynamic `import(` call (idempotent; other magic comments like `webpackChunkName` do not suppress injection), so rspack leaves those calls as native `import()`. The loader ships as a genuine on-disk `.cjs` asset (rspack loaders are `require()`d at build time) under `public/loaders/`, exported at `./loaders/webpack-ignore-dynamic-imports.cjs` and resolved via `import.meta.resolve` through the package's own exports map so the path is correct from both `src` and built `dist`. See the loader file for the exact injection rules and documented non-AST limitations.
- **`__dirname` / `__filename` shims** via `tools.rspack.node: "node-module"`. CJS deps that reference these globals (e.g. `@cyclonedx/cyclonedx-library`) throw "__dirname is not defined" inside ESM; rspack derives them from `import.meta.url` instead.
- **`mode: "production"` is pinned, not inherited.** Through rsbuild's JS API the mode resolves from `NODE_ENV` and falls back to `"none"` when it is unset, and minification only applies in `"production"` — so a bare local build silently emitted an unminified bundle (~7x the size) while CI, which sets `NODE_ENV=production`, minified. This tool only ever produces committed production artifacts, so the mode is hardcoded and `build.minify` alone decides minification. A `default-minify` integration fixture pins it.
- **`legalComments: "linked"` plus a sidecar fold-in, NOT `"inline"`.** Attribution must survive into the committed bundle (#94) and a committed action must carry no `*.LICENSE.txt` sidecar files — those two requirements pull in opposite directions and the obvious mode is the wrong one. `"inline"` relies on the SWC minimizer's comment preservation, which never receives the bundled module banners, so under real minification it **silently dropped attribution entirely** (rsbuild 2.1.8; the loss only became visible once the mode pin above made minification actually run). `"linked"` is the only mode whose extraction sees those banners, so the build takes the sidecar it emits and folds it back in: `inlineLicenseSidecar` (`src/services/build.ts`) reads `<out>.js.LICENSE.txt`, replaces the `/*! LICENSE: … */` reference banner in the bundle with the verbatim license blocks (prepending them if the reference is absent), then deletes the sidecar. Attribution inline, no extra dist file, and both halves are integration-pinned.

## Validation

`action.yml` is validated against an `@effect/schema` definition based on GitHub's metadata spec. The critical constraint is `runs.using: Schema.Literal("node24")` — `node16`, `node20`, `composite` and `docker` all fail. Validation catches structural issues (missing required fields, malformed inputs/outputs, invalid branding); input/output business logic (mutual exclusivity, type coercion) is left to the action author's code. The builder validates structure, not semantics.

## API and CLI

The `GitHubAction` class (`src/github-action.ts`) is a Promise-based wrapper over the services for non-Effect consumers, backed by a `ManagedRuntime` over `AppLayer` (or a caller-supplied layer). `GitHubAction.create()` works zero-config; `build()` runs the full workflow and persists locally when enabled. Effect consumers can instead `yield*` the services directly under `AppLayer`.

The CLI (`src/cli/`) is built with `@effect/cli` and exposes `build`, `validate` and `init` commands. `build` supports `-c/--config`, `-q/--quiet`, `--no-validate` and `--no-persist`. The public surface is re-exported from `src/index.ts` — that barrel is the source of truth for exported types, schemas, services, layers and errors.

## Error handling

All errors use `Data.TaggedError` for type-safe pattern matching via `Effect.catchTags`. The tagged union groups are defined in `src/errors.ts`: `ConfigError`, `ValidationError` (which includes `WorkerEntryMissing` and `WorkerEntryInvalidName`), `BuildError` and `PersistError` (aggregated as `AppError`). Each error carries contextual data (paths, causes, expected-vs-specified paths) — read the file for the exact field shapes.

## Testing

Unit tests live under a sibling `__test__/` directory mirroring `src/` (`*.test.ts`). The handful that run Effect programs — the service and schema tests — use `@effect/vitest` per the suite-wide conventions in [../testing/effect-vitest.md](../testing/effect-vitest.md); the rest, including the integration harness below, have no Effect surface and stay on plain `vitest`. Integration tests under `__test__/integration/` (`*.int.test.ts`, discovered and classified as an `:int` project by the root `@vitest-agent/plugin`) build a fixture via `GitHubAction.create()` then run the emitted `dist/main.js` with Node to assert runtime behavior — covering the `node-commonjs` interop, user externals not being bundled, the throwing ignore stub, the folded-in license attribution (and the absence of a `*.LICENSE.txt` sidecar), default minification under the pinned production mode, and idempotent (reproducible) output. See the fixtures under `__test__/integration/fixtures/` for the exact scenarios.

## Rationale

- **`@rsbuild/core` over ncc** — ncc's webpack-4 runtime emitted `eval("require")` that broke Node 24's strict ESM format detection. rsbuild gives clean ESM output, working CJS→ESM interop and tree-shaking, and is already in the Savvy Web ecosystem. It replaced `@vercel/ncc` in v0.5.0.
- **Effect-TS** — typed errors, layer-based service composition, dependency injection for testability and resource safety for file operations.
- **`@effect/schema`** — native Effect integration, defaults via `optionalWith`, path-aware error messages.
- **Node 24 only** — modern native ESM, no CJS fallbacks, simpler code.
- **Source maps off by default** — smaller committed bundles; actions rarely need them.
- **Auto-persist to `.github/actions/local/`** — removes friction for `act` testing; SHA-256 sync avoids redundant copies; boilerplate is generated once.
- **No watch mode** — actions can't be exercised in real time, and builds are fast enough to run manually.
