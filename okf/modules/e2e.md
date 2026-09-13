---
type: Module
title: "e2e"
description: The private, never-published harness area exercising the repo's build and release tooling through the BUILT dist/dev artifact, against isolated fixtures outside the workspace.
kind: workspace
resource: ../../e2e
tags: [testing]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: ce872011619cd2e6344072fd009b5666dd0052c982b2217507778a8acd79c5ac
sources:
  - id: e2e-bundler
    resource: ../../e2e/bundler/__test__/e2e
  - id: e2e-pnpm-plugin-silk
    resource: ../../e2e/pnpm-plugin-silk/__test__/e2e
  - id: e2e-silk
    resource: ../../e2e/silk/__test__/e2e
  - id: e2e-workspace
    resource: ../../e2e/workspace/__test__/e2e
---

# e2e

`e2e/*` is a top-level `pnpm-workspace.yaml` glob matching four harness
packages — `@e2e/bundler`, `@e2e/pnpm-plugin-silk`, `@e2e/silk` and
`@e2e/workspace` — each `private: true`, forming the harness band in the
package layering (which may depend on anything). Each package under test is
declared as a `workspace:*` devDependency, so on install the harness links
the real built `dist/dev` artifact and consumes it exactly as a downstream
repo would: through the published entry points, never the source tree.
`@e2e/workspace` is the one exception — it reads manifests off disk and
depends on no app package.

## Boundary

- **Its reason to exist is `catalog:`/`workspace:` specifier resolution.**
  Resolution roots at `process.cwd()`, so the only faithful and hermetic
  way to test it is to run the real built tool as a child process with
  `cwd` set to a fixture that owns its own `pnpm-workspace.yaml`. The
  resolver's root-walk stops at that file rather than climbing to the
  monorepo root — this is the load-bearing isolation guarantee, detailed in
  [`conventions/e2e-isolation.md`](../conventions/e2e-isolation.md).
- **Four coverage tiers.** `@e2e/bundler` spawns the built
  `@savvy-web/bundler` front door (and its raw-tsdown escape hatch) inside
  subprocess fixtures.[^e2e-bundler] `@e2e/pnpm-plugin-silk` imports the
  built `pnpmfile.mjs` and, separately, spawns the built `savvy` binary
  against a real `CatalogResolver` from a git-initialised temp dir outside
  the repo.[^e2e-pnpm-plugin-silk] `@e2e/silk` packs the six app packages
  and installs silk's tarball into scratch projects under both pnpm and
  npm, proving the carrier bins from a packed install outside the
  workspace.[^e2e-silk] `@e2e/workspace` walks the live `workspace:*`
  dependency graph off disk and checks it against `layers.json` — see
  [`interfaces/layers-json.md`](../interfaces/layers-json.md).[^e2e-workspace]
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
- **`@e2e/silk` packs from the source package dir with
  `--config.ignore-scripts=true`**, never from `dist/dev/pkg` (packing from
  inside `dist/dev/pkg` fails with `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`
  because the dir is not a workspace member), and asserts the absence of
  any `.npmrc`, hoist pattern or config dependency in the scratch project —
  the absence is itself the assertion.

## Related

- [`conventions/e2e-isolation.md`](../conventions/e2e-isolation.md)
- [`interfaces/layers-json.md`](../interfaces/layers-json.md)
- [`modules/bundler.md`](bundler.md)
- [`modules/tsdown-plugins.md`](tsdown-plugins.md)
- [`modules/silk.md`](silk.md)

[^e2e-bundler]: `e2e/bundler/__test__/e2e`
[^e2e-pnpm-plugin-silk]: `e2e/pnpm-plugin-silk/__test__/e2e`
[^e2e-silk]: `e2e/silk/__test__/e2e`
[^e2e-workspace]: `e2e/workspace/__test__/e2e`
