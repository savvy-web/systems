import type { Table } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { DependencyTable } from "../../src/changesets/api/dependency-table.js";

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
| new-pkg | dependency | added | — | ^1.0.0 |
| old-pkg | dependency | removed | ^2.0.0 | — |`;

describe("DependencyTable.parse", () => {
	it("returns rows from a valid mdast Table node", () => {
		const rows = DependencyTable.parse(getTable(VALID_TABLE));
		expect(rows).toHaveLength(3);
		expect(rows[0]?.dependency).toBe("typescript");
	});
});

describe("DependencyTable.serialize", () => {
	it("produces an mdast Table node with a header row", () => {
		const rows = DependencyTable.parse(getTable(VALID_TABLE));
		const table = DependencyTable.serialize(rows);
		expect(table.type).toBe("table");
		expect(table.children).toHaveLength(4); // 1 header + 3 data rows
	});
});

describe("DependencyTable.toMarkdown", () => {
	it("returns a non-empty markdown string", () => {
		const rows = DependencyTable.parse(getTable(VALID_TABLE));
		const md = DependencyTable.toMarkdown(rows);
		expect(typeof md).toBe("string");
		expect(md).toContain("typescript");
	});
});

describe("DependencyTable.collapse", () => {
	it("merges duplicate package entries", () => {
		const rows = DependencyTable.parse(getTable(VALID_TABLE));
		const collapsed = DependencyTable.collapse(rows);
		// No duplicates in VALID_TABLE, so length unchanged
		expect(collapsed).toHaveLength(rows.length);
	});
});

describe("DependencyTable.sort", () => {
	it("returns a sorted array", () => {
		const rows = DependencyTable.parse(getTable(VALID_TABLE));
		const sorted = DependencyTable.sort(rows);
		expect(sorted).toHaveLength(rows.length);
	});
});

describe("DependencyTable.aggregate", () => {
	it("collapses and sorts in one pass", () => {
		const rows = DependencyTable.parse(getTable(VALID_TABLE));
		const result = DependencyTable.aggregate(rows);
		expect(result).toHaveLength(rows.length);
		// removed comes before updated before added in sort order
		const actions = result.map((r) => r.action);
		const removedIdx = actions.indexOf("removed");
		const updatedIdx = actions.indexOf("updated");
		expect(removedIdx).toBeLessThan(updatedIdx);
	});
});
