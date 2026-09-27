---
type: Module
title: "e2e"
description: The private, never-published harness area exercising the repo's build and release tooling through the BUILT dist/dev artifact, against isolated fixtures outside the workspace.
kind: workspace
resource: ../../e2e
tags: [testing]
generated:
  by: okfit/claude-code
  at: 2026-09-26T22:54:36Z
  body_sha256: 04d59a44f9bc773b11c151850b143552bd41f344e10a8616df6cd3d3fda2a88e
sources:
  - id: e2e-bundler
    resource: ../../e2e/bundler/__test__/e2e
  - id: e2e-pnpm-plugin-silk
    resource: ../../e2e/pnpm-plugin-silk/__test__/e2e
  - id: e2e-silk
    resource: ../../e2e/silk/__test__/e2e
---

# e2e

`e2e/*` is a top-level `pnpm-workspace.yaml` glob matching three harness
packages — `@e2e/bundler`, `@e2e/pnpm-plugin-silk` and `@e2e/silk` — each
`private: true` and matched by the `@e2e/*` glob in `layers.json`'s
`unconstrained` set, so their own dependency edges are not layer-checked.
Each package under test is declared as a `workspace:*` devDependency, so on
install the harness links the real built `dist/dev` artifact and consumes it
exactly as a downstream repo would: through the published entry points,
never the source tree. The layering guard is not an e2e package: it is a
unit test in silk (see [`interfaces/layers-json.md`](../interfaces/layers-json.md)).

## Boundary

- **Its reason to exist is `catalog:`/`workspace:` specifier resolution.**
  Resolution roots at `process.cwd()`, so the only faithful and hermetic
  way to test it is to run the real built tool as a child process with
  `cwd` set to a fixture that owns its own `pnpm-workspace.yaml`. The
  resolver's root-walk stops at that file rather than climbing to the
  monorepo root — this is the load-bearing isolation guarantee, detailed in
  [`conventions/e2e-isolation.md`](../conventions/e2e-isolation.md).
- **Three coverage tiers.** `@e2e/bundler` spawns the built
  `@savvy-web/bundler` front door (and its raw-tsdown escape hatch) inside
  subprocess fixtures.[^e2e-bundler] `@e2e/pnpm-plugin-silk` imports the
  built `pnpmfile.mjs` and, separately, spawns the built `savvy` binary
  against a real `CatalogResolver` from a git-initialised temp dir outside
  the repo.[^e2e-pnpm-plugin-silk] `@e2e/silk` runs the kit's
  `PackedInstall` (`@effected/workspaces/testing`): it packs silk's
  six-package closure and installs silk's tarball into one scratch
  consumer per available manager — pnpm, npm, Yarn and bun, a missing one
  skipped and logged — with `allowSharedBins: true`, since cli and mcp
  deliberately keep their own `savvy`/`savvy-mcp` bins. For each consumer
  it records who owns each `.bin` slot (`binProvenance`) and runs what a
  user types (`runBin`, `McpProbe` over `command`). It also runs the
  carrier's own shims (`runCarrierBin`, `McpProbe` over `carrierCommand`)
  and asserts they print the `via @savvy-web/silk` suffix on
  `savvy --version` and on the MCP `serverInfo.version` on every manager.
  The test's timeouts come from `PackedInstall.timeoutBudget`.[^e2e-silk]
- **Tests live under `e2e/<pkg>/__test__/e2e/`** and run in the normal
  `pnpm test` gate via `AgentPlugin.discover()` — no separate project
  definition, no separate CI job. The root `vitest.config.ts` gives every
  `@e2e/*` project `fileParallelism: false` (subprocess builds write into
  shared fixture `dist/` directories) and excludes `**/dist/**` from
  coverage.
- **Fixtures are test data, never workspace members.** Each fixture that
  triggers resolution owns its own `pnpm-workspace.yaml`; the `e2e/*` glob
  never matches a fixture or its siblings, and the shared Biome config
  excludes `__test__/**/fixtures`.
- **`@e2e/silk` packs from the source package dir** (`packFrom:
  "source"`), never from `dist/dev/pkg`: `pnpm pack` in the source dir
  honours `publishConfig.directory` and rewrites `workspace:*`/`catalog:`,
  while the `dist/dev/pkg` manifest keeps the protocol specifiers. It
  asserts the absence of any `.npmrc`, hoist pattern or config dependency
  in each scratch consumer — the absence is itself the assertion.

## Related

- [`conventions/e2e-isolation.md`](../conventions/e2e-isolation.md)
- [`interfaces/layers-json.md`](../interfaces/layers-json.md)
- [`modules/bundler.md`](bundler.md)
- [`modules/tsdown-plugins.md`](tsdown-plugins.md)
- [`modules/silk.md`](silk.md)

[^e2e-bundler]: `e2e/bundler/__test__/e2e`
[^e2e-pnpm-plugin-silk]: `e2e/pnpm-plugin-silk/__test__/e2e`
[^e2e-silk]: `e2e/silk/__test__/e2e`
