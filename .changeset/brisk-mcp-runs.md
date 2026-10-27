---
"@savvy-web/mcp": patch
---

## Bug Fixes

* `biome_check` no longer blocks the server while Biome runs (it previously ran synchronously for up to 120 seconds per call). Concurrent `write` passes are serialized per server, while read-only checks still run concurrently. The result shape is unchanged.
* Worktree containment checks now use git's own tree identity.
