import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { runCheck } from "../src/commands/check.js";

describe("savvy check orchestrator", () => {
	it("runs all three checks and succeeds when all pass", async () => {
		const calls: string[] = [];
		const exit = await Effect.runPromiseExit(
			runCheck({
				changeset: Effect.sync(() => calls.push("changeset")),
				commit: Effect.sync(() => calls.push("commit")),
				lint: Effect.sync(() => calls.push("lint")),
			}),
		);
		expect(Exit.isSuccess(exit)).toBe(true);
		expect(calls.sort()).toEqual(["changeset", "commit", "lint"]);
	});

	it("runs ALL checks even when one fails, and exits failure", async () => {
		const calls: string[] = [];
		const exit = await Effect.runPromiseExit(
			runCheck({
				changeset: Effect.sync(() => calls.push("changeset")),
				commit: Effect.fail(new Error("commit check failed")),
				lint: Effect.sync(() => calls.push("lint")),
			}),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		// all non-failing checks still ran (no short-circuit)
		expect(calls.sort()).toEqual(["changeset", "lint"]);
	});
});
