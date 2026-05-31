import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HookSilencer } from "../../../src/commitlint/hook/silence-logger.js";

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

	it("routes warning-level logs to stderr, never stdout", async () => {
		await Effect.runPromise(Effect.logWarning("boom").pipe(Effect.provide(HookSilencer)));

		expect(collect(stderrSpy)).toContain("boom");
		// stdout must stay pristine so the hook's JSON envelope is uncorrupted.
		expect(collect(stdoutSpy)).not.toContain("boom");
	});

	it("suppresses info-level logs entirely", async () => {
		await Effect.runPromise(Effect.logInfo("quiet").pipe(Effect.provide(HookSilencer)));

		expect(collect(stderrSpy)).not.toContain("quiet");
		expect(collect(stdoutSpy)).not.toContain("quiet");
	});

	it("serializes non-string log messages to stderr via JSON.stringify", async () => {
		// Log a structured object to confirm it serializes cleanly to stderr.
		await Effect.runPromise(Effect.logWarning({ code: 42 }).pipe(Effect.provide(HookSilencer)));

		expect(collect(stderrSpy)).toContain("42");
	});
});
