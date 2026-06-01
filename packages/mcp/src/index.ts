/**
 * Public barrel for `@savvy-web/mcp`.
 *
 * @packageDocumentation
 */

export type { McpContext } from "./context.js";
export type { DocIndex, SearchOptions, SearchResult } from "./resources/doc-index.js";
export type { Manifest, ManifestEntry } from "./resources/schema.js";
export { SilkRuntimeLive } from "./runtime.js";
export { startMcpServer } from "./server.js";
export { CURRENT_MCP_VERSION } from "./version.js";
