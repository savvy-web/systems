import type { Table } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import type { DependencyTableRow } from "../../src/changesets/schemas/dependency-table.js";
import {
	collapseDependencyRows,
	parseDependencyTable,
	serializeDependencyTable,
	serializeDependencyTableToMarkdown,
	sortDependencyRows,
} from "../../src/changesets/utils/dependency-table.js";
import { parseMarkdown, stringifyMarkdown } from "../../src/changesets/utils/remark-pipeline.js";

/** Parse markdown into MDAST and extract first table node. */
function getTable(md: string): Table {
	const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
	const table = tree.children.find((n) => n.type === "table");
	if (!table) throw new Error("No table found in markdown");
	return table as Table;
}

const VALID_TABLE = `| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| typescript | devDependency | updated | ^5.4.0 | ^5.6.0 |
| new-pkg | dependency | added | \u2014 | ^1.0.0 |
| old-pkg | dependency | removed | ^2.0.0 | \u2014 |`;

describe("parseDependencyTable", () => {
	it("parses a valid table into typed rows", () => {
		const rows = parseDependencyTable(getTable(VALID_TABLE));
		expect(rows).toHaveLength(3);
		expect(rows[0]).toEqual({
			dependency: "typescript",
			type: "devDependency",
			action: "updated",
			from: "^5.4.0",
			to: "^5.6.0",
		});
		expect(rows[1].action).toBe("added");
		expect(rows[1].from).toBe("\u2014");
		expect(rows[2].action).toBe("removed");
		expect(rows[2].to).toBe("\u2014");
	});

	it("is case-insensitive for column headers", () => {
		const md = `| dependency | type | action | from | to |
| --- | --- | --- | --- | --- |
| foo | dependency | updated | 1.0.0 | 2.0.0 |`;
		const rows = parseDependencyTable(getTable(md));
		expect(rows).toHaveLength(1);
	});

	it("throws on wrong number of columns", () => {
		const md = `| Dependency | Type | Action |
| --- | --- | --- |
| foo | dependency | updated |`;
		expect(() => parseDependencyTable(getTable(md))).toThrow(/columns/i);
	});

	it("throws on wrong column names", () => {
		const md = `| Package | Kind | Action | From | To |
| --- | --- | --- | --- | --- |
| foo | dependency | updated | 1.0.0 | 2.0.0 |`;
		expect(() => parseDependencyTable(getTable(md))).toThrow(/columns/i);
	});

	it("throws on invalid type value", () => {
		const md = `| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| foo | devDep | updated | 1.0.0 | 2.0.0 |`;
		expect(() => parseDependencyTable(getTable(md))).toThrow();
	});

	it("throws on empty table (header only)", () => {
		const md = `| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |`;
		expect(() => parseDependencyTable(getTable(md))).toThrow();
	});
});

describe("serializeDependencyTable", () => {
	it("produces a valid MDAST table node", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		];
		const table = serializeDependencyTable(rows);
		expect(table.type).toBe("table");
		// Header row + 1 data row
		expect(table.children).toHaveLength(2);
	});

	it("round-trips through parse", () => {
		const original: DependencyTableRow[] = [
			{ dependency: "typescript", type: "devDependency", action: "updated", from: "^5.4.0", to: "^5.6.0" },
			{ dependency: "new-pkg", type: "dependency", action: "added", from: "\u2014", to: "^1.0.0" },
			{ dependency: "node", type: "runtime", action: "updated", from: "25.6.0", to: "26.0.0" },
			{ dependency: "pnpm", type: "packageManager", action: "updated", from: "11.22.0", to: "11.23.0" },
		];
		const table = serializeDependencyTable(original);
		const parsed = parseDependencyTable(table);
		expect(parsed).toEqual(original);
	});
});

describe("serializeDependencyTableToMarkdown", () => {
	it("produces valid markdown table string", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		];
		const md = serializeDependencyTableToMarkdown(rows);
		expect(md).toMatch(/\|\s*Dependency\s*\|/);
		expect(md).toMatch(/\|\s*foo\s*\|/);
	});
});

describe("collapseDependencyRows", () => {
	it("collapses updated+updated to earliest from, latest to", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "devDependency", action: "updated", from: "^1.0.0", to: "^1.1.0" },
			{ dependency: "foo", type: "devDependency", action: "updated", from: "^1.1.0", to: "^1.2.0" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			dependency: "foo",
			type: "devDependency",
			action: "updated",
			from: "^1.0.0",
			to: "^1.2.0",
		});
	});

	it("collapses added+updated to added with final to", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "added", from: "\u2014", to: "^1.0.0" },
			{ dependency: "foo", type: "dependency", action: "updated", from: "^1.0.0", to: "^1.1.0" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("added");
		expect(result[0].from).toBe("\u2014");
		expect(result[0].to).toBe("^1.1.0");
	});

	it("drops added+removed (net zero)", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "added", from: "\u2014", to: "^1.0.0" },
			{ dependency: "foo", type: "dependency", action: "removed", from: "^1.0.0", to: "\u2014" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(0);
	});

	it("collapses updated+removed to removed with original from", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "updated", from: "^1.0.0", to: "^1.1.0" },
			{ dependency: "foo", type: "dependency", action: "removed", from: "^1.1.0", to: "\u2014" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("removed");
		expect(result[0].from).toBe("^1.0.0");
		expect(result[0].to).toBe("\u2014");
	});

	it("collapses removed+added to updated (re-added)", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "removed", from: "^1.0.0", to: "\u2014" },
			{ dependency: "foo", type: "dependency", action: "added", from: "\u2014", to: "^2.0.0" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("updated");
		expect(result[0].from).toBe("^1.0.0");
		expect(result[0].to).toBe("^2.0.0");
	});

	it("keeps rows with different dependency+type keys separate", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
			{ dependency: "bar", type: "devDependency", action: "updated", from: "3.0.0", to: "4.0.0" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(2);
	});

	it("handles contradictory removed+updated by keeping later entry", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "removed", from: "^1.0.0", to: "\u2014" },
			{ dependency: "foo", type: "dependency", action: "updated", from: "^1.0.0", to: "^2.0.0" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("updated");
	});

	it("handles contradictory updated+added by keeping later entry", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "updated", from: "^1.0.0", to: "^2.0.0" },
			{ dependency: "foo", type: "dependency", action: "added", from: "\u2014", to: "^3.0.0" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("added");
	});

	it("passes through single rows unchanged", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "foo", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		];
		const result = collapseDependencyRows(rows);
		expect(result).toEqual(rows);
	});
});

describe("sortDependencyRows", () => {
	it("sorts by action: removed, updated, added", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "c", type: "dependency", action: "added", from: "\u2014", to: "1.0.0" },
			{ dependency: "a", type: "dependency", action: "removed", from: "1.0.0", to: "\u2014" },
			{ dependency: "b", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		];
		const result = sortDependencyRows(rows);
		expect(result.map((r) => r.action)).toEqual(["removed", "updated", "added"]);
	});

	it("sorts by type alphabetically within same action", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "a", type: "workspace", action: "updated", from: "1.0.0", to: "2.0.0" },
			{ dependency: "b", type: "config", action: "updated", from: "1.0.0", to: "2.0.0" },
			{ dependency: "c", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		];
		const result = sortDependencyRows(rows);
		expect(result.map((r) => r.type)).toEqual(["config", "dependency", "workspace"]);
	});

	it("sorts by dependency name alphabetically within same action+type", () => {
		const rows: DependencyTableRow[] = [
			{ dependency: "zlib", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
			{ dependency: "axios", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
			{ dependency: "moment", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		];
		const result = sortDependencyRows(rows);
		expect(result.map((r) => r.dependency)).toEqual(["axios", "moment", "zlib"]);
	});
});

describe("dependency table cells survive the canonical escaping", () => {
	/**
	 * Cells whose characters the canonical stringifier escapes in the raw
	 * bytes. The escaping is a spelling, not a value change: parsing consumes
	 * the backslashes, so cell VALUES round-trip byte-identically and never
	 * accumulate escape layers across emit/parse cycles.
	 */
	const ESCAPE_BAIT: DependencyTableRow[] = [
		{ dependency: "@effected/semver", type: "dependency", action: "updated", from: "~0.2.0", to: "~0.2.1" },
		{ dependency: "some_pkg", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		{ dependency: "_private", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
	];

	it("escapes ~ and word-edge _ in the raw bytes (canonical form)", () => {
		// @effected/markdown >= 0.8.0 escapes minimally: `_` between two
		// alphanumerics is not markup, so it stays raw; at a word edge it
		// still escapes. `~` always escapes.
		const md = serializeDependencyTableToMarkdown(ESCAPE_BAIT);
		expect(md).toContain("\\~0.2.0");
		expect(md).toContain("\\~0.2.1");
		expect(md).toContain("| some_pkg |");
		expect(md).toContain("| \\_private |");
	});

	it("round-trips cell values byte-identically through markdown", () => {
		const md = serializeDependencyTableToMarkdown(ESCAPE_BAIT);
		expect(parseDependencyTable(getTable(md))).toEqual(ESCAPE_BAIT);
	});

	it("does not accumulate escape layers across emit/parse cycles", () => {
		const first = serializeDependencyTableToMarkdown(ESCAPE_BAIT);
		const reparsed = parseDependencyTable(getTable(first));
		const second = serializeDependencyTableToMarkdown(reparsed);
		expect(second).toBe(first);
	});

	it("escapes a pipe so it cannot break out of its cell", () => {
		const withPipe: DependencyTableRow[] = [
			{ dependency: "weird|name", type: "dependency", action: "updated", from: "1.0.0", to: "2.0.0" },
		];
		const md = serializeDependencyTableToMarkdown(withPipe);
		expect(parseDependencyTable(getTable(md))[0]?.dependency).toBe("weird|name");
	});

	it("still escapes markdown in ordinary prose outside a table", () => {
		const tree = parseMarkdown("bumped _private and some_snake_case today\n");
		const md = stringifyMarkdown(tree);
		expect(md).toContain("\\_private");
		expect(md).toContain("some_snake_case");
	});

	it("emits the same cell escaping when the table is part of a document", () => {
		// The aggregate-dependency-tables plugin inserts the mdast node into a
		// changeset AST, which is stringified through the shared emit boundary,
		// so document-level and standalone serialization agree byte-for-byte.
		const table = serializeDependencyTable(ESCAPE_BAIT);
		const md = stringifyMarkdown({ type: "root", children: [table] });
		expect(md.trim()).toBe(serializeDependencyTableToMarkdown(ESCAPE_BAIT));
	});
});
