---
type: Module
title: "@savvy-web/silk"
description: The single install-target package that carries the savvy/savvy-mcp bins and a thin config-integration shim surface over silk-effects.
kind: package
resource: ../../packages/silk
tags: [architecture, tooling]
generated:
  by: okfit/claude-code
  at: 2026-09-25T02:26:25Z
  body_sha256: 03542aaea5f3004b2df8c2f2e2d6bfe12065c2799c35920ba097fb090ea58c31
sources:
  - id: silk-bins
    resource: ../../packages/silk/src/bin
  - id: silk-build
    resource: ../../packages/silk/savvy.build.ts
  - id: silk-shims
    resource: ../../packages/silk/src
  - id: silk-externals-test
    resource: ../../packages/silk/__test__/externals.test.ts
  - id: silk-layers
    resource: ../../packages/silk/layers.json
  - id: silk-layering-test
    resource: ../../packages/silk/__test__/package-layering.test.ts
  - id: silk-boundaries-test
    resource: ../../packages/silk/__test__/boundaries.test.ts
---

# @savvy-web/silk

`@savvy-web/silk` is an install surface, not a library: the top layer (L4) of
the Silk Suite package graph, "carrier + config shims" over
`@savvy-web/silk-effects` (L2).[^silk-shims] A consumer installs this one
package to get the `savvy`/`savvy-mcp` bins on PATH, a static Biome preset,
two TSConfig convention presets, and one config-integration shim per external
tool subpath (markdownlint, commitlint, lint-staged).

## Boundary

- **No business logic lives here.** Every shim re-shapes `silk-effects`
  output into the exact module form an external tool's config loader
  expects (default vs. named export, array vs. object); the shim files
  under `src/` are the single source of truth for that reshaping, but the
  contract they must hold stable is [`interfaces/silk-shim-exports.md`](../interfaces/silk-shim-exports.md).
- **The one sanctioned import exception.** `src/bin/savvy.ts` and
  `src/bin/savvy-mcp.ts` import `@savvy-web/cli/main` and
  `@savvy-web/mcp/main` respectively and pass
  `main()` a `distribution` naming `@savvy-web/silk` at silk's own
  build-time version, so `savvy --version` and the MCP `serverInfo.version` end in
  `via @savvy-web/silk <version>` — guaranteed under pnpm only, since npm's
  flat `.bin` may link a front end's own bin instead;[^silk-bins] nothing
  else under `src/` imports either package, which
  `__test__/boundaries.test.ts` pins with `SourceBoundary`, waiving exactly
  the two shim imports.[^silk-boundaries-test] Both bins mirror the front ends' own `main()`
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
- **One build posture: ESM-only, every entry, no per-entry overrides.**
  The Changesets CLI (v3, `"type": "module"`), markdownlint-cli2 (0.23+)
  and commitlint (v19+) all `import()` their config modules, so no entry
  ships a CJS twin and nothing force-bundles `silk-effects`; every entry
  externalizes `@savvy-web/silk-effects` (a declared runtime dependency),
  `semver` and `source-map-support`, and `effect`/`@effect/platform` in
  the declaration pass only. There is no manifest `transform` keep-list
  either — the default transform publishes `dependencies` as-is, so any
  package a shim's emitted `.d.ts` names must be a real `dependencies`
  entry. `__test__/externals.test.ts` pins all of this against the built
  output: no `.cjs` emitted, and the entries import silk-effects
  externally.[^silk-build][^silk-externals-test]
- **The changelog generator is not a silk subpath.** It lives in
  [`modules/changelog.md`](changelog.md); silk carries that package as an
  exact-pinned dependency so the changesets engine can resolve it by id
  from the consumer root, but nothing under `src/` imports it. The
  long-deprecated `./changesets`, `./changesets/changelog`,
  `./changesets/remark` and `./commitlint/{static,prompt,formatter}`
  subpaths that predated the split are gone from the export map.[^silk-shims]
- **TSConfig convention presets are silk's, not the build tools'.**
  `./tsconfig/node/root.json` (a self-contained Node-24 monorepo ROOT
  preset) and `./tsconfig/rspress/website.json` (an es2023/browser-targeted
  RSPress SITE preset) ship under `public/tsconfig/**` for a repo that
  follows Silk conventions but has no Silk build tool at that package — the
  bundler owns the lib/build base instead.

- **The layering policy lives here.** `layers.json` — the whole
  repository's package layering, on `@effected/workspaces`' `LayerPolicy`
  schema — sits at the package root because silk is the top of the graph,
  and `__test__/package-layering.test.ts` holds the live workspace to it
  with `WorkspaceLayering`. See
  [`interfaces/layers-json.md`](../interfaces/layers-json.md).[^silk-layers][^silk-layering-test]

## What it is bound by

- The non-import invariant: silk's library code never imports
  `@savvy-web/cli` or `@savvy-web/mcp` outside the two bin shims.
- The package layering in [`conventions/package-layering.md`](../conventions/package-layering.md).
- The type-portability invariant: a shim whose emitted `.d.ts` infers a
  `silk-effects` factory's return type must name a silk-local facade type,
  never the transitive `silk-effects` type, or a consumer config hits
  TS2883.

## Related

- [`decisions/carrier-pattern-package-graph.md`](../decisions/carrier-pattern-package-graph.md)
- [`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md)
- [`decisions/front-ends-adopt-effected-kit.md`](../decisions/front-ends-adopt-effected-kit.md)
- [`interfaces/layers-json.md`](../interfaces/layers-json.md)
- [`interfaces/silk-shim-exports.md`](../interfaces/silk-shim-exports.md)
- [`modules/changelog.md`](changelog.md)
- [`modules/bundler.md`](bundler.md)

[^silk-shims]: `src/silk-shims`
[^silk-bins]: `src/bin/savvy.ts`, `src/bin/savvy-mcp.ts`
[^silk-build]: `savvy.build.ts`
[^silk-externals-test]: `__test__/externals.test.ts`
[^silk-layers]: `layers.json`
[^silk-layering-test]: `__test__/package-layering.test.ts`
[^silk-boundaries-test]: `__test__/boundaries.test.ts`
