---
type: Module
title: "@savvy-web/changelog"
description: The standalone changesets changelog generator; a one-file host adapter over silk-effects' Changesets.makeChangelogFunctions, and the canonical .changeset/config.json changelog id.
kind: package
resource: ../../packages/changelog
tags: [release]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 0fe483e559a47d424ccad53c2000a0c7f404c8f1708518b92d79fa9e273fb879
sources:
  - id: changelog-index
    resource: ../../packages/changelog/src/index.ts
  - id: changelog-build
    resource: ../../packages/changelog/savvy.build.ts
---

# @savvy-web/changelog

`@savvy-web/changelog` gives the silk changelog formatter an **installable
identity**. A `.changeset/config.json` `changelog` entry is a module id the
vanilla changesets CLI resolves with `resolve-from` + `require()` from the
consumer's workspace, so the id must be a real, resolvable installed package
with a `require` condition — a subpath of `@savvy-web/silk` is only
resolvable where silk itself is installed and hoisted, and cannot serve as a
bundleable changelog module for `silk-release-action`, which runs without a
consumer `node_modules`.

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
- **Build posture:** dual esm+cjs, self-contained, because the changesets
  CLI `require()`s the formatter and CJS cannot `require()` ESM-only
  `silk-effects` — the CJS artifact inlines `silk-effects` and its
  transitive tree via `bundleNodeModules: true`.[^changelog-build]
  `silk-effects` is a devDependency here (bundled, never a published dep).
- **The default export's shape is the contract**, not its type: the
  `@changesets/types` `ChangelogFunctions` object the changesets CLI loads,
  annotated with that nominal type on purpose so the dts bundler never
  materializes the whole `silk-effects` + `effect` type graph for a
  two-function surface. Drift is caught by a shape-and-behaviour test.

## Distribution

Three coordination points make the id resolvable in a consumer workspace
without a manual install: silk declares it as an exact-pinned `dependency`
(see [`modules/silk.md`](silk.md) and
[`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md)),
`@savvy-web/pnpm-plugin-silk` public-hoists it as the one `@savvy-web/*`
package still on that list, and `savvy changeset init` writes
`@savvy-web/changelog` as the canonical `.changeset/config.json` id.

## Related

- [`modules/silk.md`](silk.md)
- [`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md)

[^changelog-index]: `src/index.ts`
[^changelog-build]: `savvy.build.ts`
