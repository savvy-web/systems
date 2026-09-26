import { Cause, Data } from "effect";
import { describe, expect, it } from "vitest";

import { FailureLine } from "../src/internal/failure-line.js";

class CleanError extends Data.TaggedError("CleanError")<{ readonly reason: string }> {}

const typed = (error: unknown) => FailureLine.render(error, { cause: Cause.fail(error), isDefect: false });

describe("FailureLine.render", () => {
	describe("a typed failure renders as one line", () => {
		it("uses an error's own message when it has one", () => {
			expect(typed(new Error("config is invalid"))).toBe("config is invalid");
		});

		it("names a tagged error with no message by its tag and fields, never the bare tag", () => {
			expect(typed(new CleanError({ reason: "EACCES on dist" }))).toBe("CleanError: reason: EACCES on dist");
		});

		it("falls back to String for anything else", () => {
			expect(typed("plain")).toBe("plain");
		});
	});

	describe("a defect renders as an issue report", () => {
		const boom = new TypeError("cannot read properties of undefined");
		const lines = FailureLine.render(boom, { cause: Cause.die(boom), isDefect: true });

		it("is several lines: a headline, the pretty cause with its stack, and where to report it", () => {
			expect(Array.isArray(lines)).toBe(true);
			const all = lines as ReadonlyArray<string>;
			expect(all[0]).toBe("savvy hit an unexpected error: cannot read properties of undefined");
			expect(all.slice(1, -1).join("\n")).toContain("TypeError: cannot read properties of undefined");
			expect(all.slice(1, -1).some((line) => line.trimStart().startsWith("at "))).toBe(true);
			expect(all.at(-1)).toBe(
				"This is a bug in savvy. Please report it with the output above at https://github.com/savvy-web/systems/issues",
			);
		});

		it("follows isDefect, not the error's shape: a tagged value that died is still a defect", () => {
			const died = new CleanError({ reason: "x" });
			const report = FailureLine.render(died, { cause: Cause.die(died), isDefect: true });
			expect(Array.isArray(report)).toBe(true);
			expect((report as ReadonlyArray<string>)[0]).toBe("savvy hit an unexpected error: CleanError: reason: x");
		});
	});
});
