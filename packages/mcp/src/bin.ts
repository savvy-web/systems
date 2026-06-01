#!/usr/bin/env node
/**
 * Binary entrypoint for the `savvy-mcp` server.
 *
 * Resolves the project working directory, builds the long-lived runtime, and
 * starts the MCP server over stdio.
 *
 * @internal
 */
/* v8 ignore start -- process bootstrap; covered by server.smoke.test.ts */
import { NodeContext } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";

import type { McpContext } from "./context.js";
import { DocIndex } from "./resources/doc-index.js";
import { loadManifest, readDocBody, resolveContentRoot } from "./resources/load.js";
import { SilkRuntimeLive } from "./runtime.js";
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
	const appLayer = SilkRuntimeLive.pipe(Layer.provide(NodeContext.layer));
	const runtime = ManagedRuntime.make(appLayer);
	const contentRoot = resolveContentRoot();
	const manifest = loadManifest(contentRoot);
	// Preload every body for the search index. Fuse indexes body at a low weight
	// (0.03) so a term appearing only in a doc body still surfaces the doc, while
	// title/tags/summary dominate ranking. Resource reads still stream fresh from
	// disk per request (stateless readers). A read failure here fails boot loudly.
	const bodies = Object.fromEntries(
		manifest.entries.map((e) => [e.uri, readDocBody(contentRoot, e.uri.replace(/^silk:\/\//, ""))]),
	);
	const docIndex = DocIndex.fromManifest(manifest, bodies);
	const ctx: McpContext = { runtime, cwd, docIndex, manifest, contentRoot };

	process.stderr.write(`[savvy-mcp] starting in ${cwd}\n`);
	await startMcpServer(ctx);
}

main().catch((err) => {
	process.stderr.write(`savvy-mcp: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
	process.exit(1);
});
/* v8 ignore stop */
