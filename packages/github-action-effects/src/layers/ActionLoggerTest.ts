import { Effect, Layer, LogLevel, References } from "effect";
import type { Scope } from "effect/Scope";
import type { AnnotationProperties } from "../runtime/WorkflowCommand.js";
import { ActionLogger } from "../services/ActionLogger.js";

/**
 * In-memory state captured by the test logger.
 * @public
 */
export interface ActionLoggerTestState {
	readonly entries: Array<{ readonly level: string; readonly message: string }>;
	readonly groups: Array<{
		readonly name: string;
		readonly entries: Array<{ readonly level: string; readonly message: string }>;
	}>;
	readonly flushedBuffers: Array<{
		readonly label: string;
		readonly entries: Array<string>;
	}>;
	readonly notices: Array<{
		readonly message: string;
		readonly properties: AnnotationProperties | undefined;
	}>;
}

/**
 * Test implementation that captures log operations in memory.
 *
 * @example
 * ```ts
 * const state = ActionLoggerTest.empty();
 * const layer = ActionLoggerTest.layer(state);
 * ```
 * @public
 */
export const ActionLoggerTest = {
	/**
	 * Create a fresh empty test state container.
	 */
	empty: (): ActionLoggerTestState => ({
		entries: [],
		groups: [],
		flushedBuffers: [],
		notices: [],
	}),

	/**
	 * Create a test layer from the given state.
	 */
	layer: (state: ActionLoggerTestState): Layer.Layer<ActionLogger> =>
		Layer.succeed(ActionLogger, {
			group: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>) => {
				const groupEntries: Array<{ level: string; message: string }> = [];
				state.groups.push({ name, entries: groupEntries });
				return effect;
			},

			withBuffer: <A, E, R>(label: string, effect: Effect.Effect<A, E, R>) =>
				Effect.gen(function* () {
					const minLevel = yield* References.MinimumLogLevel;
					const runnerDebug = process.env.RUNNER_DEBUG === "1";

					// When minimum log level is Debug or lower, or step debug is on, pass through without buffering
					if (LogLevel.isLessThanOrEqualTo(minLevel, "Debug") || runnerDebug) {
						return yield* effect;
					}

					return yield* effect.pipe(
						Effect.onExit(() =>
							Effect.sync(() => {
								state.flushedBuffers.push({ label, entries: [] });
							}),
						),
					);
				}) as Effect.Effect<A, E, Exclude<R, Scope>>,

			notice: (message, properties) =>
				Effect.sync(() => {
					state.notices.push({ message, properties });
				}),
		}),
} as const;
