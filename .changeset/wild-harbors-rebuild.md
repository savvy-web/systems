---
"@savvy-web/mcp": major
---

## Breaking Changes

### Rebuilt on the Effect-native `McpServer`

The `savvy-mcp` server is now an `effect/unstable/ai` `McpServer` served over stdio as a single Layer. `@modelcontextprotocol/sdk` and `zod` are gone from the dependency graph, and the `inspect` script and `@modelcontextprotocol/inspector` dev dependency are removed.

The public barrel changed shape:

* **Removed:** `startMcpServer`, the `McpContext` type
* **Added:** `SilkToolkit` and the `SilkTools` type (the ten tools as an `effect/unstable/ai` `Toolkit`), `ToolsLayer(cwd)` (the tool handlers), `ServerLayer(cwd)` (the complete server over stdio, requiring `PlatformServices`), `SilkMarkdown`, and the typed failure surface — `McpToolError`, `WorkspaceNotFound`, `InvalidArgument`, `EngineError`, `BiomeUnavailable`, `BiomeFailed`, `Remediation`, `composeRemediatedMessage`, `truncateEchoed`
* **Kept:** `makeSilkRuntimeLayer`, the `McpServices` type, `CURRENT_MCP_VERSION`

```ts
import { ServerLayer } from "@savvy-web/mcp";
import { Layer } from "effect";
import { NodeServices } from "@effect/platform-node";

const server = ServerLayer("/path/to/project").pipe(Layer.provide(NodeServices.layer));
```

### Process entry moves to `@savvy-web/mcp/main`

The process-owning bootstrap — crash guards, project-root resolution, and `Layer.launch` of the server — is exported as `main(): Promise<void>` from the new `./main` subpath; the barrel stays importable without side effects. The `savvy-mcp` bin is unchanged for end users and is now also shipped by `@savvy-web/silk` as a shim over this entry. The `./package.json` subpath is now exported.

## Features

* Every tool carries MCP annotations (title, read-only, destructive, idempotent, open-world), so a client can tell the inspection tools from the mutating `changeset_deps_regen`, `repos_manage` and `biome_check` write mode before calling them
* Tool failures are typed and self-contained: each carries a remediation so a client gets an actionable message without consulting the server log
* Project root resolves from argv, then `SAVVY_MCP_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`, then the cwd

## Bug Fixes

* Log output goes to stderr, never onto the JSON-RPC stdout wire
* A clean stdin close (the host disconnecting) exits `0` instead of `130`
