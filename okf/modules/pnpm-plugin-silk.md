---
type: Module
title: pnpm-plugin-silk
description: The single pnpm config dependency that distributes the Silk Suite's shared workspace configuration — catalogs, overrides, build/hoist/peer rules, and release-age gating — to every consuming repository.
kind: package
resource: ../../packages/pnpm-plugin-silk
status: draft
tags: [release, tooling]
sources:
  - id: arch
    resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
generated:
  by: okfit/claude-code
  at: 2026-10-25T14:59:20Z
integrity:
  generated:
    body: b19dfbdedf4b59a3
---

# pnpm-plugin-silk

## Boundary

`@savvy-web/pnpm-plugin-silk` (`packages/pnpm-plugin-silk`) is a pnpm config dependency: a consuming repo adds it to `pnpm-workspace.yaml` under `configDependencies` (pinned with its integrity hash) and thereafter references `catalog:<name>` / `catalog:<name>:peers` in its manifests.[^arch] It ships five purpose-scoped catalog pairs (`build`, `docs`, `lint`, `silk`, `test`), security `overrides`, an `allowBuilds` allowlist, `publicHoistPattern`, `peerDependencyRules`, `minimumReleaseAge` gating, and the `strictDepBuilds`/`blockExoticSubdeps` defaults — see [purpose-scoped catalog naming](../conventions/purpose-scoped-catalogs.md) for the naming rule the catalog pairs follow and [the consumer catalog contract](../interfaces/silk-catalogs.md) for what a consumer may rely on staying stable. The Effect closure is deliberately NOT here: `catalog:effect` / `catalog:effect:peers` come from the separate `@effected/pnpm-plugin-effect` config dependency, so the two plugins version independently.[^arch] It is the only package in this repo published to npm only, never to GitHub Packages — see [independent package versioning](../decisions/independent-package-versioning.md).[^arch]

## Owner

The emitted plugin exports `{ hooks }` with a single `updateConfig(config)` that merges the frozen managed base into the consuming repo's pnpm config, local-takes-precedence with per-field enforcement levels (`absent` / `warn` / `error`).[^arch] The authored configuration is the argument object passed to `PnpmConfigPlugin({...})` in `packages/pnpm-plugin-silk/savvy.build.ts` — the single source of truth for catalogs, overrides, `allowBuilds`, hoist patterns, peer rules, release-age gating and security defaults; `src/` is two re-export lines over it.[^arch]

## Two load-bearing managed entries

- **API Extractor's TypeScript 6 override.** The catalogs put `typescript` on the TS7 line and declaration emit runs on TypeScript 7.1's API (see [the TS 7.1 dts decision](../decisions/typescript-7-1-dts-api.md)), but `@microsoft/api-extractor` still depends on `typescript@5.9` and is written against the TS 5/6 JavaScript API, so `overrides` forces TypeScript 6 into its dependency graph (`@microsoft/api-extractor>typescript: ^6.0.3`). Every consuming repo and the exported root workspace config inherit it; drop it when API Extractor supports TS7 (microsoft/rushstack#6033). The `catalog:build` api-extractor set is `^7.59.4` / api-extractor-model `^7.33.15` / tsdoc `~0.17.1` / tsdoc-config `~0.18.3` — the 2026-09-24 rollback for microsoft/tsdoc#493 was lifted once tsdoc 0.17.1 shipped the fix. `@typescript/native-preview` is gone from `catalog:silk`, `silk:peers` and `publicHoistPattern` (TypeScript 7 ships the Go compiler inside `typescript` itself), and so is the `@savvy-web/bundler>typescript` `allowedVersions` rule, since nothing provides TypeScript 6 to the bundler any more.[^arch]
- **`@savvy-web/changelog` is hoisted; `@savvy-web/cli` and `@savvy-web/mcp` no longer are.** `publicHoistPattern` hoists `@savvy-web/changelog` because the changesets engine resolves the changelog id named in `.changeset/config.json` by name from the consumer root — a resolution need, not a bin. `@savvy-web/silk` now owns the `savvy`/`savvy-mcp` bins itself as shims over the front ends' `./main`, so a consumer's `node_modules/.bin` is populated off the single silk dependency with no hoist needed for cli/mcp. `excludeByRepo` drops changelog for `savvy-web-systems` — this repo consumes it as a `workspace:*` link and a public hoist would shadow it. Release order is load-bearing here: a silk that carries the bins must ship before or with the pnpm-plugin-silk that stops hoisting, or a consumer on a bin-less silk loses `savvy` from PATH.[^arch]

## Build mechanism

A config dependency cannot run an install-time build step, because it installs before any build tooling exists. `rolldown-pnpm-config` (a rolldown plugin) compiles the declarative config into a pre-built `pnpmfile.mjs`/`.cjs` so the published artifact needs no build on the consumer side.[^arch] `savvy.build.ts` calls the bundler's `build()` front door with `PnpmConfigPlugin({...})` as a plugin, `bundleNodeModules: true`, and a `looseFiles` map emitting both `pnpmfile.mjs` and `pnpmfile.cjs` from `src/pnpmfile.ts`.[^arch] The CJS-format build warning on `pnpmfile.cjs` is expected and deliberately left visible, not suppressed, since a pnpm config dependency must ship a CJS pnpmfile for older pnpm loaders.[^arch]

## Self-consumption via export

The monorepo that produces this package cannot install it as a config dependency of itself — the config dependency would need to install before the package that builds it exists. The root `pnpm-workspace.yaml` therefore lists only `@effected/pnpm-plugin-effect` under `configDependencies`, and the full managed config from `savvy.build.ts` is materialized inline via the `rolldown-pnpm-config export` CLI. The managed sections of the root `pnpm-workspace.yaml` are generated output, not hand-edited; hand-maintained keys (`configDependencies`, `autoInstallPeers`, `verifyDepsBeforeRun`) survive the export.[^arch]

## Boundaries and invariants

- **`savvy.build.ts` is the lone source of truth** for catalogs, overrides, `allowBuilds`, hoist patterns, peer rules, release-age gating and security defaults; do not look for the config anywhere else.[^arch]
- **Catalog `range` and `peer` deliberately diverge** — peer ranges are looser than direct ranges so consumers' peer constraints stay satisfiable as direct ranges advance. `strategy` (`lock` or `lock-minor`) is a CLI-only recompute directive for the `upgrade` command; the runtime merge ignores it.[^arch]
- **After any upgrade the export step must re-run** to re-materialize the root workspace config, since the monorepo consumes the config by export rather than by install.[^arch]
- **Versions independently** with `private: true` in source, `publishConfig.access: public`, an npm-only target, and the repo-wide `updateInternalDependencies: patch`. It still carries `prepare: turbo run build:dev`, though since savvy-web/systems#680 retired the `@e2e/pnpm-plugin-silk` harness no `package.json` in the repo consumes it as a `workspace:*` dependency; its only e2e, `__test__/e2e/pnpmfile-contract.e2e.test.ts`, imports the built `dist/dev/pkg/index.js` and `pnpmfile.mjs` BY PATH, because a bare `@savvy-web/pnpm-plugin-silk` import inside the package would self-reference the source manifest's `exports` (see [`modules/e2e.md`](e2e.md)). `vitest` is a devDependency for that suite.[^arch]

[^arch]: `../../packages/pnpm-plugin-silk/savvy.build.ts`
