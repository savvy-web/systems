---
type: Interface
title: "@savvy-web/pnpm-plugin-silk catalog names"
description: "The catalog names a consumer manifest may reference after adding this config dependency, what the plugin hoists, and what a consumer must not assume about catalog contents."
status: draft
kind: config
resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
tags: [release, build]
sources:
  - id: pnpm-plugin-silk-architecture
    resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 5d31488bbb3fc781177525dfac9b5990dc78a2212546d9c8a064fe0111dcdd75
---

# @savvy-web/pnpm-plugin-silk catalog names

## The contract

After a consumer adds `@savvy-web/pnpm-plugin-silk` under
`pnpm-workspace.yaml`'s `configDependencies` (pinned with its
`+sha512-...` integrity hash), its manifests may reference the following
catalog names. `packages/pnpm-plugin-silk/savvy.build.ts`'s
`PnpmConfigPlugin({ catalogs: {...} })` argument is the single source of
truth for every catalog's contents; this concept documents the names and
guarantees, not the version ranges.[^pnpm-plugin-silk-architecture]

- **`catalog:build`** / **`catalog:build:peers`**
- **`catalog:docs`** / **`catalog:docs:peers`**
- **`catalog:lint`** / **`catalog:lint:peers`**
- **`catalog:silk`** / **`catalog:silk:peers`**
- **`catalog:test`** / **`catalog:test:peers`**

Each `<name>` catalog carries a direct-dependency range; each
`<name>:peers` companion carries a deliberately looser peer-range literal,
so a consumer's peer constraint stays satisfiable as the direct range
advances. The two are never the same value by design — do not assume
`catalog:<name>:peers` mirrors `catalog:<name>`.[^pnpm-plugin-silk-architecture]

**`catalog:effect` / `catalog:effect:peers` are NOT provided by this
package.** They come from the separate `@effected/pnpm-plugin-effect`
config dependency, so the Effect closure versions independently of the
Silk catalogs — see
[`decisions/kit-effect-peers-via-catalog.md`](../decisions/kit-effect-peers-via-catalog.md).[^pnpm-plugin-silk-architecture]

## What the config dependency hoists

**Only `@savvy-web/changelog` is hoisted**, via `publicHoistPattern` — the
changesets engine resolves the changelog id named in
`.changeset/config.json` by name from the consumer root, which is a
resolution need, not a bin need. `@savvy-web/cli` and `@savvy-web/mcp` are
**no longer hoisted**: `@savvy-web/silk` owns the `savvy`/`savvy-mcp` bins
itself as shims over the front ends' `./main`, so a consumer's
`node_modules/.bin` is populated off the single silk dependency under
every package manager with no hoist required.[^pnpm-plugin-silk-architecture]

A consumer that still expects `cli`/`mcp` on the hoist list — e.g. an older
integration written against a previous release of this config dependency
— must upgrade `@savvy-web/silk` to a release that carries the bins
before or with adopting a pnpm-plugin-silk release that stops hoisting
them, or `savvy` disappears from PATH.[^pnpm-plugin-silk-architecture]

## What a consumer must not assume

- **Catalog contents are not this document's concern and may change on any
  release** — only the catalog *names* above and the `<name>`/`<name>:peers`
  divergence are the stable part of this contract.
- **Do not assume `@savvy-web/cli` or `@savvy-web/mcp` are hoisted** — only
  `@savvy-web/changelog` is, and only outside this monorepo (this repo's own
  `excludeByRepo` entry drops it here, since it consumes changelog as a
  `workspace:*` link instead).
- **Do not assume this plugin supplies the Effect catalogs** — request
  `@effected/pnpm-plugin-effect` separately for `catalog:effect`/`catalog:effect:peers`.
- **`strategy` values on a catalog package entry (`lock`/`lock-minor`) are
  an upgrade-CLI-only directive** and carry no runtime meaning for a
  consumer's install.

## Related

- [`modules/pnpm-plugin-silk.md`](../modules/pnpm-plugin-silk.md) — the
  package that authors and ships this config.
- [`conventions/purpose-scoped-catalogs.md`](../conventions/purpose-scoped-catalogs.md)
  — the naming convention these catalogs follow and how a package should
  reference them.
- [`decisions/kit-effect-peers-via-catalog.md`](../decisions/kit-effect-peers-via-catalog.md)
  — why the Effect catalogs are supplied separately rather than by this
  package.

[^pnpm-plugin-silk-architecture]: `../../packages/pnpm-plugin-silk/savvy.build.ts`
