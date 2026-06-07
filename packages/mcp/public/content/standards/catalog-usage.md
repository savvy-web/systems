---
id: standards/catalog-usage
title: Catalog usage
summary: Load when adding or pinning a dependency in a Silk Suite package.
tier: standards
source: hand
tags: [catalog, dependencies]
priority: 0.8
related: [standards/publishability]
---

## Rule

Pin dependencies through the named catalogs that `@savvy-web/pnpm-plugin-silk`
merges into `pnpm-workspace.yaml` during `pnpm install`. Use `catalog:silk` for
direct `dependencies` and `devDependencies`; use `catalog:silkPeers` for
`peerDependencies`. Do not hard-code version strings for catalog-managed packages.

## Why

`catalog:silk` carries current/latest pinned versions; `catalog:silkPeers` carries
wider permissive ranges so a consuming package does not force its users to upgrade
in lockstep. Centralizing versions in the plugin keeps every repo in the ecosystem
on one coordinated set, and lets security overrides for transitive CVEs land
without per-repo edits.

The 26 Effect ecosystem packages are updated together as one batch to preserve
cross-package compatibility. For `@effect/*` packages (all at `0.x`), `silkPeers`
uses `>=` floor-only ranges rather than `^` caret ranges, because `^0.x.y`
restricts to patch-only and would not overlap with the `silk` pinned version one
minor ahead. For `effect` itself (at `3.x`) the standard `^` caret works.

## Examples

```json
{
  "devDependencies": { "typescript": "catalog:silk", "vitest": "catalog:silk" },
  "peerDependencies": { "typescript": "catalog:silkPeers" }
}
```

To override a catalog entry locally, add it under `catalogs.silk` in
`pnpm-workspace.yaml`; the local value wins and the plugin prints a warning so the
divergence is visible. Remove the local entry to revert to the Silk default.

## See also

Publishability and registry targets are at `silk://standards/publishability`.
