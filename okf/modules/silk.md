---
type: Module
status: draft
title: "@savvy-web/silk"
description: The single install-target package that carries the savvy/savvy-mcp bins and a thin config-integration shim surface over silk-effects.
kind: package
resource: ../../packages/silk
tags: [architecture, tooling]
generated:
  by: okfit/claude-code
  at: 2026-11-10T21:34:34Z
sources:
  - id: silk-bins
    resource: ../../packages/silk/src/bin
  - id: silk-build
    resource: ../../packages/silk/effected.toml
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
  - id: silk-deps
    resource: ../../packages/silk/package.json
integrity:
  generated:
    body: d109b42356c9ec1b
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
  `via @savvy-web/silk <version>` on every package manager. A user typing
  the bin name gets that suffix only when the manager gives the `.bin` slot
  to silk (pnpm, Yarn); npm and bun give it to the front end's own bin,
  which carries no suffix;[^silk-bins] nothing
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
  externalizes `@savvy-web/silk-effects` (a declared runtime dependency)
  and `source-map-support`, and `effect`/`@effect/platform` in the
  declaration pass only. There is no manifest `transform` keep-list
  either — the default transform publishes `dependencies` as-is, so any
  package a shim's emitted `.d.ts` names must be a real `dependencies`
  entry. `__test__/externals.test.ts` pins all of this against the built
  output: no `.cjs` emitted, and the entries import silk-effects
  externally. It also scans the built output for an inlined npm
  `semver`: nothing silk bundles imports semver now that silk-effects runs
  on the kit's changesets engine, so silk no longer declares it, and the
  scan catches a future dependency that drags it back in (inlined, its
  circular CommonJS modules hit the `require_range is not a function`
  init-order hazard).[^silk-build][^silk-externals-test]
- **Some dependencies are load-bearing without an importer.**
  `@effected/commands`, `@effected/git`, `@effected/workspaces` and
  `effect` satisfy `@savvy-web/silk-effects`' `peerDependencies`;
  `@effected/markdown` and `@effected/markdown-lint` satisfy
  `@effected/changesets`' optional peers. Importing silk-effects always
  loads `@effected/changesets/lint` (behind `ChangesetLinter`), so under a
  strict resolver (pnpm `hoist=false`, Yarn PnP) every package that hands
  `@effected/changesets` to silk-effects must declare both. silk is not
  the only one: [cli](cli.md), [mcp](mcp.md) and
  [changelog](changelog.md) declare them too, so a cli-only, mcp-only or
  changelog-only install does not fail with `ERR_MODULE_NOT_FOUND`. No
  file under `src/` imports any of them, and dropping one breaks installs
  rather than any lint pass. `markdownlint` is a devDependency only: the markdownlint-host
  tests of the changeset rules live in `__test__/changesets/`.[^silk-deps]
- **The bins run from source in the workspace.** `bin` points at
  `src/bin/savvy.ts` and `src/bin/savvy-mcp.ts`; each registers tsx when
  `import.meta.url` ends in `.ts` and then imports the front end's `main`
  dynamically, so a git hook or the plugin's MCP launcher runs it with plain
  `node`. The built `dist/prod/npm/pkg/bin/*.js` never takes that branch.
  See [`conventions/workspace-source-links.md`](../conventions/workspace-source-links.md).[^silk-bins]
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
  follows Silk conventions but has no Silk build tool at that package. A
  library package's base is `@effected/plugin/tsconfig/ecma.json` instead.

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
- [`decisions/kit-package-build.md`](../decisions/kit-package-build.md)

[^silk-shims]: `src/silk-shims`
[^silk-bins]: `src/bin/savvy.ts`, `src/bin/savvy-mcp.ts`
[^silk-build]: `effected.toml`
[^silk-externals-test]: `__test__/externals.test.ts`
[^silk-layers]: `layers.json`
[^silk-layering-test]: `__test__/package-layering.test.ts`
[^silk-boundaries-test]: `__test__/boundaries.test.ts`
[^silk-deps]: `package.json`
