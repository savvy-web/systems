---
type: Module
title: "@savvy-web/tsdown-plugins"
description: The interface-only plugin pack holding every build behavior @savvy-web/bundler orchestrates — entry detection, the build loop, dts emission, dual-format output, targets, exe, meta, config validation.
kind: package
resource: ../../packages/tsdown-plugins
tags: [build]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 8ec96fe5cf35e6cd19163127034929dab9c7df5becc5dea550a5904847b6bcb2
sources:
  - id: tp-index
    resource: ../../packages/tsdown-plugins/src/index.ts
  - id: tp-build
    resource: ../../packages/tsdown-plugins/src/build
  - id: tp-dts
    resource: ../../packages/tsdown-plugins/src/dts
  - id: tp-meta
    resource: ../../packages/tsdown-plugins/src/meta
  - id: tp-targets
    resource: ../../packages/tsdown-plugins/src/targets
  - id: tp-exe
    resource: ../../packages/tsdown-plugins/src/exe
  - id: tp-config-validation
    resource: ../../packages/tsdown-plugins/src/config-validation
---

# @savvy-web/tsdown-plugins

`@savvy-web/tsdown-plugins` is the building blocks; `@savvy-web/bundler` is
the thin orchestrator over them (see [`modules/bundler.md`](bundler.md)).
Everything the bundler's front door does is exposed here as a helper or a
rolldown `Plugin`, so a hand-written `savvy.build.ts` or `tsdown.config.ts`
reproduces the front door by importing the same surface — the escape-hatch
contract.

## Boundary

- **Interface-only to rolldown; tsdown only at two injectable seams.**
  Plugins are authored against `import type { Plugin } from "rolldown"`
  only — rolldown stays type-only, a devDependency with no runtime import
  anywhere in `src`. tsdown is a declared runtime dependency, touched at
  exactly two seams (`buildTargetGroups`, `runExeBuild`) that fall back to
  a lazy `await import("tsdown")` only when the caller injects no `build`
  fn.[^tp-build] tsdown is a dependency, not a peer, so its dts passes
  resolve against this package's own pinned `typescript` in every install
  topology rather than a host-hoisted tsdown peered against whatever
  TypeScript major the consumer's workspace pins.
- **No `peerDependencies`; `effect` is a regular dependency.** The package
  runs on Effect v4 (`Context.Service` classes with `layer` statics,
  `Schema`, `Data.TaggedError`); a consumer workspace's own Effect major
  can never poison this package's resolution under `autoInstallPeers`.
- **This package must not import `@savvy-web/silk-effects`**, which is
  downstream of this toolchain — importing it would create a package build
  cycle. `resolveNextVersions` is a deliberate second copy of the
  release-plan slice `silk-effects`' `ReleasePlanner.plan` also computes,
  for exactly that reason.
- **`ConfigValidationError` is the single typed config error.** Every
  structural-config guard (`resolveTargets`, `normalizeLooseFiles`, the
  ambient-dts checks, the exe/meta rules) throws it; `ConfigValidator` — a
  `Context.Service` with one `validate` method — re-surfaces the same
  throws as a typed Effect failure and runs before any build work, on
  every target path.[^tp-config-validation]

## The build loop

`buildTargetGroups` runs, per TargetGroup, a partition loop (the base
entries plus any `overrides`) and per partition a JS pass (per-module,
`unbundle: true`, the only pass wired to manifest emission), a bundled dts
pass (one single-entry `build()` per entry, `unbundle: false`), and —
prod-only, opt-in — a per-module declarations pass for API Extractor's
diagnostics run. `clean: true` runs only on the base partition's JS pass;
every later partition and pass is `clean: false`, and the manifest is
emitted once per group. Four bundling-posture knobs
(`bundleNodeModules`, `bundle`, `bundledPackages`, `dtsExternals`) cover
every departure from tsdown's default of auto-externalizing declared
dependencies; the rule that ties them together is that **the dts pass
posture always mirrors the JS pass posture**. Loose files are one extra
bundled pass per group, outside the exports/dts/meta graph entirely (no
manifest export, no `.d.ts`, no api-model) — the driver is pnpm config
dependencies, which forbid runtime `dependencies` and resolve their hook
file by filename at the package root. `copyPublicDir` runs last per group,
additive only, with a byte-comparison collision guard.[^tp-build]

## Declaration emission

The cardinal decision: **tsdown native dts on the tsc path, not
`isolatedDeclarations`** — under pnpm symlinks the compiler-free path
produces TS2742/TS2883 portability failures in consumers, so the dts pass
runs the real TypeScript compiler under a resolved tsconfig this package
derives from the package's own `tsconfig.json` and writes to the OS temp
dir.[^tp-dts] Declarations are rolled up **one entry at a time** rather than
in one multi-entry build, because a shared chunk's content-hashed naming
and split layout vary across otherwise byte-identical builds — determinism
is a publishing property, since the `.api.json` feeds the docs corpus and
the `.d.ts` is diffed on every release. The typescript pin backing this is
[`decisions/typescript-6-dts-pin.md`](../decisions/typescript-6-dts-pin.md).

## Dual-format output

Everything cjs-specific — the second output, the `cjsDefault` interop, the
manifest `require` condition, two rolldown plugins — is gated on
`format.includes("cjs")` and defaults off, so an esm-only build stays
byte-identical to a build with no cjs capability at all. `cjsDefaultInterop`
fixes rolldown's inability to emit `module.exports = <default>` while
keeping named exports (the concrete victim: markdownlint-cli2 reading
`module.default` off a `{ default, ...named }` wrapper).
`nodeBuiltinDefaultInterop` rewrites a default import/re-export of a node
builtin into its namespace form before codegen, because rolldown otherwise
emits a bare `require("node:x")` without the `__toESM` wrapper the default
access needs. Both plugins run in every pass that emits a `.cjs` — the JS
pass, each per-entry dts build, and cjs loose files.

## Entry detection and manifest emission

`extractEntries` derives the tsdown `entry` map from `exports`/`bin`, naming
each entry through `createEntryName` (`.` → `index`, otherwise the key
flattened with `/` → `-`); the slash-to-dash flatten is not injective, so a
collision throws loudly rather than silently overwriting one entry's built
output. `emitManifest` is the one rolldown plugin that writes the published
`package.json`: resolve catalogs → apply the declarative rename → strip
`publishConfig`/`scripts` and set `private` → rewrite `exports`/`bin`/`types`
to built paths (deriving every built basename from the same
`createEntryName` the extractor used) → inject the `./package.json`
self-export → run the user `transform` → strip leading `./` from bin paths
→ sort keys. A hand-authored `.d.ts` export (ambient) is rewritten and
copied verbatim rather than compiled; a `mixed` declaration alongside a
compilable runtime condition, a relative specifier in the copied source, or
a missing source all throw `ConfigValidationError` rather than degrade.
Catalog resolution is delegated wholly to `@effected/workspaces`, which
discovers the workspace root from `process.cwd()` — the constraint every
caller inherits.

## Meta generation

`runMetaPass` runs during `--target prod` over each group's already-emitted
bundled `.d.ts` and its catalog-resolved manifest; API Extractor never
re-runs the tsdown bundle. For each entry it runs the extractor **twice**
when the build emitted a separate declarations pass: Run A reads the
bundled `pkg/<entry>.d.ts` and produces the shipped `.api.json` (stable
because the bundled input is stable); Run B reads the per-module
`declarations/<entry>.d.ts` to harvest `ae-*`/`tsdoc-*` diagnostics at
accurate source locations, and is wrapped so its failure degrades to a
warning rather than breaking a build whose model already succeeded.[^tp-meta]
Under CI, `ae-forgotten-export` escalates to a hard failure
(`MetaGenerationError`); locally it stays a warning tagged `ciFatal`, and a
`suppressWarnings` match always wins over the escalation. The bundle can
also carry an optional `tsdoctor.json` sidecar (display identity, Open
Graph images, registry links) composed from three tiers — config, leaf
`tsdoctor.json`, project `tsdoctor.json` — resolved config-beats-leaf-beats-project
per field; a present-but-invalid source file always fails the build, an
absent one never does. The sidecar's schema is
[`interfaces/build-issues-json.md`](../interfaces/build-issues-json.md)'s
sibling artifact family, not itself the issues contract.

## The targets derivation

`resolveTargets({ targets, baseName })` is pure and is the single source of
truth turning `publishConfig.targets` into build groups (byte-variants —
every `true` target collapses into one canonical group; a `name` override
gets its own group) and registry targets (endpoints bound to a group; a
`from: <id>` target adds no new group, only a new registry binding on an
existing one).[^tp-targets] `writeTargetsBinding` writes the resolution to
`dist/prod/targets.json` — the bundler-to-release contract the publishing
side reads rather than re-deriving.

## The SEA exe wrapper

`src/exe/` is the interface-only wrapper over tsdown's exe mode:
`normalizeExeOptions` (pure) resolves an `ExeConfig` into one
`NormalizedExe` per binary; `computeExeFileName` mirrors tsdown's own SEA
output naming so the manifest value can never drift from the on-disk file;
`runExeBuild` runs one tsdown build per spec in exe mode with
`deps.alwaysBundle` covering everything that is not a `node:` builtin,
because nothing is resolvable from disk inside a compiled binary.[^tp-exe]
`@tsdown/exe` itself is the bundler's dependency, not this package's — kept
loose-typed here so no tsdown runtime type leaks into the interface-only
surface.

## Config validation

`ConfigValidator.validate(input) → Effect<void, ConfigValidationError>`
reuses the pure function each build path already calls for its own rule
(`resolveTargets` for targets, `normalizeExeOptions` plus presence checks
for exe, a cross-field exports guard plus tsdoc/`localPaths` checks for
meta, `normalizeLooseFiles` for loose files) — the validator adds the
cross-field and presence checks, never a parallel rule set, and runs before
any build work on every target path.

## Related

- [`modules/bundler.md`](bundler.md)
- [`decisions/typescript-6-dts-pin.md`](../decisions/typescript-6-dts-pin.md)
- [`interfaces/build-issues-json.md`](../interfaces/build-issues-json.md)

[^tp-build]: `src/build`
[^tp-dts]: `src/dts`
[^tp-meta]: `src/meta`
[^tp-targets]: `src/targets`
[^tp-exe]: `src/exe`
[^tp-config-validation]: `src/config-validation`
