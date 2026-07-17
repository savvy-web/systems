/**
 * Public barrel for `@savvy-web/mcp`.
 *
 * @packageDocumentation
 */

export type { McpContext, McpServices } from "./context.js";
export { makeSilkRuntimeLayer } from "./runtime.js";
export { startMcpServer } from "./server.js";
export { CURRENT_MCP_VERSION } from "./version.js";
