/**
 * Owns the `savvy-mcp` process: crash guards, project-root resolution, and the
 * server layer launched over stdio.
 *
 * @remarks
 * The crash guards are `@effected/mcp/guard`'s `McpGuard.run`, whose entry
 * point has no static runtime import: it registers the `uncaughtException`
 * and `unhandledRejection` listeners, then awaits `load`, which imports the
 * whole server graph (`effect` included) dynamically. An error while any of it
 * evaluates is therefore reported on stderr by the guard, and a rejected
 * `load` is reported as `startup failed` with exit 1. The two static imports
 * here are the guard and an erased type.
 *
 * The process boundary itself is `@effected/mcp`'s: `McpGuard.run` launches
 * the loaded layer with `McpStdio.launch`, which reports a launch failure on
 * stderr (never onto the JSON-RPC wire), and `McpStdio.teardown`, which maps
 * stdin EOF — a clean disconnect — to exit 0.
 *
 * @packageDocumentation
 */
/* v8 ignore start -- process bootstrap; covered by the server-lifecycle e2e and the silk bins e2e */
import type { Distribution } from "@effected/engine";
import { McpGuard } from "@effected/mcp/guard";

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

/**
 * Run the savvy MCP server over stdio. Owns the process.
 *
 * @remarks
 * The project directory is the first positional argument, then
 * `SAVVY_MCP_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`, then the working
 * directory — an empty value or an unsubstituted `${VAR}` placeholder is
 * skipped (`LaunchContext.projectDir`). NO static imports of the server
 * graph — see the module remarks. The guard policy is the kit's default:
 * a stray exception or rejection exits 1, before or after connecting.
 *
 * @public
 */
export const main = (options: MainOptions = {}): Promise<void> =>
	McpGuard.run({
		label: "savvy-mcp",
		host: process,
		load: async () => {
			const { NodeRuntime, NodeServices } = await import("@effect/platform-node");
			const { Layer } = await import("effect");
			const { LaunchContext } = await import("@effected/engine");
			const { ServerLayer } = await import("./server.js");
			const cwd = LaunchContext.projectDir({
				// The single positional only: every non-empty candidate counts, so a
				// wider slice would let a stray flag become the project directory.
				argv: process.argv.slice(2, 3),
				env: process.env,
				keys: ["SAVVY_MCP_PROJECT_DIR", "CLAUDE_PROJECT_DIR"],
				cwd: process.cwd(),
			});
			return {
				layer: ServerLayer(cwd, options).pipe(Layer.provide(NodeServices.layer)),
				runMain: NodeRuntime.runMain,
			};
		},
	});
/* v8 ignore stop */
