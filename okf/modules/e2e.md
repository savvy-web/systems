---
type: Module
status: draft
title: "e2e"
description: The private, never-published harness area — now only @e2e/silk, the packed-install proof with no owning package — plus the in-package e2e suites under packages/<pkg>/__test__/e2e/ that reach each package's BUILT dist/dev artifact by path.
kind: workspace
resource: ../../e2e
tags: [testing]
generated:
  by: okfit/claude-code
  at: 2026-10-25T14:59:20Z
sources:
  - id: e2e-silk
    resource: ../../e2e/silk/__test__/e2e
  - id: bundler-e2e
    resource: ../../packages/bundler/__test__/e2e
  - id: bundler-helpers
    resource: ../../packages/bundler/__test__/e2e/helpers.ts
  - id: pnpmfile-contract
    resource: ../../packages/pnpm-plugin-silk/__test__/e2e/pnpmfile-contract.e2e.test.ts
  - id: regen-catalog
    resource: ../../packages/cli/__test__/e2e/regen-catalog.e2e.test.ts
  - id: leaf-escape-config
    resource: ../../packages/bundler/__test__/e2e/fixtures/leaf-escape/tsdown.config.ts
integrity:
  generated:
    body: e06180cea5dfc918
---

# e2e

`e2e/*` is a top-level `pnpm-workspace.yaml` glob matching PRIVATE,
never-published harness packages that exercise BUILT `dist/dev` artifacts.
Only one remains: `@e2e/silk`, the packed-install proof of the carrier
pattern, which has no single owning package to live in. The former
`@e2e/bundler` and `@e2e/pnpm-plugin-silk` harnesses were folded into their
packages under savvy-web/systems#680 and no longer exist. The `@e2e/*` glob
in `layers.json`'s `unconstrained` set still matches `@e2e/silk`, so its
own dependency edges are not layer-checked; the layering guard itself is a
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
- **One harness package plus three in-package suites.**
  - `@e2e/silk` (`e2e/silk`) runs the kit's `PackedInstall`
    (`@effected/workspaces/testing`): it packs silk's six-package closure
    and installs silk's tarball into one scratch consumer per available
    manager — pnpm, npm, Yarn and bun, a missing one skipped and logged —
    with `allowSharedBins: true`, since cli and mcp deliberately keep
    their own `savvy`/`savvy-mcp` bins. For each consumer it records who
    owns each `.bin` slot (`binProvenance`) and runs what a user types
    (`runBin`, `McpProbe` over `command`). It also runs the carrier's own
    shims (`runCarrierBin`, `McpProbe` over `carrierCommand`) and asserts
    they print the `via @savvy-web/silk` suffix on `savvy --version` and on
    the MCP `serverInfo.version` on every manager. The test's timeouts
    come from `PackedInstall.timeoutBudget`.[^e2e-silk]
  - `packages/bundler/__test__/e2e/` spawns the built `@savvy-web/bundler`
    front door (and its raw-tsdown escape hatch) inside subprocess fixtures
    — `build`, `bundle-node-modules`, `catalog-build` and `escape-hatch`
    suites over the fixtures beside them, including `issue817-probe`, the
    mixin-heritage fixture built prod to pin the declaration-map scrub (see
    [`gotchas/sourceless-declaration-map-segments.md`](../gotchas/sourceless-declaration-map-segments.md)).
    The bundler carries `tsdown` (`catalog:build`) and `tinyrainbow` as
    devDependencies for the raw-tsdown and bundle-node-modules
    fixtures.[^bundler-e2e]
  - `packages/pnpm-plugin-silk/__test__/e2e/pnpmfile-contract.e2e.test.ts`
    imports the built `dist/dev/pkg/index.js` and `pnpmfile.mjs` by
    path.[^pnpmfile-contract]
  - `packages/cli/__test__/e2e/regen-catalog.e2e.test.ts` spawns the built
    `savvy` bin (`../../dist/dev/pkg/bin/savvy.js`, like `bin.e2e.test.ts`)
    against a real `CatalogResolver` from a git-initialised temp dir
    outside the repo, and resolves `@savvy-web/silk/changesets/markdownlint`
    through the root devDependency on silk.[^regen-catalog]
- **In-package suites reach the artifact BY PATH, never by bare
  self-import.** Inside its own package a bare `@savvy-web/<pkg>` import
  self-references the SOURCE manifest's `exports`, not `dist/dev`. The
  bundler's fixtures are the one place that needs a bare specifier — each
  fixture's `savvy.build.ts` is spawned as a real consumer and imports
  `@savvy-web/bundler` — and a package cannot be its own `workspace:*`
  devDependency (turbo rejects `@savvy-web/bundler#build:dev depends on
  itself`). So `helpers.ts`'s `ensureBundlerLink()` creates
  `fixtures/node_modules/@savvy-web/bundler -> ../../dist/dev/pkg` at module
  load: idempotent, gitignored, and exactly the link a `workspace:*`
  dependent would get, so the artifact's own imports resolve through its
  realpath into the bundler's `node_modules`.[^bundler-helpers]
- **A raw-tsdown escape-hatch fixture names its declaration generator.**
  `leaf`/`leaf-escape`'s `tsdown.config.ts` spread `{ generator, tsgo } =
  dtsPassDtsOptions(tsconfig)` from `@savvy-web/tsdown-plugins` into `dts`
  — not `emitDtsOnly`, since the escape hatch emits JS too — so declaration
  emit runs on tsdown-plugins' own TypeScript 7.1 regardless of the
  `typescript` the bundler package itself resolves (the catalog is still on
  the 7.0 line, whose main export has no compiler API). This is the
  documented pattern for an escape-hatch consumer; see
  [`decisions/typescript-7-1-dts-api.md`](../decisions/typescript-7-1-dts-api.md).[^leaf-escape-config]
- **Every e2e test runs in the normal `pnpm test` gate** via
  `AgentPlugin.discover()` — no separate project definition, no separate
  CI job. The root `vitest.config.ts` gives the `@e2e/*` project
  `fileParallelism: false` and excludes `**/dist/**` from coverage;
  subprocess builds write into shared fixture `dist/` directories.
- **Fixtures are test data, never workspace members.** They live under
  `packages/<pkg>/__test__/e2e/fixtures/<name>/`; each fixture that
  triggers resolution owns its own `pnpm-workspace.yaml`; no `packages:`
  glob matches a fixture, and the shared Biome config excludes
  `__test__/**/fixtures`. The bundler fixtures' build outputs
  (`dist`, `models`, `tsdoc.json`, `next-versions.json`) and the
  `fixtures/node_modules/` link dir are gitignored.
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
- [`modules/cli.md`](cli.md)
- [`modules/pnpm-plugin-silk.md`](pnpm-plugin-silk.md)
- [`modules/silk.md`](silk.md)

[^e2e-silk]: `e2e/silk/__test__/e2e`
[^bundler-e2e]: `packages/bundler/__test__/e2e`
[^bundler-helpers]: `packages/bundler/__test__/e2e/helpers.ts`
[^pnpmfile-contract]: `packages/pnpm-plugin-silk/__test__/e2e/pnpmfile-contract.e2e.test.ts`
[^regen-catalog]: `packages/cli/__test__/e2e/regen-catalog.e2e.test.ts`
[^leaf-escape-config]: `packages/bundler/__test__/e2e/fixtures/leaf-escape/tsdown.config.ts`
