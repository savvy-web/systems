import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { DependencyTableFormatRule } from "../../src/changesets/remark/rules/dependency-table-format.js";
import { REAL_WORLD_DEPENDENCY_SECTIONS } from "./fixtures__real-world-dependency-sections.js";

function lint(markdown: string) {
	const file = unified()
		.use(remarkParse)
		.use(remarkStringify)
		.use(remarkGfm)
		.use(DependencyTableFormatRule)
		.processSync(markdown);
	return file.messages.map((m) => m.message);
}

describe("dependency-table-format rule", () => {
	it("accepts a valid dependency table", () => {
		const md = `## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| typescript | devDependency | updated | ^5.4.0 | ^5.6.0 |
| new-pkg | dependency | added | \u2014 | ^1.0.0 |
`;
		expect(lint(md)).toEqual([]);
	});

	// Engine-agreement pin for the setext spelling: remark-parse normalizes a
	// setext level-2 heading to a depth-2 heading node, so this rule enforces
	// the section; the markdownlint sibling accepts setextHeading tokens for
	// the same reason. Both suites carry this pair so a drift is loud.
	describe("setext level-2 Dependencies heading (engine agreement)", () => {
		it("flags a table-less section under a setext heading", () => {
			const md = ["Dependencies", "------------", "", "Routine maintenance only.", ""].join("\n");
			const messages = lint(md);
			expect(messages.some((m) => m.includes("must contain a table"))).toBe(true);
		});

		it("accepts a valid table under a setext heading", () => {
			const md = [
				"Dependencies",
				"------------",
				"",
				"| Dependency | Type | Action | From | To |",
				"| --- | --- | --- | --- | --- |",
				"| effect | dependency | updated | 3.18.0 | 3.19.1 |",
				"",
			].join("\n");
			expect(lint(md)).toEqual([]);
		});
	});

	it("accepts a table with all types", () => {
		const md = `## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| a | dependency | updated | 1.0.0 | 2.0.0 |
| b | devDependency | updated | 1.0.0 | 2.0.0 |
| c | peerDependency | updated | 1.0.0 | 2.0.0 |
| d | optionalDependency | updated | 1.0.0 | 2.0.0 |
| e | workspace | updated | 1.0.0 | 2.0.0 |
| f | config | updated | 1.0.0 | 2.0.0 |
| node | runtime | updated | 25.6.0 | 26.0.0 |
| pnpm | packageManager | updated | 11.22.0 | 11.23.0 |
`;
		expect(lint(md)).toEqual([]);
	});

	it("ignores non-Dependencies sections", () => {
		const md = `## Features

- Added feature X
`;
		expect(lint(md)).toEqual([]);
	});

	it("reports error when Dependencies has a list instead of table", () => {
		const md = `## Dependencies

- foo: 1.0.0 → 2.0.0
`;
		const messages = lint(md);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0]).toContain("table");
	});

	it("reports error for wrong column names", () => {
		const md = `## Dependencies

| Package | Kind | Action | From | To |
| --- | --- | --- | --- | --- |
| foo | dependency | updated | 1.0.0 | 2.0.0 |
`;
		const messages = lint(md);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0]).toContain("columns");
	});

	it("reports error for invalid type value", () => {
		const md = `## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| foo | devDep | updated | 1.0.0 | 2.0.0 |
`;
		const messages = lint(md);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0]).toContain("devDep");
	});

	it("reports error when from is not em dash for added", () => {
		const md = `## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| foo | dependency | added | 1.0.0 | 2.0.0 |
`;
		const messages = lint(md);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0]).toContain("added");
	});

	it("reports error when to is not em dash for removed", () => {
		const md = `## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| foo | dependency | removed | 1.0.0 | 2.0.0 |
`;
		const messages = lint(md);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0]).toContain("removed");
	});

	it("reports error for empty table (no data rows)", () => {
		const md = `## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
`;
		const messages = lint(md);
		expect(messages.length).toBeGreaterThan(0);
	});

	// --- issues #456 / #457 ---------------------------------------------------
	// CSH005 accepts a valid dependency table ANYWHERE in the `## Dependencies`
	// section; prose may precede or follow it. This mirrors the markdownlint
	// rule so the two implementations of one documented rule cannot disagree.
	describe("table position within the section (issues #456/#457)", () => {
		const validTable = [
			"| Dependency | Type | Action | From | To |",
			"| --- | --- | --- | --- | --- |",
			"| effect | dependency | updated | 3.18.0 | 3.19.1 |",
		].join("\n");

		it("passes when prose precedes the table", () => {
			const md = `## Dependencies\n\nRoutine dependency maintenance.\n\n${validTable}\n`;
			expect(lint(md)).toEqual([]);
		});

		it("passes when prose follows the table", () => {
			const md = `## Dependencies\n\n${validTable}\n\nAll updates are backward compatible.\n`;
			expect(lint(md)).toEqual([]);
		});

		it("fails a prose-only section, reporting at the Dependencies heading", () => {
			const md = "## Dependencies\n\nUpdated effect to 3.19.1.\n";
			const file = unified()
				.use(remarkParse)
				.use(remarkStringify)
				.use(remarkGfm)
				.use(DependencyTableFormatRule)
				.processSync(md);
			expect(file.messages.length).toBe(1);
			expect(file.messages[0].message).toContain("must contain a table");
			// Anchored at the `## Dependencies` heading (line 1 here)
			expect(file.messages[0].line).toBe(1);
		});

		it("does not scan past the next heading for a table", () => {
			const md = `## Dependencies\n\nProse only.\n\n## Other\n\n${validTable}\n`;
			const messages = lint(md);
			expect(messages.some((m) => m.includes("must contain a table"))).toBe(true);
		});

		it("still validates a table found after prose", () => {
			const md = [
				"## Dependencies",
				"",
				"Routine maintenance.",
				"",
				"| Dependency | Type | Action | From | To |",
				"| --- | --- | --- | --- | --- |",
				"| foo | devDep | updated | 1.0.0 | 2.0.0 |",
				"",
			].join("\n");
			const messages = lint(md);
			expect(messages.some((m) => m.includes("devDep"))).toBe(true);
		});
	});

	it("includes rule documentation URL", () => {
		const md = `## Dependencies

- bad content
`;
		const file = unified()
			.use(remarkParse)
			.use(remarkStringify)
			.use(remarkGfm)
			.use(DependencyTableFormatRule)
			.processSync(md);
		expect(file.messages[0].message).toContain("CSH005");
	});

	// Real shipped shapes from savvy-web/silk-update-action (relayed during the
	// #456/#457 unification round). All exist in that repo's history and must
	// pass — see the fixture module for what each one pins.
	describe("real-world production shapes (silk-update-action)", () => {
		for (const [name, markdown] of REAL_WORLD_DEPENDENCY_SECTIONS) {
			it(`passes: ${name}`, () => {
				expect(lint(markdown)).toEqual([]);
			});
		}
	});
});
