---
type: Convention
title: Spell dependency ranges through purpose-scoped catalogs
description: "Declare a dependency against catalog:build / catalog:docs / catalog:lint / catalog:silk / catalog:test (each with a <name>:peers companion) or catalog:effect / catalog:effect:peers — never a hand-pinned version, and never the retired camelCase <name>Peers spelling."
tags: [release, build]
stale_after: 2026-12-11T00:00:00Z
sources:
  - id: pnpm-plugin-silk-arch
    resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: a7ecd551cb34818c9f1a33b750fc8a466db3515e0efc17d477c3c9be8c52b0dd
---

# Spell dependency ranges through purpose-scoped catalogs

Spell every dependency range as `catalog:<name>` (or `catalog:<name>:peers` for a peer range), never a literal version. Five purpose-scoped catalog pairs cover this repo's own tooling — `catalog:build`, `catalog:docs`, `catalog:lint`, `catalog:silk`, `catalog:test`, each with a `<name>:peers` companion carrying a looser peer range for the same packages. Do not use the retired camelCase `<name>Peers` spelling (e.g. `buildPeers`) — it is gone from the config; the only correct form is the colon-suffixed `<name>:peers`.[^pnpm-plugin-silk-arch]

Spell `effect` and every `@effect/*` package as `catalog:effect` / `catalog:effect:peers`, supplied by the separate `@effected/pnpm-plugin-effect` config dependency — never bundle Effect ranges into the five Silk-authored catalogs above, and never introduce a sixth, `effect3`-named catalog: it does not exist, was removed upstream, and no manifest in this repo resolves against it.

Author every catalog value in exactly one place: `packages/pnpm-plugin-silk/savvy.build.ts`'s `PnpmConfigPlugin({...})` argument, as a `{ range, peer?, strategy? }` entry per package. `range` feeds the `<name>` catalog and `peer` feeds the `<name>:peers` catalog; the two deliberately diverge so a consumer's peer constraint stays satisfiable as the direct range advances. Do not hand-edit the root `pnpm-workspace.yaml`'s catalog blocks directly — they are generated output, rewritten from `savvy.build.ts` by `pnpm pnpm:export`, and a hand edit is overwritten on the next export.[^pnpm-plugin-silk-arch]

Run the maintainer workflow from the repo root rather than reaching into `packages/pnpm-plugin-silk` directly: `pnpm pnpm:up` to bump ranges and recompute peers per each package's `strategy`, `pnpm pnpm:preview` to inspect changes before committing to them, and `pnpm pnpm:export` after any upgrade to re-materialize the root workspace file, since this monorepo consumes its own catalog config by export rather than by install.[^pnpm-plugin-silk-arch]

See [pnpm-plugin-silk](../modules/pnpm-plugin-silk.md) for the package this convention governs, [silk-catalogs](../interfaces/silk-catalogs.md) for the catalog contract from a consumer's side, and [kit-effect-peers-via-catalog](../decisions/kit-effect-peers-via-catalog.md) for why the `@effected/*` kit's identity-carrying packages are peered through `catalog:effected`/`catalog:effected:peers` specifically.

[^pnpm-plugin-silk-arch]: `../../packages/pnpm-plugin-silk/savvy.build.ts` — the `PnpmConfigPlugin({...})` catalog authoring point
