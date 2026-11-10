---
type: Module
title: pnpm-plugin-silk
description: The single pnpm config dependency that distributes the Silk Suite's shared workspace configuration — catalogs, overrides, build/hoist/peer rules, and release-age gating — to every consuming repository.
kind: package
resource: ../../packages/pnpm-plugin-silk
status: stable
tags: [release, tooling]
sources:
  - id: arch
    resource: ../../packages/pnpm-plugin-silk/lib/build/pnpm-config.plugin.ts
generated:
  by: okfit/claude-code
  at: 2026-11-10T16:02:50Z
integrity:
  generated:
    body: c0be15d59de3e8d7
  verified:
    by: human:spencer
    at: 2026-11-10T15:59:51Z
    content: c0da0793e9770537
verified:
  - by: human:spencer
    at: 2026-11-10T15:59:51Z
---

# pnpm-plugin-silk

## Boundary

`@savvy-web/pnpm-plugin-silk` (`packages/pnpm-plugin-silk`) is a pnpm config dependency: a consuming repo adds it to `pnpm-workspace.yaml` under `configDependencies` (pinned with its integrity hash) and thereafter references `catalog:<name>` / `catalog:<name>:peers` in its manifests.[^arch] It ships five purpose-scoped catalog pairs (`build`, `docs`, `lint`, `silk`, `test`), an `allowBuilds` allowlist, `publicHoistPattern`, `peerDependencyRules`, `minimumReleaseAge` gating, and the `strictDepBuilds`/`blockExoticSubdeps` defaults — see [purpose-scoped catalog naming](../conventions/purpose-scoped-catalogs.md) for the naming rule the catalog pairs follow and [the consumer catalog contract](../interfaces/silk-catalogs.md) for what a consumer may rely on staying stable. The Effect closure is deliberately NOT here: `catalog:effected` (`effect`, `@effect/*` and the `@effected/*` kit) and its `catalog:effected:peers` companion come from the separate `@effected/pnpm-plugin-effected` config dependency, so the two plugins version independently.[^arch] It is the only package in this repo published to npm only, never to GitHub Packages — see [independent package versioning](../decisions/independent-package-versioning.md).[^arch]

## Owner

The emitted plugin exports `{ hooks }` with a single `updateConfig(config)` that merges the frozen managed base into the consuming repo's pnpm config, local-takes-precedence with per-field enforcement levels (`absent` / `warn` / `error`).[^arch] The authored configuration is the argument object passed to `PnpmConfigPlugin({...})` in `packages/pnpm-plugin-silk/lib/build/pnpm-config.plugin.ts` — the single source of truth for catalogs, overrides, `allowBuilds`, hoist patterns, peer rules, release-age gating and security defaults; `src/` is two re-export lines over it.[^arch]

## Load-bearing managed entries

- **The build catalog holds only what the kit does not.** `catalog:build` (and `build:peers`) carries just `@tsdown/css` and `@types/bun`. Every other build-chain and toolchain member — tsdown, rolldown, rolldown-plugin-dts, `@microsoft/api-extractor` and the tsdoc packages, typescript, `@types/node`, tsx, react, `@rsbuild/core`, `@tsdown/exe` — comes from `@effected/pnpm-plugin-effected`'s `catalog:effected:build`, so a manifest here declares those against `catalog:effected:build` (see [kit-package-build](../decisions/kit-package-build.md)). The `docs` and `silk` catalogs (and their `:peers`) carry no toolchain member either — typescript, tsx, `@types/node`, `@types/react`, `@types/react-dom`, react and react-dom left them — and neither `publicHoistPattern` nor `minimumReleaseAgeExclude` repeats what the kit already hoists or exempts (`effect`, `@effect/*`, `@effected/*`, `@oxc-project/*`, `@rolldown/*`, `@typescript/*`); the kit is upstream of `@savvy-web/silk` for the toolchain, which silk peers through `catalog:effected:build:peers`. The managed config carries no `overrides`: the former `tsdown>rolldown-plugin-dts: ^0.29.0` lift went once tsdown's own range admitted the line the kit resolves. Never take the registry's `@microsoft/api-extractor@8.0.0`, even though update tooling offers it as a major: it is a 2019 release on TypeScript ~3.1 and tsdoc 0.12.5, not a successor.[^arch]
- **Effect is exempt from release-age gating.** `minimumReleaseAgeExclude` lists `effect` and `@effect/*` alongside `@effected/*`, so a fresh Effect release installs without waiting out `minimumReleaseAge`. The two entries were once hand-added only to the root `pnpm-workspace.yaml`, and a `pnpm pnpm:export` dropped them, since the export rewrites the managed sections from the authored config. They now live in `lib/build/pnpm-config.plugin.ts` like every other managed key.[^arch]
- **`@savvy-web/changelog` is hoisted; `@savvy-web/cli` and `@savvy-web/mcp` no longer are.** `publicHoistPattern` hoists `@savvy-web/changelog` because the changesets engine resolves the changelog id named in `.changeset/config.json` by name from the consumer root — a resolution need, not a bin. `@savvy-web/silk` now owns the `savvy`/`savvy-mcp` bins itself as shims over the front ends' `./main`, so a consumer's `node_modules/.bin` is populated off the single silk dependency with no hoist needed for cli/mcp. `excludeByRepo` drops changelog for `savvy-web-systems` — this repo consumes it as a `workspace:*` link and a public hoist would shadow it. Release order is load-bearing here: a silk that carries the bins must ship before or with the pnpm-plugin-silk that stops hoisting, or a consumer on a bin-less silk loses `savvy` from PATH.[^arch]

## Build mechanism

A config dependency cannot run an install-time build step, because it installs before any build tooling exists. `rolldown-pnpm-config` (a rolldown plugin) compiles the declarative config into a pre-built `pnpmfile.mjs` so the published artifact needs no build on the consumer side.[^arch] `effected package build` loads `lib/build/pnpm-config.plugin.ts` through `effected.toml`'s `plugins = [...]`, with `bundleNodeModules = true` and a `[package.build.looseFiles]` entry emitting `pnpmfile.mjs` from `src/pnpmfile.ts`. `pnpm pnpm:export` runs `rolldown-pnpm-config export` from `lib/build`, and `pnpm pnpm:up` runs `rolldown-pnpm-config upgrade lib/build/pnpm-config.plugin.ts`, which walks the literal at the `PnpmConfigPlugin(...)` call statically.[^arch]

## Self-consumption via export

The monorepo that produces this package cannot install it as a config dependency of itself — the config dependency would need to install before the package that builds it exists. The root `pnpm-workspace.yaml` therefore lists only `@effected/pnpm-plugin-effected` under `configDependencies`, and the full managed config from `lib/build/pnpm-config.plugin.ts` is materialized inline via the `rolldown-pnpm-config export` CLI. The managed sections of the root `pnpm-workspace.yaml` are generated output, not hand-edited; hand-maintained keys (`configDependencies`, `autoInstallPeers`, `verifyDepsBeforeRun`) survive the export.[^arch]

## Boundaries and invariants

- **`lib/build/pnpm-config.plugin.ts` is the lone source of truth** for catalogs, overrides, `allowBuilds`, hoist patterns, peer rules, release-age gating and security defaults; do not look for the config anywhere else.[^arch]
- **Catalog `range` and `peer` deliberately diverge** — peer ranges are looser than direct ranges so consumers' peer constraints stay satisfiable as direct ranges advance. `strategy` (`lock` or `lock-minor`) is a CLI-only recompute directive for the `upgrade` command; the runtime merge ignores it.[^arch]
- **After any upgrade the export step must re-run** to re-materialize the root workspace config, since the monorepo consumes the config by export rather than by install.[^arch]
- **Versions independently** with `private: true` in source, `publishConfig.access: public`, an npm-only target, and the repo-wide `updateInternalDependencies: patch`. No `package.json` in the repo consumes it as a `workspace:` dependency. Its only e2e, `__test__/e2e/pnpmfile-contract.e2e.test.ts`, imports the built `index.js` and `pnpmfile.mjs` BY PATH, because a bare `@savvy-web/pnpm-plugin-silk` import inside the package would self-reference the source manifest's `exports`; it reads `dist/prod/npm/pkg`, and the root vitest setup builds this package for it (see [`modules/e2e.md`](e2e.md)). `vitest` is a devDependency for that suite.[^arch]

[^arch]: `../../packages/pnpm-plugin-silk/lib/build/pnpm-config.plugin.ts`, loaded by `../../packages/pnpm-plugin-silk/effected.toml`
