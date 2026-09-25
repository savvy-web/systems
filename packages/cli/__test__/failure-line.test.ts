import { Data } from "effect";
import { describe, expect, it } from "vitest";

import { FailureLine } from "../src/internal/failure-line.js";

class CleanError extends Data.TaggedError("CleanError")<{ readonly reason: string }> {}

describe("FailureLine.render", () => {
	it("uses an error's own message when it has one", () => {
		expect(FailureLine.render(new Error("config is invalid"))).toBe("config is invalid");
	});

	it("names a tagged error with no message by its tag and fields, never the bare tag", () => {
		expect(FailureLine.render(new CleanError({ reason: "EACCES on dist" }))).toBe("CleanError: reason: EACCES on dist");
	});

	it("falls back to String for anything else", () => {
		expect(FailureLine.render("plain")).toBe("plain");
	});
});
