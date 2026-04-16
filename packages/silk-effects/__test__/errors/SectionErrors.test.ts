import { describe, expect, it } from "vitest";
import { SectionParseError } from "../../src/errors/SectionParseError.js";
import { SectionValidationError } from "../../src/errors/SectionValidationError.js";
import { SectionWriteError } from "../../src/errors/SectionWriteError.js";

describe("SectionValidationError", () => {
	it("has correct tag", () => {
		const err = new SectionValidationError({ toolName: "MY-TOOL", reason: "missing header" });
		expect(err._tag).toBe("SectionValidationError");
	});

	it("has human-readable message", () => {
		const err = new SectionValidationError({ toolName: "MY-TOOL", reason: "missing header" });
		expect(err.message).toBe("Section validation failed for MY-TOOL: missing header");
	});
});

describe("SectionParseError", () => {
	it("has correct tag", () => {
		const err = new SectionParseError({ path: "/hook", reason: "disk error" });
		expect(err._tag).toBe("SectionParseError");
	});

	it("has human-readable message", () => {
		const err = new SectionParseError({ path: "/hook", reason: "disk error" });
		expect(err.message).toBe("Failed to parse section in /hook: disk error");
	});
});

describe("SectionWriteError", () => {
	it("has correct tag", () => {
		const err = new SectionWriteError({ path: "/hook", reason: "read-only" });
		expect(err._tag).toBe("SectionWriteError");
	});

	it("has human-readable message", () => {
		const err = new SectionWriteError({ path: "/hook", reason: "read-only" });
		expect(err.message).toBe("Failed to write section to /hook: read-only");
	});
});
