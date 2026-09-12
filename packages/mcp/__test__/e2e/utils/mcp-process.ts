/**
 * Spawn the built `savvy-mcp` bin as a long-lived server a test can write to
 * while it runs. Ported from okfit's `mcpProcess.ts`: the child's stdin is fed
 * from a queue drained into `handle.stdin` once for the life of the scope;
 * `closeStdin` ends that queue, which `Stream.fromQueue` treats as a graceful
 * end, closing the child's stdin fd — the signal that ends the server's scope.
 */

import { resolve } from "node:path";
import type { Cause, PlatformError, Scope } from "effect";
import { Effect, Fiber, Queue, Ref, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

/** The built dev bin, resolved from this file's own location, never from cwd. */
export const MCP_BIN: string = resolve(
	import.meta.dirname,
	"..",
	"..",
	"..",
	"dist",
	"dev",
	"pkg",
	"bin",
	"savvy-mcp.js",
);

/** A live server process. */
export interface McpProcess {
	/** JSON-encode one message and write it, newline-framed, to the child's stdin. */
	readonly send: (message: unknown) => Effect.Effect<void>;
	/** The next complete stdout line. */
	readonly nextLine: Effect.Effect<string>;
	/** Close the child's stdin, which is what should end the server's scope. */
	readonly closeStdin: Effect.Effect<void>;
	/** Resolves with the child's exit code. */
	readonly exitCode: Effect.Effect<number, PlatformError.PlatformError>;
	/** Everything written to stderr so far (does not wait for the stream to end). */
	readonly stderrSoFar: Effect.Effect<string>;
	/**
	 * Everything the child wrote to stderr over its whole life: joins the
	 * collector fiber (which ends when the child's stderr closes) before reading,
	 * so a line written during teardown is covered. Use after `exitCode`.
	 */
	readonly stderrFinal: Effect.Effect<string, PlatformError.PlatformError>;
}

export const spawnMcp = (
	env: Readonly<Record<string, string>>,
	args: ReadonlyArray<string> = [],
): Effect.Effect<McpProcess, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner | Scope.Scope> =>
	Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const handle = yield* spawner.spawn(ChildProcess.make(process.execPath, [MCP_BIN, ...args], { env }));

		const encoder = new TextEncoder();
		const stdin = yield* Queue.make<Uint8Array, Cause.Done>();
		yield* Stream.run(Stream.fromQueue(stdin), handle.stdin).pipe(Effect.forkScoped);

		const lines = yield* Queue.unbounded<string>();
		let pending = "";
		yield* Stream.decodeText(handle.stdout)
			.pipe(
				Stream.runForEach((text) =>
					Effect.gen(function* () {
						pending += text;
						let newline = pending.indexOf("\n");
						while (newline !== -1) {
							const line = pending.slice(0, newline);
							pending = pending.slice(newline + 1);
							if (line.length > 0) yield* Queue.offer(lines, line);
							newline = pending.indexOf("\n");
						}
					}),
				),
			)
			.pipe(Effect.forkScoped);

		const stderrRef = yield* Ref.make("");
		const stderrCollector = yield* Stream.decodeText(handle.stderr)
			.pipe(Stream.runForEach((text) => Ref.update(stderrRef, (current) => current + text)))
			.pipe(Effect.forkScoped);

		return {
			send: (message) => Queue.offer(stdin, encoder.encode(`${JSON.stringify(message)}\n`)).pipe(Effect.asVoid),
			nextLine: Queue.take(lines),
			closeStdin: Queue.end(stdin).pipe(Effect.asVoid),
			exitCode: handle.exitCode,
			stderrSoFar: Ref.get(stderrRef),
			stderrFinal: Fiber.join(stderrCollector).pipe(Effect.andThen(Ref.get(stderrRef))),
		};
	});
