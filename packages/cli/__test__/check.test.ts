import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { runCheck } from "../src/commands/check.js";

describe("savvy check orchestrator", () => {
	it.effect("runs all three checks and succeeds when all pass", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			// Yielding the program directly IS the success assertion: any failure
			// would surface as a test failure rather than a silently-ignored Exit.
			yield* runCheck({
				changeset: Effect.sync(() => calls.push("changeset")),
				commit: Effect.sync(() => calls.push("commit")),
				lint: Effect.sync(() => calls.push("lint")),
			});
			expect(calls.sort()).toEqual(["changeset", "commit", "lint"]);
		}),
	);

	it.effect("runs ALL checks even when one fails, and exits failure", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			// `Effect.flip` (not `Effect.exit`) proves the failure arrives through
			// the TYPED error channel — an `Exit.isFailure` check would also pass
			// if the step had escaped as a defect.
			const error = yield* Effect.flip(
				runCheck({
					changeset: Effect.sync(() => calls.push("changeset")),
					commit: Effect.fail(new Error("commit check failed")),
					lint: Effect.sync(() => calls.push("lint")),
				}),
			);
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("commit check failed");
			// all non-failing checks still ran (no short-circuit)
			expect(calls.sort()).toEqual(["changeset", "lint"]);
		}),
	);
});
