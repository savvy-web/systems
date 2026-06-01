---
id: standards/dependency-conventions
title: Dependency conventions
summary: When to use catalog:silk vs catalog:silkPeers, and how the pnpm-plugin-silk config dependency pins versions.
tier: standards
source: hand
tags: [dependencies, catalog]
priority: 0.5
related: [standards/catalog-usage]
---

## Rule

All Silk Suite packages pin dependencies through the named catalogs provided by
`@savvy-web/pnpm-plugin-silk`:

- Use `catalog:silk` for `dependencies` and `devDependencies` (current pinned versions).
- Use `catalog:silkPeers` for `peerDependencies` (permissive ranges).

Do not hard-code version strings for catalog-managed packages.

### How the plugin works

`@savvy-web/pnpm-plugin-silk` is installed as a pnpm config dependency:

```yaml
configDependencies:
  "@savvy-web/pnpm-plugin-silk": "0.3.0+sha512-..."
```

During `pnpm install` the plugin merges its catalog definitions, security overrides,
and build configuration into the consuming repo's `pnpm-workspace.yaml`. The merge
is non-destructive — local definitions always take precedence, and divergences are
printed as warnings.

The plugin ships:

- `catalog:silk` — current/latest pinned versions for direct use
- `catalog:silkPeers` — permissive ranges for peer declarations
- `silkOverrides` — centralized CVE fixes propagated to all consumers
- Shared `onlyBuiltDependencies`, `publicHoistPattern`, and `peerDependencyRules`

### Effect ecosystem note

The 26 `@effect/*` packages are updated together as one batch to preserve
cross-package compatibility. For `@effect/*` packages (all at `0.x`),
`catalog:silkPeers` uses `>=` floor-only ranges rather than `^` caret ranges,
because `^0.x.y` restricts to patch-only and would not overlap with the `silk`
pinned version one minor ahead. For `effect` itself (at `3.x`) the standard `^`
caret works.

## Why

Centralizing versions in the plugin keeps every repo in the ecosystem on one
coordinated set and lets security overrides for transitive CVEs land without
per-repo edits. The dual-catalog strategy balances two needs: direct consumers get a
predictable pinned version; peer consumers stay compatible with a wider range of
host environments without forcing lockstep upgrades.

## Examples

```json
{
  "devDependencies": {
    "typescript": "catalog:silk",
    "vitest": "catalog:silk"
  },
  "peerDependencies": {
    "typescript": "catalog:silkPeers"
  }
}
```

To override a catalog entry for a single repo, add it under `catalogs.silk` in
`pnpm-workspace.yaml`; the local value wins and the plugin prints a warning. Remove
the local entry to revert to the Silk default.

## See also

Detailed catalog usage rules (including when to add a local override) are at
`silk://standards/catalog-usage`. Publishability and registry targets that determine
which packages enter the release pipeline are at `silk://standards/publishability`.
