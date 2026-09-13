---
type: Module
title: github-action-builder
description: Zero-config Effect-first build tool that bundles TypeScript into single-file Node.js 24 GitHub Actions, validates action.yml, and syncs output for act testing.
kind: package
resource: ../../packages/github-action-builder
status: draft
tags: [build, ci]
sources:
  - id: arch
    resource: ../../packages/github-action-builder/src
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 679b9d1debc62ee92c9d8f6751f53d7f3607a1f42bec546fb168c1c7b576502e
---

# github-action-builder

## Boundary

`@savvy-web/github-action-builder` (`packages/github-action-builder`) bundles TypeScript source into self-contained, single-file Node.js 24 GitHub Actions with `@rsbuild/core`, validates `action.yml` against GitHub's metadata schema, and syncs output to a local action directory for `nektos/act` testing.[^arch] It ships a `github-action-builder` bin plus a programmatic `GitHubAction` class, and is itself built by `@savvy-web/bundler` through the front-door `savvy.build.ts`.[^arch] The Effect services the *bundled action code itself* consumes come from the `@effected` kit (`@effected/github-actions`, `@effected/github`, `@effected/sbom`, `@effected/npm`, `@effected/commands`); they and this builder are independent, with no build-time dependency between them.[^arch]

The hard constraint shaping everything else: **Node.js 24 ESM only** — `action.yml`'s schema requires `runs.using: "node24"` exactly and the bundle is single-file ESM. Most of the rsbuild interop work exists to make CJS dependencies behave correctly inside that ESM output.[^arch]

## Owner

Effect-first on Effect v4: class-based `Context.Service` definitions per `src/services/`, live layers providing implementations, the CLI (`effect/unstable/cli`) consuming services directly, and the `GitHubAction` class wrapping them behind a `ManagedRuntime` for non-Effect consumers.[^arch] The pipeline runs load config → detect entries → validate → build → persist-local, each stage owned by one service (`ConfigService`, `ValidationService`, `BuildService`, `PersistLocalService`); persist runs automatically unless disabled via `--no-persist` or `persistLocal.enabled: false`.[^arch]

## Build pipeline

Each entry is bundled by `bundleEntry` (`src/services/build.ts`). Output is enforced single-file — `chunkSplit: { strategy: "all-in-one" }` plus `tools.rspack.output.asyncChunks: false` — so dynamic `import()` calls fold into the parent chunk. The one exception is `build.nativeDynamicImports`: listed packages' dynamic imports stay native runtime `import()`.[^arch]

`@rsbuild/core` was chosen over `ncc` because ncc's webpack-4 runtime emitted `eval("require")` that broke Node 24's strict ESM format detection.[^arch] The non-obvious rsbuild interop decisions, all in `build.ts`:[^arch]

- **`node:` builtins → `node-commonjs` external.** With ESM output the default external type makes `require("node:*")` inside a bundled CJS dep return an ESM namespace, breaking TypeScript's `__importDefault` helper.
- **A single externals function, not a function-plus-array** — a leading function made rspack stop consulting trailing string entries, silently bundling user-configured string externals.
- **`build.ignore` writes a deterministic stub path** (`node_modules/.cache/github-action-builder/ignore-stub.mjs`), not a `mkdtemp` path, so the committed bundle stays reproducible across builds.
- **`build.nativeDynamicImports` routes through a `webpackIgnore`-injecting rspack loader** (`public/loaders/webpack-ignore-dynamic-imports.cjs`) because rspack compiles a fully dynamic `import(expr)` into a context module that throws `Cannot find module` at runtime even when the file exists.
- **`mode: "production"` is pinned, not inherited** — rsbuild's JS API otherwise resolves mode from `NODE_ENV`, falling back to `"none"` locally while CI (which sets `NODE_ENV=production`) minifies, producing divergent local/CI output.
- **`legalComments: "linked"` plus a sidecar fold-in, not `"inline"`** — attribution must survive into the committed bundle with no `*.LICENSE.txt` sidecar left behind; `"inline"` relies on comment preservation that never sees bundled module banners under real minification, so `inlineLicenseSidecar` reads the `"linked"` sidecar and folds it back into the bundle before deleting it.

## Boundaries and invariants

- **`runs.using: Schema.Literal("node24")` is the critical `action.yml` constraint** — `node16`, `node20`, `composite` and `docker` all fail validation. Validation catches structural issues only; input/output business logic is left to the action author's code.[^arch]
- **All errors use `Data.TaggedError`**, grouped into a tagged union (`ConfigError`, `ValidationError`, `BuildError`, `PersistError`, aggregated as `AppError`) for `Effect.catchTags`. Each error class exports a `*Base` constant for api-extractor's anonymous-base forgotten-export warning; do not delete them.[^arch]
- **Strict validation in CI, warnings locally.** When `CI` or `GITHUB_ACTIONS` is truthy, warnings become errors and the build fails; `validation.strict` overrides the auto-detection.[^arch]
- **No watch mode** — actions can't be exercised in real time and builds are fast enough to run manually.[^arch]
- **Source maps off by default** to keep committed bundles small.[^arch]

[^arch]: `../../packages/github-action-builder/src`
