/**
 * Public barrel for `@savvy-web/mcp`.
 *
 * @remarks
 * `main` is deliberately NOT exported here — it owns the process and lives at
 * the `./main` subpath so importing this barrel never registers crash guards.
 *
 * @packageDocumentation
 */

export {
	BiomeFailed,
	BiomeUnavailable,
	EngineError,
	InvalidArgument,
	McpToolError,
	WorkspaceNotFound,
} from "./errors.js";
export type { McpServices } from "./runtime.js";
export { makeSilkRuntimeLayer } from "./runtime.js";
export type { PlatformServices, ServerOptions } from "./server.js";
export { ServerLayer } from "./server.js";
export type { SilkTools } from "./toolkit.js";
export { SilkToolkit, ToolsLayer } from "./toolkit.js";
export { CURRENT_MCP_VERSION } from "./version.js";
