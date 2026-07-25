import { lint } from "markdownlint/sync";
import { describe, expect, it } from "vitest";
import { DependencyTableFormatRule } from "../../src/changesets/markdownlint/rules/dependency-table-format.js";

function check(markdown: string) {
	const result = lint({
		strings: { test: markdown },
		customRules: [DependencyTableFormatRule],
		config: { default: false, CSH005: true },
	});
	return (result.test ?? []).map((e) => e.errorDetail ?? "");
}

/** Build a `## Dependencies` section around one data row. */
function table(row: string): string {
	return [
		"## Dependencies",
		"",
		"| Dependency | Type | Action | From | To |",
		"| --- | --- | --- | --- | --- |",
		row,
		"",
	].join("\n");
}

describe("markdownlint/dependency-table-format", () => {
	it("passes a well-formed table", () => {
		expect(check(table("| effect | dependency | updated | 3.18.0 | 3.19.1 |"))).toEqual([]);
	});

	it("passes an em-dash sentinel for an addition", () => {
		expect(check(table("| new-pkg | dependency | added | — | ^1.0.0 |"))).toEqual([]);
	});

	it("rejects an invalid version", () => {
		const errors = check(table("| effect | dependency | updated | not-a-version | 3.19.1 |"));
		expect(errors.some((e) => e.includes("Invalid 'from' value"))).toBe(true);
	});

	it("rejects an invalid dependency type", () => {
		const errors = check(table("| effect | bogusType | updated | 3.18.0 | 3.19.1 |"));
		expect(errors.some((e) => e.includes("Invalid dependency type"))).toBe(true);
	});

	// --- issue #367 -----------------------------------------------------------
	// The micromark token carries raw source, so backslash escapes reach the rule
	// intact. The sibling remark rule validates the parsed tree, where the parser
	// has already resolved them. Both must agree about the same file.
	describe("backslash escapes are resolved before validation (issue #367)", () => {
		it("accepts a tilde range written with the legacy escape", () => {
			expect(check(table("| @effected/semver | dependency | updated | \\~0.2.0 | \\~0.2.1 |"))).toEqual([]);
		});

		it("accepts an underscore package name written with the legacy escape", () => {
			expect(check(table("| some\\_pkg | dependency | updated | 1.0.0 | 2.0.0 |"))).toEqual([]);
		});

		it("accepts an unescaped tilde range, as the fixed serializer now writes it", () => {
			expect(check(table("| @effected/semver | dependency | updated | ~0.2.0 | ~0.2.1 |"))).toEqual([]);
		});

		it("still rejects a genuinely invalid version that merely contains an escape", () => {
			const errors = check(table("| effect | dependency | updated | \\~not-a-version | 3.19.1 |"));
			expect(errors.some((e) => e.includes("Invalid 'from' value"))).toBe(true);
		});
	});
});
