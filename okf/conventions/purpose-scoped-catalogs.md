---
type: Convention
status: stable
title: Spell dependency ranges through purpose-scoped catalogs
description: "Declare a dependency against catalog:build / catalog:docs / catalog:lint / catalog:silk / catalog:test (each with a <name>:peers companion), catalog:effected (catalog:effected:peers in peerDependencies) for effect, @effect/* and @effected/*, or catalog:effected:build (catalog:effected:build:peers in peers) for the build chain — never a hand-pinned version, and never the retired camelCase <name>Peers spelling."
tags: [release, build]
stale_after: 2026-12-11T00:00:00Z
sources:
  - id: pnpm-plugin-silk-arch
    resource: ../../packages/pnpm-plugin-silk/lib/build/pnpm-config.plugin.ts
generated:
  by: okfit/claude-code
  at: 2026-11-10T16:02:50Z
integrity:
  generated:
    body: 3ee21603c2fc25cc
  verified:
    by: human:spencer
    at: 2026-11-10T15:59:52Z
    content: 5aed13521c9ec83f
verified:
  - by: human:spencer
    at: 2026-11-10T15:59:52Z
---

# Spell dependency ranges through purpose-scoped catalogs

Spell every dependency range as `catalog:<name>` (or `catalog:<name>:peers` for a peer range), never a literal version. Five purpose-scoped catalog pairs cover this repo's own tooling — `catalog:build`, `catalog:docs`, `catalog:lint`, `catalog:silk`, `catalog:test`, each with a `<name>:peers` companion carrying a looser peer range for the same packages. Do not use the retired camelCase `<name>Peers` spelling (e.g. `buildPeers`) — it is gone from the config; the only correct form is the colon-suffixed `<name>:peers`.[^pnpm-plugin-silk-arch]

Spell `effect`, every `@effect/*` package and every `@effected/*` kit package as `catalog:effected` in `dependencies` and `devDependencies`, and as `catalog:effected:peers` in `peerDependencies`. Both catalogs come from the separate `@effected/pnpm-plugin-effected` config dependency. Never spell a peer `catalog:effected`: since plugin 0.26.0 that catalog names each Effect family member at its exact override version, so the peer would publish an exact pin. Do not write `catalog:effect` or `catalog:effect:peers`: they were retired with the move from `@effected/pnpm-plugin-effect` to `@effected/pnpm-plugin-effected` 0.20.0, and a manifest that still spells one fails the install with `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC`. Do not hand-write overrides pinning Effect family members either; the plugin pins the whole family graph-wide itself, and its exact `effected` catalog covers the `catalog:` specs pnpm's overrides do not reach (pnpm/pnpm#17922). Never put Effect ranges into the five Silk-authored catalogs above, and never introduce an `effect3`-named catalog: it does not exist, was removed upstream, and no manifest in this repo resolves against it.

Spell every build-chain and toolchain package — tsdown, rolldown, rolldown-plugin-dts, `@microsoft/api-extractor` and the tsdoc packages, typescript, `@types/node`, tsx, react, `@rsbuild/core`, `@tsdown/exe` — as `catalog:effected:build` in direct dependencies and `catalog:effected:build:peers` in peers; `@effected/pnpm-plugin-effected` supplies both. No Silk catalog — `docs` and `silk` included — carries a toolchain member. `catalog:build` keeps only the members the kit does not catalog (`@tsdown/css`, `@types/bun`); do not add a build-chain package back to it (see [kit-package-build](../decisions/kit-package-build.md)).

Author every catalog value in exactly one place: `packages/pnpm-plugin-silk/lib/build/pnpm-config.plugin.ts`'s `PnpmConfigPlugin({...})` argument, as a `{ range, peer?, strategy? }` entry per package. `range` feeds the `<name>` catalog and `peer` feeds the `<name>:peers` catalog; the two deliberately diverge so a consumer's peer constraint stays satisfiable as the direct range advances. Do not hand-edit the root `pnpm-workspace.yaml`'s catalog blocks directly — they are generated output, rewritten from that file by `pnpm pnpm:export`, and a hand edit is overwritten on the next export.[^pnpm-plugin-silk-arch]

Run the maintainer workflow from the repo root rather than reaching into `packages/pnpm-plugin-silk` directly: `pnpm pnpm:up` to bump ranges and recompute peers per each package's `strategy`, `pnpm pnpm:preview` to inspect changes before committing to them, and `pnpm pnpm:export` after any upgrade to re-materialize the root workspace file, since this monorepo consumes its own catalog config by export rather than by install.[^pnpm-plugin-silk-arch]

See [pnpm-plugin-silk](../modules/pnpm-plugin-silk.md) for the package this convention governs, [silk-catalogs](../interfaces/silk-catalogs.md) for the catalog contract from a consumer's side, and [kit-effect-peers-via-catalog](../decisions/kit-effect-peers-via-catalog.md) for why the `@effected/*` kit's identity-carrying packages are peered through `catalog:effected:peers`, and what that does to published peer ranges.

[^pnpm-plugin-silk-arch]: `../../packages/pnpm-plugin-silk/lib/build/pnpm-config.plugin.ts` — the `PnpmConfigPlugin({...})` catalog authoring point
