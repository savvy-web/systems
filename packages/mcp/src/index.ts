/**
 * Public barrel for `@savvy-web/mcp`.
 *
 * @packageDocumentation
 */

/**
 * The package version, replaced at build time. `0.0.0` in dev/test indicates
 * an unbuilt source run.
 */
export const CURRENT_MCP_VERSION = "0.0.0";

export type { McpContext } from "./context.js";
export { SilkRuntimeLive } from "./runtime.js";
export { startMcpServer } from "./server.js";
