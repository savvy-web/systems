import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, References } from "effect";
import { ActionLoggerTest } from "../../src/layers/ActionLoggerTest.js";
import { ActionLogger } from "../../src/services/ActionLogger.js";

const run = <A, E>(state: ReturnType<typeof ActionLoggerTest.empty>, effect: Effect.Effect<A, E, ActionLogger>) =>
	Effect.provide(effect, ActionLoggerTest.layer(state));

describe("ActionLoggerTest", () => {
	describe("empty", () => {
		it("creates empty state", () => {
			const state = ActionLoggerTest.empty();
			expect(state.entries).toEqual([]);
			expect(state.groups).toEqual([]);
			expect(state.flushedBuffers).toEqual([]);
			expect(state.notices).toEqual([]);
		});
	});

	describe("notice", () => {
		it.effect("records a notice into captured state", () =>
			Effect.gen(function* () {
				const state = ActionLoggerTest.empty();
				yield* run(
					state,
					Effect.flatMap(ActionLogger, (svc) => svc.notice("heads up")),
				);
				expect(state.notices).toHaveLength(1);
				expect(state.notices[0]?.message).toBe("heads up");
			}),
		);

		it.effect("forwards annotation properties", () =>
			Effect.gen(function* () {
				const state = ActionLoggerTest.empty();
				yield* run(
					state,
					Effect.flatMap(ActionLogger, (svc) => svc.notice("at line", { file: "a.ts", startLine: 3 })),
				);
				expect(state.notices[0]?.properties).toEqual({ file: "a.ts", startLine: 3 });
			}),
		);
	});

	describe("group", () => {
		it.effect("records group name and runs effect", () =>
			Effect.gen(function* () {
				const state = ActionLoggerTest.empty();
				const result = yield* run(
					state,
					Effect.flatMap(ActionLogger, (svc) => svc.group("build", Effect.succeed(42))),
				);
				expect(result).toBe(42);
				expect(state.groups).toHaveLength(1);
				expect(state.groups[0]?.name).toBe("build");
			}),
		);
	});

	describe("withBuffer", () => {
		afterEach(() => {
			vi.unstubAllEnvs();
		});

		it.effect("at debug minimum log level, passes through without buffering", () =>
			Effect.gen(function* () {
				const state = ActionLoggerTest.empty();
				const result = yield* Effect.provide(
					Effect.flatMap(ActionLogger, (svc) => svc.withBuffer("test", Effect.succeed("ok"))).pipe(
						Effect.provideService(References.MinimumLogLevel, "Debug"),
					),
					ActionLoggerTest.layer(state),
				);
				expect(result).toBe("ok");
				expect(state.flushedBuffers).toHaveLength(0);
			}),
		);

		it.effect("at info minimum log level, flushes on failure", () =>
			Effect.gen(function* () {
				const state = ActionLoggerTest.empty();
				const exit = yield* Effect.exit(
					Effect.provide(
						Effect.flatMap(ActionLogger, (svc) => svc.withBuffer("fail-op", Effect.fail("boom"))).pipe(
							Effect.provideService(References.MinimumLogLevel, "Info"),
						),
						ActionLoggerTest.layer(state),
					),
				);
				expect(exit._tag).toBe("Failure");
				expect(state.flushedBuffers).toHaveLength(1);
				expect(state.flushedBuffers[0]?.label).toBe("fail-op");
			}),
		);

		it.effect("at info minimum log level, records a flush on success, mirroring the live layer", () =>
			Effect.gen(function* () {
				// Pin the runner's step-debug signal off so ambient RUNNER_DEBUG=1 cannot bypass buffering.
				vi.stubEnv("RUNNER_DEBUG", "0");
				const state = ActionLoggerTest.empty();
				yield* run(
					state,
					Effect.flatMap(ActionLogger, (svc) => svc.withBuffer("ok-op", Effect.succeed("done"))),
				);
				expect(state.flushedBuffers).toHaveLength(1);
				expect(state.flushedBuffers[0]?.label).toBe("ok-op");
			}),
		);

		it.effect("passes through unbuffered when RUNNER_DEBUG=1, mirroring the live layer", () =>
			Effect.gen(function* () {
				vi.stubEnv("RUNNER_DEBUG", "1");
				const state = ActionLoggerTest.empty();
				const result = yield* Effect.provide(
					Effect.flatMap(ActionLogger, (svc) => svc.withBuffer("debug-op", Effect.succeed("live"))).pipe(
						Effect.provideService(References.MinimumLogLevel, "Info"),
					),
					ActionLoggerTest.layer(state),
				);
				expect(result).toBe("live");
				expect(state.flushedBuffers).toHaveLength(0);
			}),
		);
	});
});
