---
"@savvy-web/mcp": minor
---

## Features

* `repos_manage`'s parameters are now a strict `oneOf` keyed by `action`: passing a key the chosen action doesn't take, or omitting one it requires, is rejected as invalid parameters before the handler runs — an `isError` result naming the bad key on protocol `2025-11-25`/`2026-07-28`, and a JSON-RPC `-32602` on `2025-06-18`.
* All ten tools now serve an `outputSchema`.
* Removed the `InvalidArgument`/`invalidArgument` and `BiomeUnavailable` exports; a bad argument or a missing Biome binary is now reported as the kit's `ToolRefusal` (from `@effected/mcp`) instead. `McpToolError` is now `WorkspaceNotFound | EngineError | BiomeFailed | ToolRefusal`.

## Bug Fixes

* Crash guards now run through the kit's `McpGuard.run`, with stderr text in the kit's format.
* Fixed `ERR_MODULE_NOT_FOUND 'redis'` on Yarn 1 installs by importing `NodeRuntime`/`NodeServices` from `@effect/platform-node`'s subpaths instead of the package root.
* An engine failure now carries the detail its error keeps in `cause`, so `changeset_deps_detect`/`changeset_deps_regen` name the config dependency that is not installed instead of only "Failed to assemble catalogs from hooks". Their hint now points at a base-side config dependency missing from the pnpm store.
