---
status: current
module: pnpm-plugin-silk
category: architecture
created: 2026-06-30
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 85
related:
  - ../bundler/architecture.md
  - ../tsdown-plugins/architecture.md
dependencies:
  - ../bundler/architecture.md
---

# @savvy-web/pnpm-plugin-silk architecture

The single pnpm config dependency that distributes the Silk Suite's shared workspace configuration to every consuming repository in the ecosystem. It ships five purpose-scoped catalog pairs (`build`, `docs`, `lint`, `silk`, `test`, each with a `<name>:peers` companion carrying permissive peer ranges), security `overrides`, an `allowBuilds` allowlist, `publicHoistPattern`, `peerDependencyRules`, `minimumReleaseAge` gating and the `strictDepBuilds`/`blockExoticSubdeps` defaults. All of it merges into a consumer's pnpm config at install time. It is the only package in this repo published to npm only, never to GitHub Packages.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Build mechanism](#build-mechanism)
- [Self-consumption via export](#self-consumption-via-export)
- [Catalog package strategy](#catalog-package-strategy)
- [Maintainer workflow](#maintainer-workflow)
- [Release posture](#release-posture)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

A pnpm config dependency installs before everything else in a workspace and contributes settings to the consuming repo's resolved pnpm config. `@savvy-web/pnpm-plugin-silk` is the suite's config dependency for the Silk toolchain: consumers add it to `pnpm-workspace.yaml` under `configDependencies` (pinned with its `+sha512-...` integrity hash) and thereafter reference `catalog:<name>` / `catalog:<name>:peers` in their manifests. The Effect closure is deliberately NOT here — `catalog:effect` / `catalog:effect:peers` come from the separate `@effected/pnpm-plugin-effect` config dependency, so the two plugins version independently. See `packages/pnpm-plugin-silk/README.md` for the consumer-facing install and usage contract.

The emitted plugin exports `{ hooks }` with a single `updateConfig(config)` function that merges the frozen managed base into the consuming repo's pnpm config. Merge semantics are local-takes-precedence with per-field enforcement levels (`absent` / `warn` / `error`, see `Enforcement` in `rolldown-pnpm-config`), so a downstream repo can extend or override settings while divergences from the managed base surface as warnings.

The authored configuration is the argument object passed to `PnpmConfigPlugin({...})` in `packages/pnpm-plugin-silk/savvy.build.ts` — that file is the single source of truth for catalogs, overrides, `allowBuilds`, hoist patterns, peer rules, release-age gating and security defaults. Do not look for the config anywhere else; `src/` is two re-export lines.

Two managed entries carry decisions a first-time reader will not infer from the values:

- **TS7 compatibility shim.** The catalogs put `typescript` on the TS7 line, but `@microsoft/api-extractor` pins TS ~5.9 and TS 7.0 ships no stable compiler API until 7.1, so `overrides` forces TypeScript 6 into api-extractor's dependency graph (`@microsoft/api-extractor>typescript`) — the 5/6 compiler APIs are equivalent for its purposes. Every consuming repo and the exported root workspace config inherit it; drop it when API Extractor supports TS7.
- **Per-repo hoist exclusion.** `publicHoistPattern` hoists `@savvy-web/cli`, `@savvy-web/mcp` and `@savvy-web/changelog` so their bins are on PATH in every consumer, but `excludeByRepo` drops those three for `savvy-web-systems` — this repo consumes them as `workspace:*` links, and a public hoist would shadow the links with registry copies.

## Current State

Built in-tree through the `@savvy-web/bundler` front door and published to npm only, with `private: true` in source and `publishConfig.access: public`. The distributed config — five catalog pairs, overrides, hoist/build/peer rules, release-age gating and the security defaults — is authored entirely in `packages/pnpm-plugin-silk/savvy.build.ts` and shipped as a pre-built `pnpmfile.mjs`/`.cjs`. Downstream repos consume it as a `configDependencies` entry; this monorepo consumes it by exporting the same config into the root `pnpm-workspace.yaml`. The version, catalog contents and managed values are read from `package.json` and `savvy.build.ts`, not from this doc.

## Build mechanism

A config dependency cannot run an install-time build step, because it installs before any build tooling exists. The enabling mechanism is `rolldown-pnpm-config` ([spencerbeggs/rolldown-pnpm-config](https://github.com/spencerbeggs/rolldown-pnpm-config)), a rolldown plugin that compiles a declarative config into a pre-built `pnpmfile.mjs`/`.cjs` so the published artifact needs no build on the consumer side.

`savvy.build.ts` calls the bundler's `build()` front door with `PnpmConfigPlugin({...})` as a plugin, plus `bundleNodeModules: true` and a `looseFiles` map that emits both `pnpmfile.mjs` and `pnpmfile.cjs` from `src/pnpmfile.ts`. The source files are thin seams over the plugin's virtual modules: `src/index.ts` re-exports `catalogs` from `rolldown-pnpm-config/virtual/catalogs`, `src/pnpmfile.ts` re-exports `hooks` from `rolldown-pnpm-config/virtual/pnpmfile` and `types/env.d.ts` carries the triple-slash references that type those virtual modules and the bundler env. See `../bundler/architecture.md` for the `build()` / `looseFiles` contract this leans on.

**The CJS-format warning on this package's build is expected and deliberately left visible.** tsdown prints "We recommend using the ESM format instead of CommonJS" for the `pnpmfile.cjs` loose file; a pnpm config dependency must ship a CJS pnpmfile for older pnpm loaders, so the advice does not apply. It is NOT routed into the build report's `suppressed` bucket (unlike rolldown's `MIXED_EXPORTS` on silk's cjs interop passes — see `../tsdown-plugins/architecture.md`) because the CJS output is slated to be dropped once older loaders no longer matter, and the warning is the reminder.

## Self-consumption via export

The monorepo that produces this package cannot install it as a config dependency of itself: the config dependency would need to install before the package that builds it exists. So the root `pnpm-workspace.yaml` lists only `@effected/pnpm-plugin-effect` under `configDependencies`, and the full managed config from `savvy.build.ts` is materialized inline into that file by the `rolldown-pnpm-config export` CLI.

The monorepo therefore dogfoods its own config by exporting it locally rather than installing it as a config dependency. The managed sections of the root `pnpm-workspace.yaml` are generated output: they are rewritten from `savvy.build.ts`, not hand-edited (hand-maintained keys such as `configDependencies`, `autoInstallPeers` and `verifyDepsBeforeRun` survive the export). The export preserves existing `file:` / `link:` / `workspace:` / `portal:` entries and applies any `local` directives plus `excludeByRepo` filtering — which is how the hoist exclusion above lands in this repo's own workspace file.

## Catalog package strategy

Each catalog package entry is `{ range, peer?, strategy? }`. `range` is the direct-dependency range that feeds the `<name>` catalog; `peer` is the materialized peer-range literal that feeds the `<name>:peers` catalog. The two catalogs deliberately diverge — peer ranges are looser than their direct counterparts so consumers' peer constraints stay satisfiable as direct ranges advance.

`strategy` is a CLI-only recompute directive consulted by the `upgrade` command; the runtime merge ignores it. See `PeerStrategy` in `rolldown-pnpm-config` for the values; this package uses `lock` (recompute the peer to the exact new version) and `lock-minor` (lock to major.minor and allow patch drift). The full catalog and its per-package strategies live in the `PnpmConfigPlugin` argument in `savvy.build.ts`.

## Maintainer workflow

The root `package.json` proxies three scripts into this package so maintenance runs from the repo root:

- `pnpm pnpm:up` → `rolldown-pnpm-config upgrade savvy.build.ts`: an interactive walk that bumps catalog ranges, recomputes peer ranges per each package's `strategy` and respects `minimumReleaseAge` gating.
- `pnpm pnpm:preview` → `rolldown-pnpm-config preview`: a read-only tabbed explorer with Changes / Full / Simulated views.
- `pnpm pnpm:export` → `rolldown-pnpm-config export`: rewrites the root `pnpm-workspace.yaml` (see [self-consumption](#self-consumption-via-export)).

After any upgrade the export step must run to re-materialize the root workspace config, since the monorepo consumes the config by export rather than by install.

## Release posture

`private: true` in source with `publishConfig.access: public` and an npm-only target (`publishConfig.targets.npm`). Versions independently, like every package in the repo — `.changeset/config.json` defines no `fixed` or `linked` groups — and the repo-wide `updateInternalDependencies: patch` applies. It carries a `prepare: turbo run build:dev` because `e2e/pnpm-plugin-silk` consumes it as a `workspace:*` dependency.

## Rationale

The package lives in the monorepo to break a publishing loop. While it lived in its own repo, upgrading a shared dependency such as TypeScript meant cutting a release there, pulling it into this repo, cutting a release here, then propagating to other repos — multiple release hops for one version bump. Co-locating it lets the suite dogfood config changes against its own core tooling and release once.

The cost of co-location is the chicken-and-egg self-consumption problem, solved by the export path rather than an install path. That is the central tension in this package's design: it is authored as a config dependency for the downstream repos, yet its own host repo can only consume it by exporting it inline. Keeping `savvy.build.ts` as the lone source of truth, with both the published `pnpmfile` and the root `pnpm-workspace.yaml` derived from it, is what keeps the two consumption paths in sync.

## Related documentation

- `../bundler/architecture.md` — the `build()` front door and `looseFiles` mechanism this package builds through.
- `../tsdown-plugins/architecture.md` — the build report's `suppressed` channel the CJS warning is deliberately kept out of.
- `packages/pnpm-plugin-silk/README.md` — consumer-facing install and catalog usage.
- `../e2e/architecture.md` — the `e2e/pnpm-plugin-silk` harness that exercises the built pnpmfile against isolated fixtures.
- [rolldown-pnpm-config](https://github.com/spencerbeggs/rolldown-pnpm-config) — the rolldown plugin and CLI (`upgrade` / `preview` / `export`) that compiles and materializes the config.
