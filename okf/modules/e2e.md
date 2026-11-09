---
type: Module
status: draft
title: "e2e"
description: "The private, never-published harness area — now only @e2e/silk, the packed-install proof with no owning package — plus the in-package e2e suites under packages/<pkg>/__test__/e2e/ that reach each package's BUILT dist/prod artifact by path."
kind: workspace
resource: ../../e2e
tags: [testing]
generated:
  by: okfit/claude-code
  at: 2026-11-09T19:56:29Z
sources:
  - id: e2e-silk
    resource: ../../e2e/silk/__test__/e2e
  - id: cli-bin-e2e
    resource: ../../packages/cli/__test__/e2e/bin.e2e.test.ts
  - id: mcp-e2e
    resource: ../../packages/mcp/__test__/e2e/server-lifecycle.e2e.test.ts
  - id: silk-bins-e2e
    resource: ../../packages/silk/__test__/e2e/bins.e2e.test.ts
  - id: vitest-setup
    resource: ../../vitest.setup.ts
  - id: pnpmfile-contract
    resource: ../../packages/pnpm-plugin-silk/__test__/e2e/pnpmfile-contract.e2e.test.ts
  - id: regen-catalog
    resource: ../../packages/cli/__test__/e2e/regen-catalog.e2e.test.ts
integrity:
  generated:
    body: 60ddc8573b5e6ee9
---

# e2e

`e2e/*` is a top-level `pnpm-workspace.yaml` glob matching PRIVATE,
never-published harness packages that exercise BUILT artifacts. Only one
remains: `@e2e/silk`, the packed-install proof of the carrier pattern,
which has no single owning package to live in. The `@e2e/*` glob in
`layers.json`'s `unconstrained` set still matches `@e2e/silk`, so its own
dependency edges are not layer-checked; the layering guard itself is a
unit test in silk (see [`interfaces/layers-json.md`](../interfaces/layers-json.md)).

## Boundary

- **Its reason to exist is `catalog:`/`workspace:` specifier resolution
  and built-artifact proof.** Resolution roots at `process.cwd()`, so the
  only faithful and hermetic way to test it is to run the real built tool
  as a child process with `cwd` set to a fixture that owns its own
  `pnpm-workspace.yaml`. The resolver's root-walk stops at that file rather
  than climbing to the monorepo root — the load-bearing isolation
  guarantee, detailed in
  [`conventions/e2e-isolation.md`](../conventions/e2e-isolation.md).
- **Only the artifacts these suites execute are built before a test run.**
  Workspace links resolve to source, so the root vitest global setup runs
  `turbo run build --filter '@savvy-web/silk...' --filter
  @savvy-web/pnpm-plugin-silk` — silk's closure plus pnpm-plugin-silk,
  which together cover every suite below.[^vitest-setup]
- **One harness package plus in-package suites.**
  - `@e2e/silk` (`e2e/silk`) runs the kit's `PackedInstall`
    (`@effected/workspaces/testing`): it packs silk's six-package closure
    from each package's default `dist/prod/npm/pkg` — the published
    artifact, whose manifest `effected package build` has already resolved
    from `workspace:*`/`catalog:` to concrete versions — and installs
    silk's tarball into one scratch consumer per available manager — pnpm,
    npm, Yarn and bun, a missing one skipped and logged — with
    `allowSharedBins: true`, since cli and mcp deliberately keep their own
    `savvy`/`savvy-mcp` bins. For each consumer it records who owns each
    `.bin` slot (`binProvenance`) and runs what a user types (`runBin`,
    `McpProbe` over `command`). It also runs the carrier's own shims
    (`runCarrierBin`, `McpProbe` over `carrierCommand`) and asserts they
    print the `via @savvy-web/silk` suffix on `savvy --version` and on the
    MCP `serverInfo.version` on every manager. The test's timeouts come
    from `PackedInstall.timeoutBudget`. It asserts the absence of any
    `.npmrc`, hoist pattern or config dependency in each scratch consumer —
    the absence is itself the assertion.[^e2e-silk]
  - `packages/cli/__test__/e2e/bin.e2e.test.ts` and
    `regen-catalog.e2e.test.ts` spawn the built `savvy` bin
    (`dist/prod/npm/pkg/bin/savvy.js`); `regen-catalog` runs it against a
    real `CatalogResolver` from a git-initialised temp dir outside the
    repo, and resolves `@savvy-web/silk/changesets/markdownlint` through
    the root devDependency on silk.[^cli-bin-e2e][^regen-catalog]
  - `packages/mcp/__test__/e2e/server-lifecycle.e2e.test.ts` spawns the
    built `savvy-mcp` bin, and `packages/silk/__test__/e2e/bins.e2e.test.ts`
    the carrier's built bins.[^mcp-e2e][^silk-bins-e2e]
  - `packages/pnpm-plugin-silk/__test__/e2e/pnpmfile-contract.e2e.test.ts`
    imports the built `dist/prod/npm/pkg/index.js` and `pnpmfile.mjs` by
    path.[^pnpmfile-contract]
- **A built bin still imports its workspace siblings from source.** Each
  suite that spawns one passes `NODE_OPTIONS=--import=<absolute tsx file
  URL>`; a bare `--import=tsx` inherited from pnpm's `nodeOptions` would
  resolve against the child's working directory and fail.[^cli-bin-e2e]
- **In-package suites reach the artifact BY PATH, never by bare
  self-import.** Inside its own package a bare `@savvy-web/<pkg>` import
  self-references the source manifest's `exports`, which point at `src/`.
- **Every e2e test runs in the normal `pnpm test` gate** via
  `AgentPlugin.discover()` — no separate project definition, no separate
  CI job. The root `vitest.config.ts` gives the `@e2e/*` project
  `fileParallelism: false` and excludes `**/dist/**` from coverage.
- **Fixtures are test data, never workspace members.** They live under
  `packages/<pkg>/__test__/e2e/fixtures/<name>/`; each fixture that
  triggers resolution owns its own `pnpm-workspace.yaml`; no `packages:`
  glob matches a fixture, and the shared Biome config excludes
  `__test__/**/fixtures`.

## Related

- [`conventions/e2e-isolation.md`](../conventions/e2e-isolation.md)
- [`conventions/workspace-source-links.md`](../conventions/workspace-source-links.md)
- [`interfaces/layers-json.md`](../interfaces/layers-json.md)
- [`modules/cli.md`](cli.md)
- [`modules/mcp.md`](mcp.md)
- [`modules/pnpm-plugin-silk.md`](pnpm-plugin-silk.md)
- [`modules/silk.md`](silk.md)

[^e2e-silk]: `e2e/silk/__test__/e2e`
[^cli-bin-e2e]: `packages/cli/__test__/e2e/bin.e2e.test.ts`
[^mcp-e2e]: `packages/mcp/__test__/e2e/server-lifecycle.e2e.test.ts`
[^silk-bins-e2e]: `packages/silk/__test__/e2e/bins.e2e.test.ts`
[^vitest-setup]: `vitest.setup.ts`
[^pnpmfile-contract]: `packages/pnpm-plugin-silk/__test__/e2e/pnpmfile-contract.e2e.test.ts`
[^regen-catalog]: `packages/cli/__test__/e2e/regen-catalog.e2e.test.ts`
