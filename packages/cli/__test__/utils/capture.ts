/**
 * Runs a command handler the way `main()` does — under the same CLI logger and
 * a fresh `CliExit` cell — and returns what it wrote to each stream and the
 * exit code it set, as data. The stream split is observed by swapping the
 * `Console.Console` reference, which is exactly what `CliLogger` and
 * `Console.log` read, so no global is patched.
 */

import { CliEnv, CliExit, CliLinks, CliLogger } from "@effected/cli";

import { Console, Effect, Layer, MutableRef, Stdio } from "effect";

import type { ReportEnv } from "../../src/internal/report.js";

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
	static readonly logger: Layer.Layer<never> = CliLogger.layer();

	/** A `Stdio` whose stdout is not a terminal. For stacks with no platform `Stdio`. */
	static readonly piped: Layer.Layer<Stdio.Stdio> = Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(false) });

	/**
	 * The presentation environment `main()` builds from `env`, fixed for a test:
	 * a person's audience on a pipe with no colour and no editor links, so a
	 * `Report` renders escape-free and reads nothing of the host's (a
	 * `FORCE_COLOR` inherited from CI included).
	 */
	static readonly env: Layer.Layer<ReportEnv> = Layer.merge(
		CliEnv.layerTest({ tty: false, audience: "human", color: "none" }),
		CliLinks.layerTest("off"),
	);

	/**
	 * The streams as a layer, for handler tests that build their own layer
	 * stack: `stdout` receives what the command prints as its result, `stderr`
	 * every log line. Uses the kit-default logger (every level on stderr), so
	 * a line reaches `stdout` only if the command wrote it as output.
	 */
	static readonly layer = (stdout: Array<string>, stderr: Array<string> = []): Layer.Layer<ReportEnv> =>
		Layer.mergeAll(
			Layer.succeed(Console.Console, makeRecordingConsole(stdout, stderr)),
			CliLogger.layer(),
			Capture.env,
		);

	/** Run `effect` under the CLI logger and a fresh `CliExit`, recording both streams. */
	static readonly run = <A, E, R>(
		effect: Effect.Effect<A, E, R>,
	): Effect.Effect<CaptureResult<A>, E, Exclude<Exclude<R, CliExit>, ReportEnv>> =>
		Effect.gen(function* () {
			const stdout: Array<string> = [];
			const stderr: Array<string> = [];
			const exit = yield* CliExit;
			const value = yield* effect.pipe(Effect.provideService(Console.Console, makeRecordingConsole(stdout, stderr)));
			return { value, stdout, stderr, exitCode: MutableRef.get(exit.code) };
		}).pipe(Effect.provide(CliExit.layer), Effect.provide(Capture.logger), Effect.provide(Capture.env));
}
