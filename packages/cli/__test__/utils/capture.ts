/**
 * Runs a command handler the way `main()` does — under the same CLI logger and
 * a fresh `CliExit` cell — and returns what it wrote to each stream and the
 * exit code it set, as data. The stream split is observed by swapping the
 * `Console.Console` reference, which is exactly what `CliLogger` and
 * `Console.log` read, so no global is patched.
 *
 * Pick the audience with {@link CaptureOptions} (`human`, `agent`, `ci`, and
 * `githubActions` for the Actions log format); run a failing handler through
 * the real failure report with {@link Capture.main}; drive an Ink screen with
 * `Interactive` in `./interactive.ts`.
 */

import type { CliEnvServices } from "@effected/cli";
import { CliEnv, CliExit, CliLinks, CliLogger, CliRuntime } from "@effected/cli";
import type { AudienceKind } from "@effected/env";
import { CurrentRuntimeEnv } from "@effected/env";
import {
	Cause,
	ConfigProvider,
	Console,
	Effect,
	Exit,
	Layer,
	MutableRef,
	Option,
	Runtime,
	Stdio,
	Terminal,
} from "effect";

import { FailureLine } from "../../src/internal/failure-line.js";
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

/**
 * Who a captured run is for.
 *
 * @remarks
 * Every option has a quiet default: a person's audience on a pipe, no colour,
 * no editor links and no CI, so nothing of the host's (an inherited
 * `FORCE_COLOR`, `CLAUDECODE`, `GITHUB_ACTIONS`) decides the output.
 */
export interface CaptureOptions {
	/** The audience; `human` by default. */
	readonly audience?: AudienceKind | undefined;
	/**
	 * Whether the run is under GitHub Actions (`CurrentRuntimeEnv.ci` is
	 * `github-actions`): with `audience: "ci"`, `Report.print` writes the
	 * Actions log format — `::group::` folds and `Doc.annotation` workflow
	 * commands — instead of plain text. `false` by default.
	 */
	readonly githubActions?: boolean | undefined;
}

/** Options for {@link Capture.main}: an audience, plus whether the run has a terminal. */
export interface CaptureMainOptions extends CaptureOptions {
	/**
	 * Whether stdin and stdout are terminals; `false` (a pipe) by default. With
	 * a `human` audience a terminal makes the run interactive (`CliInteractive`),
	 * as it is for a person at a shell: core's prompts and `CliUi` screens may
	 * mount, so only use it for a program that asks nothing, or drive the
	 * screens with `Interactive`. The config stays empty, so there is no colour.
	 */
	readonly tty?: boolean | undefined;
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
	 * {@link Capture.env} for a chosen audience: the same pipe with no colour
	 * and no links, plus a fixed `CurrentRuntimeEnv` (no agent detected; CI
	 * only when `githubActions`).
	 */
	static readonly envFor = (options: CaptureOptions = {}): Layer.Layer<ReportEnv | CurrentRuntimeEnv> =>
		Layer.mergeAll(
			CliEnv.layerTest({ tty: false, audience: options.audience ?? "human", color: "none" }),
			CliLinks.layerTest("off"),
			CurrentRuntimeEnv.layerTest({
				agent: Option.none(),
				ci: options.githubActions === true ? Option.some("github-actions") : Option.none(),
			}),
		);

	/**
	 * The streams as a layer, for handler tests that build their own layer
	 * stack: `stdout` receives what the command prints as its result, `stderr`
	 * every log line. Uses the kit-default logger (every level on stderr), so
	 * a line reaches `stdout` only if the command wrote it as output.
	 */
	static readonly layer = (
		stdout: Array<string>,
		stderr: Array<string> = [],
		options: CaptureOptions = {},
	): Layer.Layer<ReportEnv | CurrentRuntimeEnv> =>
		Layer.mergeAll(
			Layer.succeed(Console.Console, makeRecordingConsole(stdout, stderr)),
			CliLogger.layer(),
			Capture.envFor(options),
		);

	/**
	 * Run `effect` under the CLI logger and a fresh `CliExit`, recording both
	 * streams, for the audience `options` names (a person by default).
	 */
	static readonly run = <A, E, R>(
		effect: Effect.Effect<A, E, R>,
		options: CaptureOptions = {},
	): Effect.Effect<CaptureResult<A>, E, Exclude<Exclude<R, CliExit>, ReportEnv | CurrentRuntimeEnv>> =>
		Effect.gen(function* () {
			const stdout: Array<string> = [];
			const stderr: Array<string> = [];
			const exit = yield* CliExit;
			const value = yield* effect.pipe(Effect.provideService(Console.Console, makeRecordingConsole(stdout, stderr)));
			return { value, stdout, stderr, exitCode: MutableRef.get(exit.code) };
		}).pipe(Effect.provide(CliExit.layer), Effect.provide(Capture.logger), Effect.provide(Capture.envFor(options)));

	/**
	 * Run `effect` through `CliRuntime.main` exactly as `main()` wires it —
	 * `env` built from a piped terminal and an empty config (plus the
	 * audience override), `render: FailureLine.render` — and return the
	 * streams and the process exit code `main` decided.
	 *
	 * @remarks
	 * The one way to assert how a FAILURE reads: the report `main` writes on
	 * stderr (a `CommandError`'s document, a typed failure's one line, a
	 * defect's bug report) for the chosen audience, and its exit code (`1` for
	 * a typed failure, `130` for a cancel). A success's exit code is the
	 * `CliExit` code the run set. `value` is `undefined`: `main` discards it.
	 * `githubActions` is ignored here, since `main` detects CI from the config.
	 */
	static readonly main = <A, E, R>(
		effect: Effect.Effect<A, E, R>,
		options: CaptureMainOptions = {},
	): Effect.Effect<
		CaptureResult<undefined>,
		never,
		Exclude<Exclude<R, CliExit | CliEnvServices>, Stdio.Stdio | Terminal.Terminal>
	> =>
		Effect.gen(function* () {
			const stdout: Array<string> = [];
			const stderr: Array<string> = [];
			const exit = yield* CliRuntime.main(effect, {
				platform: Capture.mainPlatform(options.tty === true),
				env: { audienceEnvVar: "SAVVY_AUDIENCE", stderrIsTerminal: Effect.succeed(false) },
				render: FailureLine.render,
			}).pipe(
				Effect.provideService(Console.Console, makeRecordingConsole(stdout, stderr)),
				Effect.provideService(
					ConfigProvider.ConfigProvider,
					ConfigProvider.fromUnknown({ SAVVY_AUDIENCE: options.audience ?? "human" }),
				),
				Effect.exit,
			);
			const exitCode = Exit.isSuccess(exit) ? 0 : Runtime.getErrorExitCode(Cause.squash(exit.cause));
			return { value: undefined, stdout, stderr, exitCode };
		});

	/** The platform {@link Capture.main} hands `CliRuntime.main`: a `Stdio` (piped, or a terminal) and a terminal that is never read. */
	static readonly mainPlatform = (tty: boolean): Layer.Layer<Stdio.Stdio | Terminal.Terminal> =>
		Layer.merge(
			Stdio.layerTest({ stdinIsTerminal: Effect.succeed(tty), stdoutIsTerminal: Effect.succeed(tty) }),
			Layer.succeed(
				Terminal.Terminal,
				Terminal.make({
					columns: Effect.succeed(80),
					rows: Effect.succeed(24),
					readInput: Effect.die("Capture.main: the terminal is never read"),
					readLine: Effect.die("Capture.main: the terminal is never read"),
					display: () => Effect.void,
				}),
			),
		);
}
