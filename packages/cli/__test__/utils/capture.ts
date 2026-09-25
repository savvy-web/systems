/**
 * Runs a command handler the way `main()` does — under the same CLI logger and
 * a fresh `CliExit` cell — and returns what it wrote to each stream and the
 * exit code it set, as data. The stream split is observed by swapping the
 * `Console.Console` reference, which is exactly what `CliLogger` and
 * `Console.log` read, so no global is patched.
 */

import { CliExit, CliLogger } from "@effected/cli";
import type { Layer } from "effect";
import { Console, Effect, MutableRef } from "effect";

/** What a captured run did. */
export interface CaptureResult<A> {
	readonly value: A;
	/** One entry per `console.log`/`info`/`debug` call, arguments joined with a space. */
	readonly stdout: ReadonlyArray<string>;
	/** One entry per `console.error`/`warn` call, arguments joined with a space. */
	readonly stderr: ReadonlyArray<string>;
	/** The highest code the run set through `CliExit.set`, `0` when none. */
	readonly exitCode: number;
}

const render = (args: ReadonlyArray<unknown>): string => args.map(String).join(" ");

/**
 * A `Console` that records instead of printing: the stdout methods into
 * `stdout`, the stderr methods into `stderr`. Everything else is the real
 * console, so an unexpected call still behaves.
 */
export const makeRecordingConsole = (stdout: Array<string>, stderr: Array<string>): Console.Console => ({
	...globalThis.console,
	log: (...args: ReadonlyArray<unknown>) => void stdout.push(render(args)),
	info: (...args: ReadonlyArray<unknown>) => void stdout.push(render(args)),
	debug: (...args: ReadonlyArray<unknown>) => void stdout.push(render(args)),
	error: (...args: ReadonlyArray<unknown>) => void stderr.push(render(args)),
	warn: (...args: ReadonlyArray<unknown>) => void stderr.push(render(args)),
});

export class Capture {
	private constructor() {}

	/** The logger `main()` installs; the tests assert the stream split it produces. */
	static readonly logger: Layer.Layer<never> = CliLogger.layer({ stderrFrom: "Error" });

	/** Run `effect` under the CLI logger and a fresh `CliExit`, recording both streams. */
	static readonly run = <A, E, R>(
		effect: Effect.Effect<A, E, R>,
	): Effect.Effect<CaptureResult<A>, E, Exclude<R, CliExit>> =>
		Effect.gen(function* () {
			const stdout: Array<string> = [];
			const stderr: Array<string> = [];
			const exit = yield* CliExit;
			const value = yield* effect.pipe(Effect.provideService(Console.Console, makeRecordingConsole(stdout, stderr)));
			return { value, stdout, stderr, exitCode: MutableRef.get(exit.code) };
		}).pipe(Effect.provide(CliExit.layer), Effect.provide(Capture.logger));
}
