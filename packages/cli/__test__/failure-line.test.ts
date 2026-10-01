import type { FailureDetails } from "@effected/cli";
import { Cause, Data } from "effect";
import { describe, expect, it } from "vitest";

import { FailureLine } from "../src/internal/failure-line.js";

class CleanError extends Data.TaggedError("CleanError")<{ readonly reason: string }> {}

/** The kit-default report a test hands in, so a defect's pass-through is observable. */
const KIT_REPORT = ["✗ kit status line", "  at kit frame"];

/** A `FailureDetails` for a render under test. */
const details = (cause: Cause.Cause<unknown>, isDefect: boolean): FailureDetails => ({
	cause,
	isDefect,
	defaultLines: KIT_REPORT,
	lines: () => KIT_REPORT,
});

const typed = (error: unknown) => FailureLine.render(error, details(Cause.fail(error), false));

describe("FailureLine.render", () => {
	describe("a typed failure renders as one line", () => {
		it("uses an error's own message when it has one", () => {
			expect(typed(new Error("config is invalid"))).toBe("config is invalid");
		});

		it("names a tagged error with no message by its tag and fields, never the bare tag", () => {
			expect(typed(new CleanError({ reason: "EACCES on dist" }))).toBe("CleanError: reason: EACCES on dist");
		});

		it("renders a field JSON cannot serialize instead of throwing", () => {
			const circular: Record<string, unknown> = { name: "loop" };
			circular.self = circular;
			expect(typed({ _tag: "SizeError", bytes: 10n })).toBe("SizeError: bytes: 10");
			expect(typed({ _tag: "LoopError", node: circular })).toBe("LoopError: node: [object Object]");
		});

		it("falls back to String for anything else", () => {
			expect(typed("plain")).toBe("plain");
		});
	});

	describe("a defect renders as an issue report", () => {
		const boom = new TypeError("cannot read properties of undefined");
		const lines = FailureLine.render(boom, details(Cause.die(boom), true));

		it("is the kit's default report followed by where to report it", () => {
			expect(lines).toEqual([
				...KIT_REPORT,
				"This is a bug in savvy. Please report it with the output above at https://github.com/savvy-web/systems/issues",
			]);
		});

		it("follows isDefect, not the error's shape: a tagged value that died is still a defect", () => {
			const died = new CleanError({ reason: "x" });
			const report = FailureLine.render(died, details(Cause.die(died), true));
			expect(report).toEqual(lines);
		});

		it("never hands a typed failure the kit's report", () => {
			expect(typed(new CleanError({ reason: "x" }))).not.toContain(KIT_REPORT[0]);
		});
	});
});
