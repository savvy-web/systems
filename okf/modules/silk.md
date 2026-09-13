---
type: Module
title: "@savvy-web/silk"
description: The single install-target package that carries the savvy/savvy-mcp bins and a thin config-integration shim surface over silk-effects.
kind: package
resource: ../../packages/silk
tags: [architecture, tooling]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 60982e0c3319710fe821028e07f1949c57c6e7fce39265929114af1c1b6235eb
sources:
  - id: silk-bins
    resource: ../../packages/silk/src/bin
  - id: silk-build
    resource: ../../packages/silk/savvy.build.ts
  - id: silk-shims
    resource: ../../packages/silk/src
---

# @savvy-web/silk

`@savvy-web/silk` is an install surface, not a library: the top layer (L4) of
the Silk Suite package graph, "carrier + config shims" over
`@savvy-web/silk-effects` (L2).[^silk-shims] A consumer installs this one
package to get the `savvy`/`savvy-mcp` bins on PATH, a static Biome preset,
two TSConfig convention presets, and one config-integration shim per external
tool subpath (changesets, commitlint, lint-staged).

## Boundary

- **No business logic lives here.** Every shim re-shapes `silk-effects`
  output into the exact module form an external tool's config loader
  expects (default vs. named export, array vs. object); the shim files
  under `src/` are the single source of truth for that reshaping, but the
  contract they must hold stable is [`interfaces/silk-shim-exports.md`](../interfaces/silk-shim-exports.md).
- **The one sanctioned import exception.** `src/bin/savvy.ts` and
  `src/bin/savvy-mcp.ts` import `@savvy-web/cli/main` and
  `@savvy-web/mcp/main` respectively;[^silk-bins] nothing else under `src/`
  imports either package. Both bins mirror the front ends' own `main()`
  rather than replacing it, so a direct install of `@savvy-web/cli` or
  `@savvy-web/mcp` keeps working — silk only adds a second way onto PATH.
  Why a `bin` entry rather than a hoisted pattern, and what the carrier
  posture buys, is [`decisions/carrier-pattern-package-graph.md`](../decisions/carrier-pattern-package-graph.md).
- **The suite companions are exact-pinned regular dependencies, never
  peers.** `@savvy-web/cli`, `@savvy-web/mcp` and `@savvy-web/changelog`
  are declared `workspace:*` and published exact-pinned; publishing them as
  peers made pnpm `autoInstallPeers` propagate their Effect graph into
  consumers at the wrong version. The full reasoning is
  [`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md).
- **Two build postures coexist in one build.** The base entries are
  ESM-only and externalize `silk-effects`; two entries
  (`./changesets/changelog`, `./changesets/markdownlint`) force dual-format
  CJS and inline `silk-effects` because their consumers `require()` them.[^silk-build]
- **TSConfig convention presets are silk's, not the build tools'.**
  `./tsconfig/node/root.json` (a self-contained Node-24 monorepo ROOT
  preset) and `./tsconfig/rspress/website.json` (an es2023/browser-targeted
  RSPress SITE preset) ship under `public/tsconfig/**` for a repo that
  follows Silk conventions but has no Silk build tool at that package — the
  bundler owns the lib/build base instead.

## What it is bound by

- The non-import invariant: silk's library code never imports
  `@savvy-web/cli` or `@savvy-web/mcp` outside the two bin shims.
- The type-portability invariant: a shim whose emitted `.d.ts` infers a
  `silk-effects` factory's return type must name a silk-local facade type,
  never the transitive `silk-effects` type, or a consumer config hits
  TS2883.

## Related

- [`decisions/carrier-pattern-package-graph.md`](../decisions/carrier-pattern-package-graph.md)
- [`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md)
- [`interfaces/silk-shim-exports.md`](../interfaces/silk-shim-exports.md)
- [`modules/changelog.md`](changelog.md)
- [`modules/bundler.md`](bundler.md)

[^silk-shims]: `src/silk-shims`
[^silk-bins]: `src/bin/savvy.ts`, `src/bin/savvy-mcp.ts`
[^silk-build]: `savvy.build.ts`
