---
type: Module
title: "@savvy-web/bundler"
description: The tsdown-based build orchestrator every Silk Suite TypeScript package builds through — a thin driver over @savvy-web/tsdown-plugins.
kind: package
resource: ../../packages/bundler
tags: [build]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: c1352b30c80f566b59758c9113235acbbf15af7c0cc4ff27727d7ec33f25c781
sources:
  - id: bundler-config
    resource: ../../packages/bundler/src/config.ts
  - id: bundler-run
    resource: ../../packages/bundler/src/run.ts
  - id: bundler-index
    resource: ../../packages/bundler/src/index.ts
---

# @savvy-web/bundler

`@savvy-web/bundler` is a thin orchestrator: it reads a package's
`package.json` and its `savvy.build.ts`, derives per-TargetGroup tsdown
options and drives tsdown's programmatic `build()` once per group. Every
build behavior — entry detection, manifest emission, catalog resolution,
the dts tsconfig port, the per-group loop, the meta pass, the output
reporter — lives in [`modules/tsdown-plugins.md`](tsdown-plugins.md); the
bundler owns only the `savvy.build.ts` contract, arg parsing and phase
ordering.

## Boundary

- **The two-package split.** `@savvy-web/tsdown-plugins` is the plugin
  pack (interface-only coupling to tsdown, authored against rolldown's
  `Plugin` type); `@savvy-web/bundler` depends on `tsdown-plugins`,
  `tsdown`, `rolldown` and `@tsdown/exe` as regular dependencies and drives
  tsdown's `build()` API, configured by `savvy.build.ts`. The split buys a
  common-path consumer one devDependency with no peer-sync trap, and a
  real published escape hatch: a power user brings their own `tsdown` +
  `tsdown-plugins` and composes the same helpers by hand. See
  [`decisions/bundler-tsdown-plugins-split.md`](../decisions/bundler-tsdown-plugins-split.md).
- **The `savvy.build.ts` contract and option surface** — `defineBuild`'s
  input shape, the `--target <dev|prod|meta|exe>`/`--watch`/`--no-exe`/`--verbose`
  arg surface — is documented from the consumer side in
  [`interfaces/savvy-build-config.md`](../interfaces/savvy-build-config.md).
- **`build`/`defineBuild`/`runBuild`.** `build(input?, overrides?)`
  (`src/run.ts`) is the front door: it calls
  `runBuild(defineBuild(input), { cwd, argv, ...overrides })`, with every
  IO dependency (`buildTargetGroups`, `writeOutput`, `readExports`,
  `runExeBuild`, `generateMeta`, `writeIssues`, …) injectable through
  `overrides` so the orchestration is unit-testable without touching disk
  or spawning tsdown.[^bundler-run] `defineBuild` is pure and never runs a
  build; `runBuild` is the orchestrator, running config validation first
  (via `tsdown-plugins`' `ConfigValidator`) on every target path.
- **TargetGroup vs. Target.** A **TargetGroup** is a single build output —
  a `dist/<group>/pkg` folder, the unit of bytes. A **Target** is a publish
  destination bound to exactly one TargetGroup: N Targets to 1 TargetGroup
  (identical bytes shipped to several registries), or a distinct group only
  when a manifest change alters the bundled bytes. The bundler **builds**
  TargetGroups; registry upload and attestation are the release action's
  job, consuming the built `dist/{group}/pkg` folders.
- **Multi-target publishing** derives from `publishConfig.targets` via
  `tsdown-plugins`' `resolveTargets`; `--target prod` builds every resolved
  group and writes `dist/prod/targets.json`, `--target dev` builds one
  registry-less `dev` group and writes no binding.
- **Dist layout:** `dist/dev/pkg` is the pnpm link root (clean publishable
  bytes, no meta/buildinfo); `dist/prod/<group>/{pkg,meta,declarations}`
  per byte-variant, plus `dist/prod/targets.json`. Every terminal path
  writes `dist/<target>/issues.json`, stamped with `buildOk`, before the
  log renders — **readers gate on `buildOk`, never on `errors.length`**,
  since a crashed build must never read as a clean gate.
- **Catalog resolution is delegated entirely** to `tsdown-plugins`'
  `resolveManifest` (in turn `@effected/workspaces`), which discovers the
  workspace root from `process.cwd()`. The bundler satisfies this because
  `savvy.build.ts` self-executes in the package directory.

## Meta wiring

The API-model (meta) pass is a function of `--target prod`, never a
standalone target (`--target meta` is a deprecated warn-and-no-op). It runs
after `buildTargetGroups` and before `removeDeclarationMaps`, when
`meta !== false`, `emitDts !== false` and the package has JS entries.
`runMetaPass` — a single `tsdown-plugins` helper — derives export paths,
filters `bin/` entries, repoints `outSubdir` dts basenames, resolves
optimistic next-versions and loops `generateMeta` once per prod group; the
front door and both self-hosting escape hatches call the *same* helper, so
the bundler only decides *when* and *where* (`dist/prod/<group>/meta`, the
canonical group also into `localPaths`). Meta reads already-emitted output
against the catalog-resolved prod manifest and never re-bundles; it runs
against prod, never dev, because dev keeps unresolved `catalog:`/
`workspace:*` specifiers. `meta?: MetaOptions | false` is tri-state
(omitted → defaults, object → overrides, `false` → skip); `optimistic:
"auto"` resolves to `false` under CI and `true` locally, rewriting only the
meta bundle's manifest, never the published one. The one piece of
meta-adjacent code the bundler itself owns is the optional
`@savvy-web/bundler/og` Open Graph image renderer (`ogImage.satori()`),
behind optional peers (`satori`, `@resvg/resvg-js`) that are dynamic-imported
only on first render.

## Exe wiring

A package configures `defineBuild({ exe })` and SEA compilation becomes a
step of every `--target dev`/`--target prod` build: a normal build emits
the binary AND programs the manifest to point at it, computed by
`computeExeFileName` so the manifest value can never drift from the
on-disk file. `@tsdown/exe` is a runtime dependency of the bundler, not of
`tsdown-plugins`; tsdown lazily imports it only when `exe` is configured.
Exactly one binary with one target is enforced — a cross-platform binary
ships as separate per-platform packages, never one manifest silently
programmed for the first of several. The SEA is compiled **last**, after
`buildTargetGroups`, so the JS pass's `clean` cannot wipe it; `--no-exe`
programs the manifest but skips the compile (used by `prepare` and
frozen-lockfile installs to avoid cross-compiling); `--target exe` is a
manual escape hatch. `savvy.build.ts`'s config options for `exe` are part of
[`interfaces/savvy-build-config.md`](../interfaces/savvy-build-config.md).

## Self-hosting

The bundler and `tsdown-plugins` build themselves through escape-hatch
`savvy.build.ts` scripts rather than the front door, resolving the
chicken-and-egg of a builder building itself across three tiers: Tier 1
(`tsdown-plugins`) imports `buildTargetGroups` from its own un-built `./src`
and is the one package whose build script runs `tsx savvy.build.ts`; Tier 2
(`@savvy-web/bundler`) imports the already-built `tsdown-plugins` workspace
link; Tier 3 (every other package) calls the front-door `build()`. Both
escape hatches call the same helpers the front door calls —
`buildTargetGroups`, `runMetaPass`, `writeTargetsBinding`,
`writeIssuesArtifact` — never a private path, and both stamp `issues.json`
from a `finally` exactly like the front door.

## Related

- [`modules/tsdown-plugins.md`](tsdown-plugins.md)
- [`decisions/bundler-tsdown-plugins-split.md`](../decisions/bundler-tsdown-plugins-split.md)
- [`interfaces/savvy-build-config.md`](../interfaces/savvy-build-config.md)
- [`interfaces/bundler-tsconfig-preset.md`](../interfaces/bundler-tsconfig-preset.md)

[^bundler-run]: `src/run.ts`
