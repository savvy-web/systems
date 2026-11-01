---
type: Convention
status: draft
title: Spell dependency ranges through purpose-scoped catalogs
description: "Declare a dependency against catalog:build / catalog:docs / catalog:lint / catalog:silk / catalog:test (each with a <name>:peers companion) or the single catalog:effected for effect, @effect/* and @effected/* — never a hand-pinned version, and never the retired camelCase <name>Peers spelling."
tags: [release, build]
stale_after: 2026-12-11T00:00:00Z
sources:
  - id: pnpm-plugin-silk-arch
    resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
generated:
  by: okfit/claude-code
  at: 2026-11-01T17:38:16Z
integrity:
  generated:
    body: 5f308c42f88a1535
---

# Spell dependency ranges through purpose-scoped catalogs

Spell every dependency range as `catalog:<name>` (or `catalog:<name>:peers` for a peer range), never a literal version. Five purpose-scoped catalog pairs cover this repo's own tooling — `catalog:build`, `catalog:docs`, `catalog:lint`, `catalog:silk`, `catalog:test`, each with a `<name>:peers` companion carrying a looser peer range for the same packages. Do not use the retired camelCase `<name>Peers` spelling (e.g. `buildPeers`) — it is gone from the config; the only correct form is the colon-suffixed `<name>:peers`.[^pnpm-plugin-silk-arch]

Spell `effect`, every `@effect/*` package and every `@effected/*` kit package as `catalog:effected` in `dependencies`, `devDependencies` and `peerDependencies` alike. The catalog comes from the separate `@effected/pnpm-plugin-effected` config dependency, and it has no `:peers` companion. Do not write `catalog:effect`, `catalog:effect:peers` or `catalog:effected:peers`: they were retired with the move from `@effected/pnpm-plugin-effect` to `@effected/pnpm-plugin-effected` 0.20.0, and a manifest that still spells one fails the install with `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC`. Do not hand-write overrides pinning Effect family members either; the plugin pins the whole family graph-wide itself. Never put Effect ranges into the five Silk-authored catalogs above, and never introduce an `effect3`-named catalog: it does not exist, was removed upstream, and no manifest in this repo resolves against it.

Author every catalog value in exactly one place: `packages/pnpm-plugin-silk/savvy.build.ts`'s `PnpmConfigPlugin({...})` argument, as a `{ range, peer?, strategy? }` entry per package. `range` feeds the `<name>` catalog and `peer` feeds the `<name>:peers` catalog; the two deliberately diverge so a consumer's peer constraint stays satisfiable as the direct range advances. Do not hand-edit the root `pnpm-workspace.yaml`'s catalog blocks directly — they are generated output, rewritten from `savvy.build.ts` by `pnpm pnpm:export`, and a hand edit is overwritten on the next export.[^pnpm-plugin-silk-arch]

Run the maintainer workflow from the repo root rather than reaching into `packages/pnpm-plugin-silk` directly: `pnpm pnpm:up` to bump ranges and recompute peers per each package's `strategy`, `pnpm pnpm:preview` to inspect changes before committing to them, and `pnpm pnpm:export` after any upgrade to re-materialize the root workspace file, since this monorepo consumes its own catalog config by export rather than by install.[^pnpm-plugin-silk-arch]

See [pnpm-plugin-silk](../modules/pnpm-plugin-silk.md) for the package this convention governs, [silk-catalogs](../interfaces/silk-catalogs.md) for the catalog contract from a consumer's side, and [kit-effect-peers-via-catalog](../decisions/kit-effect-peers-via-catalog.md) for why the `@effected/*` kit's identity-carrying packages are peered through `catalog:effected`, and what that does to published peer ranges.

[^pnpm-plugin-silk-arch]: `../../packages/pnpm-plugin-silk/savvy.build.ts` — the `PnpmConfigPlugin({...})` catalog authoring point
