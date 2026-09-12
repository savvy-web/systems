/**
 * Owns the `savvy-mcp` process: crash guards, project-root resolution, and the
 * server layer launched over stdio.
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
/* v8 ignore start -- process bootstrap; covered by the server-lifecycle e2e and the silk bins e2e */

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
	const { NodeRuntime, NodeServices } = await import("@effect/platform-node");
	const { Cause, Exit, Layer, Logger, Runtime } = await import("effect");
	const { resolveProjectDir } = await import("./internal/project-root.js");
	const { ServerLayer } = await import("./server.js");
	const cwd = resolveProjectDir(process.argv.slice(2), process.env, () => process.cwd());

	const program = Layer.launch(
		ServerLayer(cwd).pipe(
			Layer.provide(NodeServices.layer),
			Layer.provide(Logger.layer([Logger.consolePretty()])),
			// `Logger.consolePretty` has no stderr option in rc.115 (it reads only
			// `{ colors, formatDate, mode }`). The real switch is this reference,
			// read at log time; without it every log line lands on stdout, the
			// JSON-RPC wire. See gotcha 4 in server.ts.
			Layer.provide(Layer.succeed(Logger.LogToStderr, true)),
		),
	);

	NodeRuntime.runMain(program, {
		// `Runtime.defaultTeardown` reports 130 whenever the main fiber's cause
		// holds only interruptions — exactly what stdin EOF ending the stdio
		// layer's scope produces. 130 reads as "killed by SIGINT" in a host's
		// MCP log, so a clean disconnect maps to 0; everything else keeps the
		// default. See gotcha 5 in server.ts.
		teardown: (exit, onExit) =>
			Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause) ? onExit(0) : Runtime.defaultTeardown(exit, onExit),
	});
};
/* v8 ignore stop */
