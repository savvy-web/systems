/**
 * Constructs the MCP server, registers tools and resources, and connects the
 * stdio transport.
 *
 * @packageDocumentation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Schema } from "effect";
import { z } from "zod";

import type { McpContext } from "./context.js";
import { registerAllResources } from "./resources/index.js";
import { effectToZodSchema } from "./schema/effect-to-zod.js";
import { WorkspaceInfoAsMarkdown, WorkspaceInfoResult, workspaceInfo } from "./tools/workspace-info.js";
import { CURRENT_MCP_VERSION } from "./version.js";

/** Wrap a markdown string + structured object in the dual-channel tool result. */
const structuredResult = <T extends object>(text: string, structured: T) => ({
	content: [{ type: "text" as const, text }],
	structuredContent: structured as unknown as Record<string, unknown>,
});

/** Build the MCP server for the given context, registering tools + resources. */
export function buildServer(ctx: McpContext): McpServer {
	const server = new McpServer({ name: "savvy-mcp", version: CURRENT_MCP_VERSION });

	server.registerTool(
		"workspace_info",
		{
			description:
				"Use when you need the Silk workspace layout: runtime, package manager, and a per-workspace summary (publishability, versioning, tag/release state). Prefer this over running shell commands to inspect the workspace. Returns markdown in content[] and a typed object in structuredContent.",
			inputSchema: {
				cwd: z.optional(z.string()).describe("Workspace root to analyze. Defaults to the server's project dir."),
			},
			outputSchema: effectToZodSchema(WorkspaceInfoResult) as never,
		},
		async (args) => {
			const root = args.cwd ?? ctx.cwd;
			const data = await ctx.runtime.runPromise(workspaceInfo(root));
			const text = Schema.decodeSync(WorkspaceInfoAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	registerAllResources(server);

	return server;
}

/** Build the server and connect it over stdio. */
export async function startMcpServer(ctx: McpContext): Promise<void> {
	const server = buildServer(ctx);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
