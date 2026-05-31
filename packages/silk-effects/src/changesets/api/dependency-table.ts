/**
 * Class-based API for dependency table operations.
 *
 * Provides static methods for parsing, serializing, collapsing, sorting,
 * and aggregating dependency table data used in changelog "Dependencies"
 * sections.
 *
 * @internal
 */

import type { Table } from "mdast";

import type { DependencyTableRow } from "../schemas/dependency-table.js";
import {
	collapseDependencyRows,
	parseDependencyTable,
	serializeDependencyTable,
	serializeDependencyTableToMarkdown,
	sortDependencyRows,
} from "../utils/dependency-table.js";

/**
 * Static class for dependency table manipulation.
 *
 * Wraps the internal utility functions that operate on dependency tables --
 * the structured markdown tables that appear in the "Dependencies" section
 * of changelogs. Each row in a dependency table represents a single package
 * change with its name, type, action, and version transition.
 *
 * @remarks
 * The typical workflow for processing dependency tables is:
 *
 * 1. **Parse** an mdast `Table` node into typed {@link DependencyTableRow} objects
 * 2. **Collapse** duplicate rows (same package updated multiple times) into single entries
 * 3. **Sort** rows by dependency type, then alphabetically by package name
 * 4. **Serialize** back to an mdast `Table` node or directly to a markdown string
 *
 * The {@link DependencyTable.aggregate} method combines the collapse and sort
 * steps into a single call, which is the most common usage pattern.
 *
 * Each {@link DependencyTableRow} is validated by the {@link DependencyTableRowSchema}
 * Effect Schema at system boundaries, ensuring that dependency names, types,
 * actions, and version strings conform to expected formats.
 *
 * @example Parse, aggregate, and serialize a dependency table
 * ```typescript
 * import { DependencyTable } from "\@savvy-web/changesets";
 * import type { DependencyTableRow } from "\@savvy-web/changesets";
 * import type { Table } from "mdast";
 *
 * // Given an mdast Table node from a parsed CHANGELOG
 * declare const tableNode: Table;
 *
 * // Parse into typed rows
 * const rows: DependencyTableRow[] = DependencyTable.parse(tableNode);
 *
 * // Collapse duplicates and sort by type, then name
 * const aggregated: DependencyTableRow[] = DependencyTable.aggregate(rows);
 *
 * // Serialize back to an mdast Table node for further AST manipulation
 * const outputNode: Table = DependencyTable.serialize(aggregated);
 *
 * // Or serialize directly to a markdown string
 * const markdown: string = DependencyTable.toMarkdown(aggregated);
 * ```
 *
 * @example Step-by-step collapse and sort
 * ```typescript
 * import { DependencyTable } from "\@savvy-web/changesets";
 * import type { DependencyTableRow } from "\@savvy-web/changesets";
 *
 * declare const rows: DependencyTableRow[];
 *
 * // Collapse duplicate entries (same package appears multiple times)
 * const collapsed: DependencyTableRow[] = DependencyTable.collapse(rows);
 *
 * // Sort by dependency type, then alphabetically by name
 * const sorted: DependencyTableRow[] = DependencyTable.sort(collapsed);
 * ```
 *
 * @see {@link DependencyTableRow} for the row shape (dependency, type, action, from, to)
 * @see {@link DependencyTableRowSchema} for the Effect Schema that validates row data
 * @see {@link DependencyTableSchema} for the non-empty array schema
 *
 * @public
 */
export class DependencyTable {
	/* v8 ignore next -- private constructor prevents direct instantiation */
	private constructor() {}

	/**
	 * Parse an mdast `Table` node into typed dependency table rows.
	 *
	 * @remarks
	 * Extracts the text content from each table cell and maps it to the
	 * corresponding {@link DependencyTableRow} fields. The first row is
	 * treated as the header and skipped. Rows that do not have the expected
	 * number of columns are ignored.
	 *
	 * @param tableNode - An mdast `Table` node from a parsed markdown AST
	 * @returns Array of {@link DependencyTableRow} objects, one per data row
	 */
	static parse(tableNode: Table): DependencyTableRow[] {
		return parseDependencyTable(tableNode);
	}

	/**
	 * Serialize typed dependency table rows into an mdast `Table` node.
	 *
	 * @remarks
	 * Produces a well-formed mdast `Table` with a header row
	 * (`Dependency | Type | Action | From | To`) followed by one data row
	 * per input entry. The resulting node can be inserted into a remark AST
	 * for further processing or stringification.
	 *
	 * @param rows - Array of {@link DependencyTableRow} objects to serialize
	 * @returns An mdast `Table` node ready for AST insertion
	 */
	static serialize(rows: DependencyTableRow[]): Table {
		return serializeDependencyTable(rows);
	}

	/**
	 * Serialize typed dependency table rows directly to a markdown string.
	 *
	 * @remarks
	 * Convenience method that combines {@link DependencyTable.serialize} with
	 * remark stringification. Produces a GFM-compatible markdown table string.
	 *
	 * @param rows - Array of {@link DependencyTableRow} objects to render
	 * @returns A markdown string containing the formatted table
	 */
	static toMarkdown(rows: DependencyTableRow[]): string {
		return serializeDependencyTableToMarkdown(rows);
	}

	/**
	 * Collapse duplicate dependency rows into single entries.
	 *
	 * @remarks
	 * When a package appears in multiple rows (e.g., updated in separate
	 * changesets), this method merges them by keeping the earliest `from`
	 * version and the latest `to` version, producing a single row that
	 * represents the net change.
	 *
	 * @param rows - Array of {@link DependencyTableRow} objects, possibly with duplicates
	 * @returns A new array with duplicate packages collapsed into single rows
	 */
	static collapse(rows: DependencyTableRow[]): DependencyTableRow[] {
		return collapseDependencyRows(rows);
	}

	/**
	 * Sort dependency rows by action, type, and package name.
	 *
	 * @remarks
	 * Applies a three-level stable sort:
	 * 1. **Action** — `removed` first, then `updated`, then `added`
	 * 2. **Type** — alphabetically (e.g., `config` before `dependency`)
	 * 3. **Dependency name** — alphabetically within each action+type group
	 *
	 * @param rows - Array of {@link DependencyTableRow} objects to sort
	 * @returns A new array sorted by action, type, then name
	 */
	static sort(rows: DependencyTableRow[]): DependencyTableRow[] {
		return sortDependencyRows(rows);
	}

	/**
	 * Collapse duplicate rows and then sort the result.
	 *
	 * @remarks
	 * Equivalent to calling {@link DependencyTable.collapse} followed by
	 * {@link DependencyTable.sort}. This is the recommended method for
	 * preparing dependency table data for final output, as it produces
	 * a clean, deduplicated, and consistently ordered table.
	 *
	 * @param rows - Array of {@link DependencyTableRow} objects to aggregate
	 * @returns A new array with duplicates collapsed and rows sorted
	 */
	static aggregate(rows: DependencyTableRow[]): DependencyTableRow[] {
		return sortDependencyRows(collapseDependencyRows(rows));
	}
}
