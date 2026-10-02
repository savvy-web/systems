/**
 * Runs a command handler in an interactive session — a person at a terminal —
 * whose `@effected/cli/ui` screens a test drives with keys, through
 * `@effected/cli/ui/testing`'s `CliUiTest.session`.
 *
 * @remarks
 * The handler runs forked, exactly as {@link Capture.run} runs it otherwise
 * (the CLI logger, a fresh `CliExit`, a recording `Console`), so its fiber
 * joins to the same {@link CaptureResult}. Take each screen with
 * `session.next({ contains })` as it mounts, drive it, then join:
 *
 * ```ts
 * it.effect("asks before removing", () =>
 *   Effect.gen(function* () {
 *     const { session, fiber } = yield* Interactive.run(handler({ name: "effect", yes: false }));
 *     yield* (yield* session.next({ contains: "Remove effect?" })).type("y");
 *     const result = yield* Fiber.join(fiber); // after the screen resolves
 *     expect(yield* session.mounts).toBe(1);
 *   }).pipe(Effect.scoped),
 * );
 * ```
 *
 * Traps (from the kit): `press("y")` dies — send a letter with `type("y")` or
 * `press({ char: "y" })`; one screen mounts at a time process-wide, so give
 * every test its own `Effect.scoped`; the harness waits in real time, so a
 * test that itself sleeps needs `it.live`. `{ interactive: false }` is the
 * agent/CI/pipe path: assert `mounts === 0` once the fiber has joined.
 */

import type { CliTheme } from "@effected/cli";
import { CliExit, CliLinks } from "@effected/cli";
import type { CliUiTestOptions, CliUiTestSession } from "@effected/cli/ui/testing";
import { CliUiTest } from "@effected/cli/ui/testing";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "@effected/env";
import type { Fiber, Scope } from "effect";
import { Console, Effect, Layer, MutableRef, Option } from "effect";

import type { ReportEnv } from "../../src/internal/report.js";
import type { CaptureResult } from "./capture.js";
import { Capture, makeRecordingConsole } from "./capture.js";

/** A handler running in an interactive session. */
export interface InteractiveRun<A, E> {
	/** The terminal the handler's screens mount on: `next`, `mounts`, frames. */
	readonly session: CliUiTestSession;
	/** The forked handler; join it once its screens have been answered. */
	readonly fiber: Fiber.Fiber<CaptureResult<A>, E>;
}

/**
 * Everything `Report.print` reads besides the theme (which the session
 * provides): a person's audience, a quiet terminal (stdout a pipe, so a
 * report is not wrapped), no editor links, no agent and no CI.
 */
const env: Layer.Layer<Exclude<ReportEnv, CliTheme> | CurrentRuntimeEnv> = Layer.mergeAll(
	Audience.layerTest("human"),
	TerminalEnv.layerTest(),
	CliLinks.layerTest("off"),
	CurrentRuntimeEnv.layerTest({ agent: Option.none(), ci: Option.none() }),
);

export class Interactive {
	private constructor() {}

	/**
	 * Fork `effect` in a fresh `CliUiTest.session`.
	 *
	 * @remarks
	 * `options` are the session's (`interactive`, `columns`, `rows`, `color`,
	 * `glyphs`); colour defaults to `none` here, not the kit's `truecolor`, so a
	 * `Report` the handler prints and every `plainFrame` are escape-free. Pass
	 * `color: "truecolor"` to snapshot token markup with `frame`.
	 */
	static readonly run = <A, E, R>(
		effect: Effect.Effect<A, E, R>,
		options: CliUiTestOptions = {},
	): Effect.Effect<InteractiveRun<A, E>, never, Scope.Scope | Exclude<R, CliExit | ReportEnv | CurrentRuntimeEnv>> =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ color: "none", ...options });
			const fiber = yield* Effect.forkScoped(
				Effect.gen(function* () {
					const stdout: Array<string> = [];
					const stderr: Array<string> = [];
					const exit = yield* CliExit;
					const value = yield* effect.pipe(
						Effect.provideService(Console.Console, makeRecordingConsole(stdout, stderr)),
					);
					return { value, stdout, stderr, exitCode: MutableRef.get(exit.code) };
				}).pipe(Effect.provide(Layer.mergeAll(CliExit.layer, Capture.logger, env, session.layer))),
			);
			return { session, fiber };
		});
}
