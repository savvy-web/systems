/**
 * Owns the `savvy-mcp` process: crash guards, project-root resolution, runtime
 * assembly, and the stdio server.
 *
 * @remarks
 * No static imports of the server graph — every module reachable from the
 * MCP tool surface is imported dynamically, after the crash guards are
 * registered, so an error during that import (or anything downstream) is
 * caught by `uncaughtException`/`unhandledRejection` rather than crashing
 * before a handler exists.
 *
 * @packageDocumentation
 */
/* v8 ignore start -- process bootstrap; covered by the bins e2e */

const fatal = (label: string, error: unknown): never => {
	process.stderr.write(
		`savvy-mcp: ${label}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
	);
	process.exit(1);
};

/**
 * Run the savvy MCP server over stdio. Owns the process.
 *
 * @remarks
 * NO static imports of the server graph — see the module remarks.
 *
 * @public
 */
export const main = async (): Promise<void> => {
	process.on("uncaughtException", (e) => fatal("uncaught exception", e));
	process.on("unhandledRejection", (r) => fatal("unhandled rejection", r));
	const { NodeServices } = await import("@effect/platform-node");
	const { Layer, ManagedRuntime } = await import("effect");
	const { makeSilkRuntimeLayer } = await import("./runtime.js");
	const { startMcpServer } = await import("./server.js");
	const { resolveProjectDir } = await import("./internal/project-root.js");
	const cwd = resolveProjectDir(process.argv.slice(2), process.env, () => process.cwd());
	const runtime = ManagedRuntime.make(makeSilkRuntimeLayer(cwd).pipe(Layer.provide(NodeServices.layer)));
	await startMcpServer({ runtime, cwd });
};
/* v8 ignore stop */
