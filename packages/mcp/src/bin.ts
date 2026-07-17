#!/usr/bin/env node
/**
 * Binary entrypoint for the `savvy-mcp` server.
 *
 * Resolves the project working directory, builds the long-lived runtime
 * (root-bound to that directory), and starts the MCP server over stdio.
 *
 * @internal
 */
/* v8 ignore start -- process bootstrap; covered by server.smoke.test.ts */
import { NodeServices } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";

import type { McpContext } from "./context.js";
import { makeSilkRuntimeLayer } from "./runtime.js";
import { startMcpServer } from "./server.js";

function resolveProjectDir(): string {
	const argv = process.argv[2];
	const fromArgv =
		argv !== undefined && argv.trim().length > 0 && !(argv.startsWith("${") && argv.endsWith("}"))
			? argv.trim()
			: undefined;
	return fromArgv ?? process.env.SAVVY_MCP_PROJECT_DIR ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

async function main(): Promise<void> {
	const cwd = resolveProjectDir();
	const appLayer = makeSilkRuntimeLayer(cwd).pipe(Layer.provide(NodeServices.layer));
	const runtime = ManagedRuntime.make(appLayer);
	const ctx: McpContext = { runtime, cwd };

	process.stderr.write(`[savvy-mcp] starting in ${cwd}\n`);
	await startMcpServer(ctx);
}

main().catch((err) => {
	process.stderr.write(`savvy-mcp: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
	process.exit(1);
});
/* v8 ignore stop */
