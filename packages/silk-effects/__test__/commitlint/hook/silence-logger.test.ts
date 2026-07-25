import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { HookSilencer } from "../../../src/commitlint/hook/silence-logger.js";

/**
 * These stay on `it.effect` rather than `it.live` despite asserting on log
 * output, and the reason is specific: Effect's DEFAULT logger writes through
 * the Console ref (`Logger.ts:273`), which `@effect/vitest`'s TestEnv replaces
 * — so a default-logger test WOULD be captured by TestConsole and go silent.
 * `HookSilencer` replaces the logger set entirely with one that writes straight
 * to `process.stderr.write` (`silence-logger.ts:31`), bypassing the Console ref,
 * so the spies below still see the output. Verified by mutation, not inference.
 */
describe("HookSilencer", () => {
	let stdoutSpy: ReturnType<typeof vi.spyOn>;
	let stderrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	});

	afterEach(() => {
		stdoutSpy.mockRestore();
		stderrSpy.mockRestore();
	});

	const collect = (spy: ReturnType<typeof vi.spyOn>): string =>
		spy.mock.calls.map((call: unknown[]) => String(call[0])).join("");

	it.effect("routes warning-level logs to stderr, never stdout", () =>
		Effect.gen(function* () {
			yield* Effect.logWarning("boom").pipe(Effect.provide(HookSilencer));

			expect(collect(stderrSpy)).toContain("boom");
			// stdout must stay pristine so the hook's JSON envelope is uncorrupted.
			expect(collect(stdoutSpy)).not.toContain("boom");
		}),
	);

	it.effect("suppresses info-level logs entirely", () =>
		Effect.gen(function* () {
			yield* Effect.logInfo("quiet").pipe(Effect.provide(HookSilencer));

			expect(collect(stderrSpy)).not.toContain("quiet");
			expect(collect(stdoutSpy)).not.toContain("quiet");
		}),
	);

	it.effect("serializes non-string log messages to stderr via JSON.stringify", () =>
		Effect.gen(function* () {
			// Log a structured object to confirm it serializes cleanly to stderr.
			yield* Effect.logWarning({ code: 42 }).pipe(Effect.provide(HookSilencer));

			expect(collect(stderrSpy)).toContain("42");
		}),
	);
});
