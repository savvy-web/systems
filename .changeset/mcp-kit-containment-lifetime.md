---
"@savvy-web/mcp": patch
---

## Bug Fixes

`biome_check` now refuses a path that doesn't exist yet when its parent is a symlink pointing outside the workspace. The containment check moved to `PathContainment.isWithin` from `@effected/kit`, which resolves links through the nearest existing ancestor; a new file under such a link used to pass because only its spelling was compared.

## Refactoring

The tool handlers now receive their services through `McpToolkit.provideLifetime`, so each request gets what the runtime layer outputs and no build-time context. The runtime is still built once per server.
