/**
 * Dependency table utilities for parsing, serializing, collapsing, and sorting
 * dependency table rows between MDAST table nodes and typed representations.
 *
 * @remarks
 * This module provides the low-level functional primitives that the
 * {@link DependencyTable} class wraps with a stateful, fluent API.
 * It operates on arrays of `DependencyTableRow` objects and MDAST `Table`
 * nodes, converting between the two representations.
 *
 * The collapse algorithm merges rows sharing the same `dependency + type`
 * key, applying semantic rules (e.g., added then removed = net zero).
 * Sorting follows a stable order: removed, updated, added, then
 * alphabetically by type and dependency name.
 *
 * @see {@link DependencyTable} for the public class-based API
 *
 * @internal
 */

import { Schema } from "effect";
import type { Table, TableCell, TableRow } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import type { DependencyTableRow } from "../schemas/dependency-table.js";
import { DependencyTableRowSchema } from "../schemas/dependency-table.js";

/**
 * Ordered column headers for dependency tables.
 *
 * Defines the canonical header row: `Dependency | Type | Action | From | To`.
 *
 * @internal
 */
const COLUMN_HEADERS = ["Dependency", "Type", "Action", "From", "To"] as const;

/**
 * Property keys on {@link DependencyTableRow} corresponding to each column
 * in {@link COLUMN_HEADERS}.
 *
 * Used to map between positional table cells and typed object fields.
 *
 * @internal
 */
const COLUMN_KEYS: readonly (keyof DependencyTableRow)[] = ["dependency", "type", "action", "from", "to"] as const;

/** Schema decoder for validating raw cell values into a typed row. */
const decode = Schema.decodeUnknownSync(DependencyTableRowSchema);

/**
 * Parse an MDAST table node into validated dependency table rows.
 *
 * @remarks
 * Validates the header row against {@link COLUMN_HEADERS} (case-insensitive),
 * then decodes each data row through the `DependencyTableRowSchema` for
 * type-safe validation of action values, version strings, and dependency types.
 *
 * @param table - An MDAST `Table` node (from remark-gfm)
 * @returns Array of validated `DependencyTableRow` objects
 * @throws If the table has fewer than 2 rows (header + at least one data row)
 * @throws If the header columns do not match the expected column names
 * @throws If any data row fails schema validation
 *
 * @example
 * ```typescript
 * import { parseDependencyTable } from "../utils/dependency-table.js";
 * import { parseMarkdown } from "../utils/remark-pipeline.js";
 * import type { Table } from "mdast";
 *
 * const tree = parseMarkdown("| Dependency | Type | Action | From | To |\n| --- | --- | --- | --- | --- |\n| foo | dependency | added | — | 1.0.0 |");
 * const table = tree.children.find((n) => n.type === "table") as Table;
 * const rows = parseDependencyTable(table);
 * // rows[0].dependency === "foo"
 * ```
 *
 * @internal
 */
export function parseDependencyTable(table: Table): DependencyTableRow[] {
	const rows = table.children;
	if (rows.length < 2) {
		throw new Error("Dependency table must have at least one data row");
	}

	// Validate header row
	const headerRow = rows[0];
	const headers = headerRow.children.map((cell) => mdastToString(cell).trim().toLowerCase());
	const expected = COLUMN_HEADERS.map((h) => h.toLowerCase());

	if (headers.length !== expected.length || !headers.every((h, i) => h === expected[i])) {
		throw new Error(`Table must have columns: ${COLUMN_HEADERS.join(", ")}. Got: ${headers.join(", ")}`);
	}

	// Parse data rows
	const result: DependencyTableRow[] = [];
	for (let i = 1; i < rows.length; i++) {
		const cells = rows[i].children;
		const raw: Record<string, string> = {};
		for (let c = 0; c < COLUMN_KEYS.length; c++) {
			raw[COLUMN_KEYS[c]] = mdastToString(cells[c]).trim();
		}
		result.push(decode(raw));
	}

	return result;
}

/**
 * Create a table cell with a text node.
 *
 * @param text - The cell text content
 * @returns An MDAST `TableCell` node
 *
 * @internal
 */
function makeCell(text: string): TableCell {
	return {
		type: "tableCell",
		children: [{ type: "text", value: text }],
	};
}

/**
 * Create a table row from an array of cell texts.
 *
 * @param texts - Array of cell text values
 * @returns An MDAST `TableRow` node
 *
 * @internal
 */
function makeRow(texts: string[]): TableRow {
	return {
		type: "tableRow",
		children: texts.map(makeCell),
	};
}

/**
 * Serialize dependency table rows into an MDAST `Table` node.
 *
 * @remarks
 * Creates a well-formed GFM table with the canonical header row
 * ({@link COLUMN_HEADERS}) followed by one data row per entry.
 * The inverse of {@link parseDependencyTable}.
 *
 * @param rows - Array of `DependencyTableRow` objects
 * @returns An MDAST `Table` node ready for insertion into an AST
 *
 * @example
 * ```typescript
 * import { serializeDependencyTable } from "../utils/dependency-table.js";
 * import type { DependencyTableRow } from "../schemas/dependency-table.js";
 *
 * const rows: DependencyTableRow[] = [
 *   { dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.0" },
 * ];
 * const table = serializeDependencyTable(rows);
 * // table.type === "table"
 * // table.children.length === 2 (header + 1 data row)
 * ```
 *
 * @internal
 */
export function serializeDependencyTable(rows: DependencyTableRow[]): Table {
	const headerRow = makeRow([...COLUMN_HEADERS]);
	const dataRows = rows.map((row) => makeRow(COLUMN_KEYS.map((key) => row[key])));

	return {
		type: "table",
		children: [headerRow, ...dataRows],
	};
}

/**
 * Serialize dependency table rows to a markdown table string.
 *
 * @remarks
 * Combines {@link serializeDependencyTable} with unified/remark-gfm/remark-stringify
 * to produce a ready-to-use GFM markdown table string. The result is trimmed
 * of leading/trailing whitespace.
 *
 * @param rows - Array of `DependencyTableRow` objects
 * @returns Markdown table string (GFM format)
 *
 * @example
 * ```typescript
 * import { serializeDependencyTableToMarkdown } from "../utils/dependency-table.js";
 * import type { DependencyTableRow } from "../schemas/dependency-table.js";
 *
 * const rows: DependencyTableRow[] = [
 *   { dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.0" },
 * ];
 * const md = serializeDependencyTableToMarkdown(rows);
 * // "| Dependency | Type | Action | From | To |\n| --- | --- | ..."
 * ```
 *
 * @internal
 */
export function serializeDependencyTableToMarkdown(rows: DependencyTableRow[]): string {
	const table = serializeDependencyTable(rows);
	const tree = { type: "root" as const, children: [table] };
	return unified().use(remarkGfm).use(remarkStringify).stringify(tree).trim();
}

/**
 * Sort priority for dependency actions: removed first, then updated, then added.
 *
 * @remarks
 * Used by {@link sortDependencyRows} for primary sort ordering. The numeric
 * values define the sort position (lower = earlier in the sorted output).
 *
 * @internal
 */
const ACTION_ORDER: Record<string, number> = { removed: 0, updated: 1, added: 2 };

/**
 * Collapse dependency table rows with the same `dependency + type` key.
 *
 * @remarks
 * When multiple changelog entries affect the same dependency, this function
 * merges them into a single row using semantic collapse rules. Rows are
 * grouped by a composite key of `dependency\0type` (null-byte separated).
 *
 * The collapse rules applied by {@link collapseTwo} are:
 *
 * | First action | Second action | Result |
 * |---|---|---|
 * | `updated` | `updated` | `updated` (earliest `from`, latest `to`) |
 * | `added` | `updated` | `added` (final `to`) |
 * | `added` | `removed` | dropped (net zero change) |
 * | `updated` | `removed` | `removed` (original `from`) |
 * | `removed` | `added` | `updated` (original `from`, new `to`) |
 * | other | other | keep later entry |
 *
 * @param rows - Array of `DependencyTableRow` objects (in chronological order)
 * @returns Collapsed array with at most one row per `dependency + type` pair
 *
 * @example
 * ```typescript
 * import { collapseDependencyRows } from "../utils/dependency-table.js";
 * import type { DependencyTableRow } from "../schemas/dependency-table.js";
 *
 * const rows: DependencyTableRow[] = [
 *   { dependency: "effect", type: "dependency", action: "updated", from: "3.17.0", to: "3.18.0" },
 *   { dependency: "effect", type: "dependency", action: "updated", from: "3.18.0", to: "3.19.0" },
 * ];
 * const collapsed = collapseDependencyRows(rows);
 * // collapsed[0].from === "3.17.0", collapsed[0].to === "3.19.0"
 * ```
 *
 * @see {@link DependencyTable} for the public API that wraps this function
 *
 * @internal
 */
export function collapseDependencyRows(rows: DependencyTableRow[]): DependencyTableRow[] {
	const groups = new Map<string, DependencyTableRow>();

	for (const row of rows) {
		const key = `${row.dependency}\0${row.type}`;
		const existing = groups.get(key);

		if (!existing) {
			groups.set(key, { ...row });
			continue;
		}

		const merged = collapseTwo(existing, row);
		if (merged === null) {
			groups.delete(key);
		} else {
			groups.set(key, merged);
		}
	}

	return [...groups.values()];
}

/**
 * Collapse two rows sharing the same `dependency + type` key into one,
 * or return `null` if they cancel out (net zero).
 *
 * @remarks
 * This is the core merge function called by {@link collapseDependencyRows}.
 * It applies the semantic collapse rules based on the action pair.
 * See {@link collapseDependencyRows} for the full rule table.
 *
 * @param first - The earlier (existing) row
 * @param second - The later (incoming) row
 * @returns The merged row, or `null` to drop the entry entirely
 *
 * @internal
 */
function collapseTwo(first: DependencyTableRow, second: DependencyTableRow): DependencyTableRow | null {
	const a = first.action;
	const b = second.action;

	if (a === "updated" && b === "updated") {
		return { ...first, to: second.to };
	}
	if (a === "added" && b === "updated") {
		return { ...first, to: second.to };
	}
	if (a === "added" && b === "removed") {
		return null; // net zero
	}
	if (a === "updated" && b === "removed") {
		return { ...first, action: "removed", to: "\u2014" };
	}
	if (a === "removed" && b === "added") {
		return { ...first, action: "updated", to: second.to };
	}

	// Contradictory or duplicate: keep later entry
	return { ...second };
}

/**
 * Sort dependency table rows into canonical display order.
 *
 * @remarks
 * Applies a three-level stable sort:
 * 1. **Action** — `removed` first, then `updated`, then `added`
 *    (per {@link ACTION_ORDER})
 * 2. **Type** — alphabetically (e.g., `config` before `dependency`)
 * 3. **Dependency name** — alphabetically within each action+type group
 *
 * Returns a new array; the input is not mutated.
 *
 * @param rows - Array of `DependencyTableRow` objects
 * @returns New sorted array
 *
 * @example
 * ```typescript
 * import { sortDependencyRows } from "../utils/dependency-table.js";
 * import type { DependencyTableRow } from "../schemas/dependency-table.js";
 *
 * const rows: DependencyTableRow[] = [
 *   { dependency: "zod", type: "dependency", action: "added", from: "\u2014", to: "3.0.0" },
 *   { dependency: "effect", type: "dependency", action: "removed", from: "3.19.0", to: "\u2014" },
 * ];
 * const sorted = sortDependencyRows(rows);
 * // sorted[0].dependency === "effect" (removed comes first)
 * ```
 *
 * @see {@link DependencyTable} for the public API that wraps this function
 *
 * @internal
 */
export function sortDependencyRows(rows: DependencyTableRow[]): DependencyTableRow[] {
	return [...rows].sort((a, b) => {
		const actionDiff = (ACTION_ORDER[a.action] ?? 99) - (ACTION_ORDER[b.action] ?? 99);
		if (actionDiff !== 0) return actionDiff;

		const typeDiff = a.type.localeCompare(b.type);
		if (typeDiff !== 0) return typeDiff;

		return a.dependency.localeCompare(b.dependency);
	});
}
