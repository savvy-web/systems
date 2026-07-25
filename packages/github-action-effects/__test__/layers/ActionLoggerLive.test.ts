/**
 * Every test here runs on `it.live`, not `it.effect`.
 *
 * `it.effect` installs `TestConsole` (see `@effect/vitest`
 * `internal/internal.ts` — `TestEnv = Layer.mergeAll(TestConsole.layer, TestClock.layer())`),
 * and Effect's default logger writes through the Console ref
 * (`Logger.withConsoleLog` reads `fiber.getRef(ConsoleRef)`), so the ambient
 * console logger this suite asserts on would be swallowed. The RUNNER_DEBUG=1
 * test spies `console.log` directly and would pass vacuously; the buffered
 * transcript tests would lose the very output they measure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, Logger, References } from "effect";
import { ActionLoggerLive } from "../../src/layers/ActionLoggerLive.js";
import { ActionLogger } from "../../src/services/ActionLogger.js";

const run = <A, E>(effect: Effect.Effect<A, E, ActionLogger>) => Effect.provide(effect, ActionLoggerLive);

const runExit = <A, E>(effect: Effect.Effect<A, E, ActionLogger>) =>
	Effect.exit(Effect.provide(effect, ActionLoggerLive));

describe("ActionLoggerLive", () => {
	describe("group", () => {
		let writeSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		});

		afterEach(() => {
			writeSpy.mockRestore();
		});

		it.live("writes ::group:: and ::endgroup:: to stdout", () =>
			Effect.gen(function* () {
				yield* run(Effect.flatMap(ActionLogger, (svc) => svc.group("my group", Effect.succeed("ok"))));
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("::group::my group"))).toBe(true);
				expect(written.some((s: string) => s.includes("::endgroup::"))).toBe(true);
			}),
		);

		it.live("writes ::endgroup:: even on failure", () =>
			Effect.gen(function* () {
				yield* runExit(Effect.flatMap(ActionLogger, (svc) => svc.group("fail group", Effect.fail("boom"))));
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("::group::fail group"))).toBe(true);
				expect(written.some((s: string) => s.includes("::endgroup::"))).toBe(true);
			}),
		);
	});

	describe("withBuffer", () => {
		let writeSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		});

		afterEach(() => {
			writeSpy.mockRestore();
			vi.unstubAllEnvs();
		});

		it.live("at debug minimum log level, passes through without buffering", () =>
			Effect.gen(function* () {
				const result = yield* Effect.provide(
					Effect.flatMap(ActionLogger, (svc) => svc.withBuffer("test", Effect.succeed(42))).pipe(
						Effect.provideService(References.MinimumLogLevel, "Debug"),
					),
					ActionLoggerLive,
				);
				expect(result).toBe(42);
			}),
		);

		it.live("at info minimum log level, flushes the buffered transcript to stdout on success", () =>
			Effect.gen(function* () {
				// Pin the runner's step-debug signal off so ambient RUNNER_DEBUG=1 cannot bypass buffering.
				vi.stubEnv("RUNNER_DEBUG", "0");
				const result = yield* Effect.provide(
					Effect.flatMap(ActionLogger, (svc) =>
						svc.withBuffer("test", Effect.log("verbose line").pipe(Effect.map(() => "ok"))),
					).pipe(Effect.provideService(References.MinimumLogLevel, "Info")),
					ActionLoggerLive,
				);
				expect(result).toBe("ok");
				// A successful run must still print its buffered transcript.
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("verbose line"))).toBe(true);
			}),
		);

		it.live("at info minimum log level, flushes buffer to stdout on failure", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(
					Effect.provide(
						Effect.flatMap(ActionLogger, (svc) =>
							svc.withBuffer("fail-op", Effect.log("buffered line").pipe(Effect.flatMap(() => Effect.fail("boom")))),
						).pipe(Effect.provideService(References.MinimumLogLevel, "Info")),
						ActionLoggerLive,
					),
				);
				expect(exit._tag).toBe("Failure");
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("Buffered output"))).toBe(true);
			}),
		);

		describe("RUNNER_DEBUG bypass", () => {
			afterEach(() => {
				vi.unstubAllEnvs();
			});

			it.live("passes through unbuffered when RUNNER_DEBUG=1, even at an ambient Info minimum log level", () =>
				Effect.gen(function* () {
					vi.stubEnv("RUNNER_DEBUG", "1");
					// Live (unbuffered) output goes through the ambient console logger, not process.stdout.write.
					const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
					const result = yield* Effect.provide(
						Effect.flatMap(ActionLogger, (svc) =>
							svc.withBuffer("test", Effect.log("live debug line").pipe(Effect.map(() => "ok"))),
						).pipe(Effect.provideService(References.MinimumLogLevel, "Info")),
						ActionLoggerLive,
					);
					expect(result).toBe("ok");
					// The live line must actually be emitted, never wrapped in a "Buffered output" transcript.
					const logged = logSpy.mock.calls.map((c: unknown[]) => c.map(String).join(" "));
					logSpy.mockRestore();
					expect(logged.some((s: string) => s.includes("live debug line"))).toBe(true);
					const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
					expect(written.some((s: string) => s.includes("Buffered output"))).toBe(false);
				}),
			);

			it.live('still buffers normally when RUNNER_DEBUG is not exactly "1" (e.g. "0")', () =>
				Effect.gen(function* () {
					vi.stubEnv("RUNNER_DEBUG", "0");
					const exit = yield* Effect.exit(
						Effect.provide(
							Effect.flatMap(ActionLogger, (svc) =>
								svc.withBuffer(
									"fail-op",
									Effect.log("still-buffered line").pipe(Effect.flatMap(() => Effect.fail("boom"))),
								),
							).pipe(Effect.provideService(References.MinimumLogLevel, "Info")),
							ActionLoggerLive,
						),
					);
					expect(exit._tag).toBe("Failure");
					const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
					expect(written.some((s: string) => s.includes("Buffered output"))).toBe(true);
				}),
			);
		});
	});

	describe("notice", () => {
		let writeSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		});

		afterEach(() => {
			writeSpy.mockRestore();
		});

		it.live("issues a ::notice:: command", () =>
			Effect.gen(function* () {
				yield* run(Effect.flatMap(ActionLogger, (svc) => svc.notice("heads up")));
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("::notice::heads up"))).toBe(true);
			}),
		);

		it.live("forwards annotation properties (startLine→line, startColumn→col)", () =>
			Effect.gen(function* () {
				yield* run(
					Effect.flatMap(ActionLogger, (svc) => svc.notice("x", { file: "a.ts", startLine: 3, startColumn: 5 })),
				);
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("::notice file=a.ts,line=3,col=5::x"))).toBe(true);
			}),
		);

		it.live("logInfo still emits plain stdout, not ::notice:: (no level remap)", () =>
			Effect.gen(function* () {
				// logInfo routes through Effect's default logger (logfmt), not the ActionLogger service; swap it
				// for a no-op logger so the routine line does not leak to the test console. A service-level remap
				// to ::notice would still go through the spied process.stdout.write, so the assertion still holds.
				yield* run(Effect.logInfo("routine info").pipe(Effect.provide(Logger.layer([]))));
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("::notice"))).toBe(false);
			}),
		);
	});

	describe("per-group buffer flush", () => {
		let writeSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		});

		afterEach(() => {
			writeSpy.mockRestore();
		});

		const failingGroupProgram = Effect.flatMap(ActionLogger, (svc) =>
			svc.withBuffer(
				"action",
				svc.group("install", Effect.log("buffered detail").pipe(Effect.flatMap(() => Effect.fail("boom")))),
			),
		).pipe(Effect.provideService(References.MinimumLogLevel, "Info"));

		it.live("flushes the active buffer inside a failing group, before ::endgroup::", () =>
			Effect.gen(function* () {
				yield* Effect.exit(Effect.provide(failingGroupProgram, ActionLoggerLive));
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				const bufferIdx = written.findIndex((s: string) => s.includes("buffered detail"));
				const endGroupIdx = written.findIndex((s: string) => s.includes("::endgroup::"));
				expect(bufferIdx).toBeGreaterThanOrEqual(0);
				expect(endGroupIdx).toBeGreaterThanOrEqual(0);
				expect(bufferIdx).toBeLessThan(endGroupIdx);
			}),
		);

		it.live("flushes the buffered output exactly once", () =>
			Effect.gen(function* () {
				yield* Effect.exit(Effect.provide(failingGroupProgram, ActionLoggerLive));
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				const headerCount = written.filter((s: string) => s.includes("--- Buffered output")).length;
				expect(headerCount).toBe(1);
			}),
		);

		it.live("still flushes at the withBuffer boundary when the failure is outside any group", () =>
			Effect.gen(function* () {
				const program = Effect.flatMap(ActionLogger, (svc) =>
					svc.withBuffer("action", Effect.log("ungrouped detail").pipe(Effect.flatMap(() => Effect.fail("boom")))),
				).pipe(Effect.provideService(References.MinimumLogLevel, "Info"));
				yield* Effect.exit(Effect.provide(program, ActionLoggerLive));
				const written = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
				expect(written.some((s: string) => s.includes("ungrouped detail"))).toBe(true);
			}),
		);
	});
});
