import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { DependencyTableFormatRule } from "../../src/changesets/remark/rules/dependency-table-format.js";

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
});
