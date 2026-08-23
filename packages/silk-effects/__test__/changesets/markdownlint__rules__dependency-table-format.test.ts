import { lint } from "markdownlint/sync";
import { describe, expect, it } from "vitest";
import { DependencyTableFormatRule } from "../../src/changesets/markdownlint/rules/dependency-table-format.js";
import { REAL_WORLD_DEPENDENCY_SECTIONS } from "./fixtures__real-world-dependency-sections.js";

function check(markdown: string) {
	const result = lint({
		strings: { test: markdown },
		customRules: [DependencyTableFormatRule],
		config: { default: false, CSH005: true },
	});
	return (result.test ?? []).map((e) => e.errorDetail ?? "");
}

function checkWithLines(markdown: string) {
	const result = lint({
		strings: { test: markdown },
		customRules: [DependencyTableFormatRule],
		config: { default: false, CSH005: true },
	});
	return (result.test ?? []).map((e) => ({ line: e.lineNumber, detail: e.errorDetail ?? "" }));
}

const VALID_TABLE = [
	"| Dependency | Type | Action | From | To |",
	"| --- | --- | --- | --- | --- |",
	"| effect | dependency | updated | 3.18.0 | 3.19.1 |",
].join("\n");

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

	it("passes runtime and packageManager rows (#544)", () => {
		expect(check(table("| node | runtime | updated | 25.6.0 | 26.0.0 |"))).toEqual([]);
		expect(check(table("| pnpm | packageManager | updated | 11.22.0 | 11.23.0 |"))).toEqual([]);
	});

	// A setext level-2 "Dependencies" heading (underlined with ---) is the same
	// documented heading to a reader; remark-parse normalizes setext to a plain
	// heading node so the remark engine already enforces the section. The
	// markdownlint scan must accept setextHeading tokens too, or the two
	// engines disagree about the same file.
	describe("setext level-2 Dependencies heading (engine agreement)", () => {
		it("flags a table-less section under a setext heading", () => {
			const md = ["Dependencies", "------------", "", "Routine maintenance only.", ""].join("\n");
			const errors = check(md);
			expect(errors.some((e) => e.includes("must contain a table"))).toBe(true);
		});

		it("passes a valid table under a setext heading", () => {
			const md = ["Dependencies", "------------", "", VALID_TABLE, ""].join("\n");
			expect(check(md)).toEqual([]);
		});

		it("ignores a setext level-1 Dependencies heading (wrong depth, same as atx)", () => {
			const md = ["Dependencies", "============", "", "Prose only.", ""].join("\n");
			expect(check(md)).toEqual([]);
		});
	});

	// --- issues #456 / #457 ---------------------------------------------------
	// CSH005 accepts a valid dependency table ANYWHERE in the `## Dependencies`
	// section; prose may precede or follow it. This mirrors the remark rule so
	// the two implementations of one documented rule cannot disagree.
	describe("table position within the section (issues #456/#457)", () => {
		it("passes when prose precedes the table", () => {
			const md = ["## Dependencies", "", "Routine dependency maintenance.", "", VALID_TABLE, ""].join("\n");
			expect(check(md)).toEqual([]);
		});

		it("passes when prose follows the table", () => {
			const md = ["## Dependencies", "", VALID_TABLE, "", "All updates are backward compatible.", ""].join("\n");
			expect(check(md)).toEqual([]);
		});

		it("fails a prose-only section, reporting at the Dependencies heading", () => {
			const md = ["## Dependencies", "", "Updated effect to 3.19.1.", ""].join("\n");
			const errors = checkWithLines(md);
			expect(errors.length).toBe(1);
			expect(errors[0].line).toBe(1);
			expect(errors[0].detail).toContain("must contain a table");
		});

		it("fails a list-only section, reporting at the Dependencies heading", () => {
			const md = ["## Dependencies", "", "- effect: 3.18.0 → 3.19.1", ""].join("\n");
			const errors = checkWithLines(md);
			expect(errors.length).toBe(1);
			expect(errors[0].line).toBe(1);
			expect(errors[0].detail).toContain("must contain a table");
		});

		it("does not scan past the next heading for a table", () => {
			const md = ["## Dependencies", "", "Prose only.", "", "## Other", "", VALID_TABLE, ""].join("\n");
			const errors = check(md);
			expect(errors.some((e) => e.includes("must contain a table"))).toBe(true);
		});

		it("still validates a table found after prose", () => {
			const md = [
				"## Dependencies",
				"",
				"Routine maintenance.",
				"",
				"| Dependency | Type | Action | From | To |",
				"| --- | --- | --- | --- | --- |",
				"| effect | bogusType | updated | 3.18.0 | 3.19.1 |",
				"",
			].join("\n");
			const errors = check(md);
			expect(errors.some((e) => e.includes("Invalid dependency type"))).toBe(true);
		});
	});

	// Real shipped shapes from savvy-web/silk-update-action (relayed during the
	// #456/#457 unification round). All exist in that repo's history and must
	// pass — see the fixture module for what each one pins.
	describe("real-world production shapes (silk-update-action)", () => {
		for (const [name, markdown] of REAL_WORLD_DEPENDENCY_SECTIONS) {
			it(`passes: ${name}`, () => {
				expect(check(markdown)).toEqual([]);
			});
		}
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
