/**
 * Owns the `savvy-mcp` process: crash guards, project-root resolution, and the
 * server layer launched over stdio.
 *
 * @remarks
 * No static imports of the server graph — every module reachable from the
 * MCP tool surface is imported dynamically, after the crash guards are
 * registered, so an error during that import (or anything downstream) is
 * caught by `uncaughtException`/`unhandledRejection` rather than crashing
 * before a handler exists. The one static import is type-only and erased.
 *
 * The process boundary itself is `@effected/mcp`'s: `McpStdio.launch` reports
 * a launch failure on stderr (never onto the JSON-RPC wire) and
 * `McpStdio.teardown` maps stdin EOF — a clean disconnect — to exit 0.
 *
 * @packageDocumentation
 */
/* v8 ignore start -- process bootstrap; covered by the server-lifecycle e2e and the silk bins e2e */
import type { Distribution } from "@effected/engine";

/**
 * Options for {@link main}.
 *
 * @public
 */
export interface MainOptions {
	/**
	 * The carrier this bin was installed through, for example
	 * `{ name: "@savvy-web/silk", version }`; rendered into the server's
	 * reported version. Absent for a direct install.
	 */
	readonly distribution?: Distribution | undefined;
}

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
 * The project directory is the first positional argument, then
 * `SAVVY_MCP_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`, then the working
 * directory — an empty value or an unsubstituted `${VAR}` placeholder is
 * skipped (`LaunchContext.projectDir`). NO static imports of the server
 * graph — see the module remarks.
 *
 * @public
 */
export const main = async (options: MainOptions = {}): Promise<void> => {
	process.on("uncaughtException", (e) => fatal("uncaught exception", e));
	process.on("unhandledRejection", (r) => fatal("unhandled rejection", r));
	const { NodeRuntime, NodeServices } = await import("@effect/platform-node");
	const { Layer } = await import("effect");
	const { LaunchContext } = await import("@effected/engine");
	const { McpStdio } = await import("@effected/mcp");
	const { ServerLayer } = await import("./server.js");
	const cwd = LaunchContext.projectDir({
		// The single positional only: every non-empty candidate counts, so a
		// wider slice would let a stray flag become the project directory.
		argv: process.argv.slice(2, 3),
		env: process.env,
		keys: ["SAVVY_MCP_PROJECT_DIR", "CLAUDE_PROJECT_DIR"],
		cwd: process.cwd(),
	});

	NodeRuntime.runMain(McpStdio.launch(ServerLayer(cwd, options).pipe(Layer.provide(NodeServices.layer))), {
		teardown: McpStdio.teardown,
	});
};
/* v8 ignore stop */
