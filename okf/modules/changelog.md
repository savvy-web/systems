---
type: Module
title: "@savvy-web/changelog"
description: The standalone changesets changelog generator; a one-file host adapter over silk-effects' Changesets.makeChangelogFunctions, and the canonical .changeset/config.json changelog id.
kind: package
resource: ../../packages/changelog
tags: [release]
generated:
  by: okfit/claude-code
  at: 2026-09-18T02:06:56Z
  body_sha256: d76dc9dcf64ac6bf6bbfc42de31bae2872ca4b22b6de397449631c7b65cf7b1b
sources:
  - id: changelog-index
    resource: ../../packages/changelog/src/index.ts
  - id: changelog-build
    resource: ../../packages/changelog/savvy.build.ts
  - id: changelog-manifest
    resource: ../../packages/changelog/package.json
---

# @savvy-web/changelog

`@savvy-web/changelog` gives the silk changelog formatter an **installable
identity**. A `.changeset/config.json` `changelog` entry is a module id the
vanilla changesets CLI resolves from the consumer's workspace and loads with
`await import(changelogPath)` (`@changesets/apply-release-plan`), so the id
must be a real, resolvable installed package — a subpath of `@savvy-web/silk`
is only resolvable where silk itself is installed and hoisted, and cannot
serve as a bundleable changelog module for `silk-release-action`, which runs
without a consumer `node_modules`.

## Boundary

- **No business logic.** The entire package is
  `Changesets.makeChangelogFunctions({ logMode })`, default-exported and
  annotated with the `@changesets/types` `ChangelogFunctions` type.[^changelog-index]
  Every changelog behavior (release lines, dependency tables, GitHub
  attribution) lives in `silk-effects`' `Changesets` namespace; changing
  changelog behavior never touches this package.
- **It is the one place `process.env` is read for changelog logging mode**
  — `VITEST` → `"silent"`, `GITHUB_ACTIONS=true` → `"github"`
  (`::warning::` annotations), otherwise `"stderr"`.[^changelog-index] This
  package is the host adapter for the changesets CLI, a foreign process
  that supplies no context, so the environment read belongs here rather
  than in the engine.
- **Build posture: ESM-only, nothing inlined.** `savvy.build.ts` is a
  bare `build({ meta: false })` — no CJS twin, no `bundleNodeModules`, no
  resolver plugins — because `@changesets/cli` v3 is `"type": "module"`
  and `import()`s the changelog module, so no `require` condition is
  needed.[^changelog-build] `@savvy-web/silk-effects`, `effect` and the
  `@effected/{commands,git,workspaces}` kit packages are declared runtime
  `dependencies`, externalized by the build, and resolved by the consumer
  at import time; `jju` and `semver` sit beside them for the same
  reason.[^changelog-manifest]
- **The default export's shape is the contract**, not its type: the
  `@changesets/types` `ChangelogFunctions` object the changesets CLI loads,
  annotated with that nominal type on purpose so the dts bundler never
  materializes the whole `silk-effects` + `effect` type graph for a
  two-function surface. Drift is caught by a shape-and-behaviour test.

## Distribution

Three coordination points make the id resolvable in a consumer workspace
without a manual install: silk declares it as an exact-pinned `dependency`
— a pure carrier edge, since nothing under silk's `src/` imports it (see
[`modules/silk.md`](silk.md) and
[`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md)),
`@savvy-web/pnpm-plugin-silk` public-hoists it as the one `@savvy-web/*`
package still on that list, and `savvy changeset init` writes
`@savvy-web/changelog` as the canonical `.changeset/config.json` id.

Inside this repository the wiring is different on purpose: the plugin's
`excludeByRepo` drops the hoist for `savvy-web-systems`, and the hub's root
`package.json` carries `@savvy-web/changelog` as a `workspace:*`
devDependency instead, so the changesets engine resolves the built
`dist/dev/pkg` link from the repo root. The hoist must stay excluded here —
hoisting a workspace package symlinks its source directory, not its built
artifact; see
[`gotchas/hoisted-workspace-package-resolves-source.md`](../gotchas/hoisted-workspace-package-resolves-source.md)
and [`conventions/workspace-prepare-scripts.md`](../conventions/workspace-prepare-scripts.md).

## Related

- [`modules/silk.md`](silk.md)
- [`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md)
- [`modules/pnpm-plugin-silk.md`](pnpm-plugin-silk.md)
- [`gotchas/hoisted-workspace-package-resolves-source.md`](../gotchas/hoisted-workspace-package-resolves-source.md)

[^changelog-index]: `src/index.ts`
[^changelog-build]: `savvy.build.ts`
[^changelog-manifest]: `package.json`
