---
status: current
module: pnpm-plugin-silk
category: architecture
created: 2026-06-30
updated: 2026-06-30
last-synced: 2026-06-30
completeness: 85
related:
  - ../bundler/architecture.md
dependencies:
  - ../bundler/architecture.md
---

# @savvy-web/pnpm-plugin-silk architecture

The single pnpm config dependency that distributes the Silk Suite's shared workspace configuration to every consuming repository in the ecosystem. It ships two version catalogs (`silk` for direct-dependency ranges, `silkPeers` for permissive peer ranges), security `overrides`, a build-script `allowBuilds` allowlist, `publicHoistPattern`, `peerDependencyRules`, `minimumReleaseAge` gating and the `strictDepBuilds`/`blockExoticSubdeps` security defaults. All of it merges into a consumer's pnpm config at install time. It is the only package in this repo published to npm only, never to GitHub Packages.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Build mechanism](#build-mechanism)
- [Self-consumption via export](#self-consumption-via-export)
- [Catalog package strategy](#catalog-package-strategy)
- [Maintainer workflow](#maintainer-workflow)
- [Release posture](#release-posture)
- [Rationale](#rationale)
- [Related Documentation](#related-documentation)

## Overview

A pnpm config dependency installs before everything else in a workspace and contributes settings to the consuming repo's resolved pnpm config. `@savvy-web/pnpm-plugin-silk` is the suite's one config dependency: consumers add it to `pnpm-workspace.yaml` under `configDependencies` (pinned with its `+sha512-...` integrity hash) and thereafter reference `catalog:silk` / `catalog:silkPeers` in their manifests. See `packages/pnpm-plugin-silk/README.md` for the consumer-facing install and usage contract.

The emitted plugin exports `{ hooks }` with a single `updateConfig(config)` function that merges the frozen managed base into the consuming repo's pnpm config. Merge semantics are local-takes-precedence with per-field enforcement levels (silent / warn / error), so a downstream repo can extend or override settings while divergences from the managed base surface as warnings.

## Current State

Fully migrated into this monorepo on branch `feat/pnpm-plugin-silk` from its former standalone repo `savvy-web/pnpm-plugin-silk`, which will be archived after the first release cut from here. Currently v0.17.0, `private: true` in source with `publishConfig.access: public` and an npm-only target (`publishConfig.targets.npm`). The package builds through the `@savvy-web/bundler` front door like the other in-repo packages.

The authored configuration is the argument object passed to `PnpmConfigPlugin({...})` in `savvy.build.ts` — that file is the single source of truth for catalogs, overrides, `allowBuilds`, hoist patterns, peer rules, release-age gating and security defaults. Do not look for the config anywhere else; `src/` is two re-export lines.

## Build mechanism

A config dependency cannot run an install-time build step, because it installs before any build tooling exists. The enabling mechanism is `rolldown-pnpm-config` (external package, see `/Users/spencer/workspaces/spencerbeggs/rolldown-pnpm-config`), a rolldown plugin that compiles a declarative config into a pre-built `pnpmfile.mjs`/`.cjs` so the published artifact needs no build on the consumer side.

In this package `savvy.build.ts` calls the bundler's `build()` with `PnpmConfigPlugin({...})` as a plugin, plus `bundleNodeModules: true` and a `looseFiles` map that emits both `pnpmfile.mjs` and `pnpmfile.cjs` from `src/pnpmfile.ts`. The three source files are thin seams over the plugin's virtual modules: `src/index.ts` re-exports `catalogs` from `rolldown-pnpm-config/virtual/catalogs`, `src/pnpmfile.ts` re-exports `hooks` from `rolldown-pnpm-config/virtual/pnpmfile` and `types/refs.d.ts` carries the `/// <reference types="rolldown-pnpm-config/virtual" />` triple-slash directive that types those virtual modules. See `../bundler/architecture.md` for the `build()` / `looseFiles` contract this leans on.

## Self-consumption via export

The monorepo that produces this package cannot install it as a config dependency of itself: the config dependency would need to install before the package that builds it exists. On `main` the root `pnpm-workspace.yaml` carried a `configDependencies` entry pinning `@savvy-web/pnpm-plugin-silk`. On this branch that line is gone. Instead the full managed config — catalogs, overrides, `allowBuilds`, `allowedDeprecatedVersions`, `blockExoticSubdeps`, `minimumReleaseAge` (and its exclude list), `peerDependencyRules`, `publicHoistPattern` and `strictDepBuilds` — is materialized inline into the root `pnpm-workspace.yaml` by the `rolldown-pnpm-config export` CLI.

So the monorepo dogfoods its own config by exporting it locally rather than installing it as a config dependency. The exported `pnpm-workspace.yaml` is generated output: it is rewritten from `savvy.build.ts`, not hand-edited. The export preserves existing `file:` / `link:` / `workspace:` / `portal:` entries and applies any `local` directives plus `excludeByRepo` filtering.

## Catalog package strategy

Each `silk` catalog package entry is `{ range, peer?, strategy? }`. `range` is the direct-dependency range that feeds the `silk` catalog; `peer` is the materialized peer-range literal that feeds the `silkPeers` catalog. The two catalogs deliberately diverge — `silkPeers` ranges are looser than their `silk` counterparts so consumers' peer constraints stay satisfiable as direct ranges advance (for example the `@effect/*` family's peer ranges sit a patch/minor below their direct ranges).

`strategy` is a CLI-only recompute directive consulted by the `upgrade` command; the runtime merge ignores it. Its values are `lock` (recompute the peer to the exact new version), `lock-minor` (lock to major.minor and allow patch drift) and `interop` (reconcile a group of packages against each other's peer constraints, used for the coordinated `@effect/*` family). The full catalog and its per-package strategies live in the `PnpmConfigPlugin` argument in `savvy.build.ts`.

## Maintainer workflow

The root `package.json` proxies three scripts into this package so maintenance runs from the repo root:

- `pnpm pnpm:up` → `rolldown-pnpm-config upgrade savvy.build.ts`: an interactive walk that bumps catalog ranges, recomputes peer ranges per each package's `strategy` and respects `minimumReleaseAge` gating.
- `pnpm pnpm:preview` → `rolldown-pnpm-config preview`: a read-only Ink tabbed explorer with Changes / Full / Simulated views.
- `pnpm pnpm:export` → `rolldown-pnpm-config export`: rewrites the root `pnpm-workspace.yaml` (see [self-consumption](#self-consumption-via-export)).

After any upgrade the export step must run to re-materialize the root workspace config, since the monorepo consumes the config by export rather than by install.

## Release posture

Versions independently, as every package now does — `.changeset/config.json` no longer defines any `fixed` or `linked` groups. The repo-wide `updateInternalDependencies: patch` still applies.

## Rationale

The package moved into the monorepo to break a publishing loop. While it lived in its own repo, upgrading a shared dependency such as TypeScript meant cutting a release there, pulling it into this repo, cutting a release here, then propagating to other repos — multiple release hops for one version bump. Co-locating it lets the suite dogfood config changes against its own core tooling and release once.

The cost of co-location is the chicken-and-egg self-consumption problem, solved by the export path rather than an install path. That is the central tension in this package's design: it is authored as a config dependency for 33 downstream repos, yet its own host repo can only consume it by exporting it inline. Keeping `savvy.build.ts` as the lone source of truth, with both the published `pnpmfile` and the root `pnpm-workspace.yaml` derived from it, is what keeps the two consumption paths in sync.

## Related Documentation

- `../bundler/architecture.md` — the `build()` front door and `looseFiles` mechanism this package builds through.
- `packages/pnpm-plugin-silk/README.md` — consumer-facing install and catalog usage.
- `rolldown-pnpm-config` (`/Users/spencer/workspaces/spencerbeggs/rolldown-pnpm-config`) — the rolldown plugin and CLI (`upgrade` / `preview` / `export`) that compiles and materializes the config.
