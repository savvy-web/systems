---
id: packages/silk/install-and-setup
title: Installing @savvy-web/silk
summary: Load when installing the Silk dev-tooling system into a consumer repo.
tier: packages
source: hand
tags: [silk, init]
priority: 0.5
related: [packages/silk/export-map, packages/cli/init-and-check]
---

## What

`@savvy-web/silk` is the single package a consumer installs to get the whole Silk
Suite dev-tooling system. It is an install surface, not a library: each subpath
export is a thin config-integration **shim** that re-exports `@savvy-web/silk-effects`
logic shaped into the exact module form an external tool's config loader expects.
The shims carry no logic. It is a `fixed` changeset group with `@savvy-web/cli`.

## API

A shim is a drop-in replacement: a config file that imported a subpath of one of
the three old packages (`@savvy-web/changesets`, `@savvy-web/commitlint`,
`@savvy-web/lint-staged`) works unchanged after swapping the import to the matching
`@savvy-web/silk` subpath. Each shim reproduces the **module shape** the loader
consumes — default vs named, array vs object — not just the symbols. The full
subpath map is at `silk://packages/silk/export-map`.

## Layer

silk's only dependency is `@savvy-web/silk-effects` (`workspace:*`). Its
`peerDependencies` declare `@savvy-web/cli` (install-wiring) plus the merged
real-tool peers (`@biomejs/biome` optional, `husky`, `@commitlint/*`, `commitizen`,
`@changesets/cli`, `lint-staged`, `markdownlint-cli2`) via `catalog:silkPeers`.
silk ships dual-format (esm + cjs) because some consumers `require()` its subpaths
from CommonJS — notably markdownlint-cli2's custom-rule loader, which loads
`./changesets/markdownlint` through a CJS path; silk-effects therefore also exposes
a CJS entry. Dual-format is mandatory, not cosmetic.

## Usage

The consumer model:

```text
install @savvy-web/silk
  → autoInstallPeers pulls cli (the savvy bin) + biome/husky/@commitlint/
    @changesets/lint-staged/markdownlint
  → savvy init seeds configs that reference @savvy-web/silk/* and wires husky
    hooks to savvy subcommands
  → at runtime both silk (via shims) and cli (via handlers) resolve their logic
    from silk-effects
```

The Biome preset is referenced as `extends: "@savvy-web/silk/biome"`.

## Related

The export map: `silk://packages/silk/export-map`. The `init` step that follows
install: `silk://packages/cli/init-and-check`.
