---
"@savvy-web/mcp": minor
---

## Features

Added two tools backed by `Changesets.DepsRegen`, bringing the server to eight tools: `changeset_deps_detect` (read-only — the cumulative dependency diff with `catalog:`/`workspace:` specifiers resolved to concrete versions) and `changeset_deps_regen` (regenerates pure-dependency changesets; the second mutating tool after `biome_check`, and a no-op preview under `dryRun`).
