import { describe, expect, it } from "vitest";
import { format } from "../../../src/commitlint/formatter/format.js";
import { getExplanation, getSuggestion } from "../../../src/commitlint/formatter/messages.js";

describe("format", () => {
	it("formats errors with explanations", () => {
		const result = format({
			results: [
				{
					valid: false,
					input: "invalid commit",
					errors: [
						{
							level: 2,
							valid: false,
							name: "type-empty",
							message: "type may not be empty",
						},
					],
					warnings: [],
				},
			],
		});

		expect(result).toContain("type-empty");
		expect(result).toContain("1 error");
	});

	it("formats warnings", () => {
		const result = format({
			results: [
				{
					valid: true,
					input: "feat: something",
					errors: [],
					warnings: [
						{
							level: 1,
							valid: false,
							name: "header-max-length",
							message: "header must not be longer than 72 characters",
						},
					],
				},
			],
		});

		expect(result).toContain("1 warning");
	});

	it("shows help URL when provided", () => {
		const result = format({
			results: [
				{
					valid: false,
					input: "bad",
					errors: [{ level: 2, valid: false, name: "type-empty", message: "type may not be empty" }],
					warnings: [],
				},
			],
			options: {
				helpUrl: "https://example.com/help",
			},
		});

		expect(result).toContain("https://example.com/help");
	});

	it("returns empty string for valid commits", () => {
		const result = format({
			results: [
				{
					valid: true,
					input: "feat: valid commit",
					errors: [],
					warnings: [],
				},
			],
		});

		expect(result).toBe("");
	});
});

describe("getExplanation", () => {
	it("returns explanation for known rules", () => {
		expect(getExplanation("type-empty")).toBeTruthy();
		expect(getExplanation("signed-off-by")).toBeTruthy();
		expect(getExplanation("silk/signed-off-by")).toBeTruthy();
	});

	it("returns undefined for unknown rules", () => {
		expect(getExplanation("unknown-rule")).toBeUndefined();
	});
});

describe("getSuggestion", () => {
	it("returns suggestion for known rules", () => {
		expect(getSuggestion("type-empty")).toBeTruthy();
		expect(getSuggestion("signed-off-by")).toBeTruthy();
		expect(getSuggestion("silk/signed-off-by")).toBeTruthy();
	});

	it("returns undefined for unknown rules", () => {
		expect(getSuggestion("unknown-rule")).toBeUndefined();
	});
});
