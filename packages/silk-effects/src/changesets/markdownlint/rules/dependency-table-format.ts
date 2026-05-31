import type { MicromarkToken, Rule } from "markdownlint";

import { RULE_DOCS, getHeadingLevel, getHeadingText } from "./utils.js";

/**
 * markdownlint rule: `changeset-dependency-table-format` (CSH005).
 *
 * Validates that `## Dependencies` sections in changeset files contain a
 * properly structured GFM markdown table with the correct column layout,
 * dependency types, actions, and version / sentinel values.
 *
 * @remarks
 * The rule inspects the micromark token tree for `atxHeading` tokens whose
 * text is "Dependencies" (case-insensitive). For each match it verifies:
 *
 * - The section contains a `table` token (not a list or paragraph).
 * - The table header row has exactly five columns:
 *   `Dependency | Type | Action | From | To`.
 * - Each data row has a non-empty dependency name.
 * - The `Type` cell is one of: `dependency`, `devDependency`,
 *   `peerDependency`, `optionalDependency`, `workspace`, `config`.
 * - The `Action` cell is one of: `added`, `updated`, `removed`.
 * - `From` and `To` cells match a semver string or the em-dash sentinel
 *   (`\u2014`).
 * - Semantic consistency: `added` requires `From` = `\u2014`; `removed`
 *   requires `To` = `\u2014`.
 *
 * The GFM table token types (`tableHead`, `tableBody`, `tableRow`,
 * `tableHeader`, `tableData`, `tableContent`) are defined in
 * `micromark-extension-gfm-table` as a `TokenTypeMap` augmentation. Since
 * that package is a transitive dependency and not directly imported here, the
 * module uses a widened `AnyToken` type to compare token types as strings and
 * avoid TS2367 errors.
 *
 * This rule mirrors the remark-lint rule `remarkLintDependencyTableFormat`
 * but uses markdownlint's micromark token API so it can run inside
 * markdownlint-cli2 and the VS Code markdownlint extension.
 *
 * @example
 * ```json
 * {
 *   "changeset-dependency-table-format": true
 * }
 * ```
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH005.md | CSH005 rule documentation}
 * @see `src/remark/rules/dependency-table-format.ts` for the corresponding remark-lint rule
 *
 * @public
 */

// biome-ignore lint/suspicious/noExplicitAny: intentional widening — GFM table token types extend TokenTypeMap via a transitive package not imported here
type AnyToken = MicromarkToken & { type: any };

const EM_DASH = "\u2014";

const VALID_TYPES = new Set([
	"dependency",
	"devDependency",
	"peerDependency",
	"optionalDependency",
	"workspace",
	"config",
]);

const VALID_ACTIONS = new Set(["added", "updated", "removed"]);

const EXPECTED_HEADERS = ["dependency", "type", "action", "from", "to"];

// Must stay in sync with VersionOrEmptySchema in src/schemas/dependency-table.ts
// Uses non-overlapping groups to avoid polynomial backtracking (CodeQL warning).
// The prerelease suffix requires a leading [-+.] delimiter before word chars,
// preventing overlap between the final \d+ and the suffix character class.
const VERSION_RE = /^(\u2014|[~^]?\d+\.\d+\.\d+(?:[-+.][\w.+-]*)?)$/;

/**
 * Extract text from a `tableHeader` or `tableData` cell token.
 *
 * The cell contains: `tableCellDivider`, whitespace, `tableContent`, whitespace.
 * The `tableContent` token has a `.text` property with the cell value.
 *
 * @param cell - A GFM table cell token (header or data)
 * @returns The trimmed text content of the cell, or an empty string
 *
 * @internal
 */
function getCellText(cell: AnyToken): string {
	const content = (cell.children as AnyToken[]).find((c) => c.type === "tableContent");
	return content ? content.text.trim() : "";
}

/**
 * Extract all cell texts from a `tableRow` token.
 *
 * @param row - A GFM `tableRow` token
 * @returns An array of trimmed cell text values
 *
 * @internal
 */
function getRowCells(row: AnyToken): string[] {
	return (row.children as AnyToken[])
		.filter((c) => c.type === "tableHeader" || c.type === "tableData")
		.map(getCellText);
}

/**
 * The markdownlint `Rule` object for CSH005 (`changeset-dependency-table-format`).
 *
 * @public
 */
export const DependencyTableFormatRule: Rule = {
	names: ["changeset-dependency-table-format", "CSH005"],
	description: "Dependencies section must contain a valid dependency table",
	tags: ["changeset"],
	parser: "micromark",
	function: function CSH005(params, onError) {
		const tokens = params.parsers.micromark.tokens;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];

			// Find h2 headings
			if (token.type !== "atxHeading") {
				continue;
			}
			if (getHeadingLevel(token) !== 2) {
				continue;
			}
			if (getHeadingText(token).toLowerCase() !== "dependencies") {
				continue;
			}

			const headingLine = token.startLine;

			// Scan forward past lineEnding/lineEndingBlank to find the next block
			let tableToken: AnyToken | null = null;

			for (let j = i + 1; j < tokens.length; j++) {
				const next = tokens[j] as AnyToken;

				if (next.type === "lineEnding" || next.type === "lineEndingBlank") {
					continue;
				}

				// If we hit another heading, the section has no table content
				if (next.type === "atxHeading") {
					break;
				}

				if (next.type === "table") {
					tableToken = next;
				}
				// list, paragraph, codeFenced, etc. — not a table; leave tableToken null
				break;
			}

			if (tableToken === null) {
				onError({
					lineNumber: headingLine,
					detail: `Dependencies section must contain a table, not a list or paragraph. See: ${RULE_DOCS.CSH005}`,
				});
				continue;
			}

			// Validate table structure
			const tableHead = (tableToken.children as AnyToken[]).find((c) => c.type === "tableHead");
			if (!tableHead) {
				onError({
					lineNumber: tableToken.startLine,
					detail: `Dependencies table is missing a header row. See: ${RULE_DOCS.CSH005}`,
				});
				continue;
			}

			// Get header row (first tableRow inside tableHead)
			const headerRow = (tableHead.children as AnyToken[]).find((c) => c.type === "tableRow");
			if (!headerRow) {
				onError({
					lineNumber: tableToken.startLine,
					detail: `Dependencies table is missing a header row. See: ${RULE_DOCS.CSH005}`,
				});
				continue;
			}

			// Validate column headers
			const headers = getRowCells(headerRow).map((h) => h.toLowerCase());
			if (headers.length !== EXPECTED_HEADERS.length || !headers.every((h, idx) => h === EXPECTED_HEADERS[idx])) {
				onError({
					lineNumber: headerRow.startLine,
					detail: `Dependencies table must have columns: Dependency, Type, Action, From, To. Got: ${headers.join(", ")}. See: ${RULE_DOCS.CSH005}`,
				});
				continue;
			}

			// Validate data rows from tableBody
			const tableBody = (tableToken.children as AnyToken[]).find((c) => c.type === "tableBody");
			if (!tableBody) {
				onError({
					lineNumber: tableToken.startLine,
					detail: `Dependencies table must have at least one data row. See: ${RULE_DOCS.CSH005}`,
				});
				continue;
			}

			const dataRows = (tableBody.children as AnyToken[]).filter((c) => c.type === "tableRow");
			if (dataRows.length === 0) {
				onError({
					lineNumber: tableToken.startLine,
					detail: `Dependencies table must have at least one data row. See: ${RULE_DOCS.CSH005}`,
				});
				continue;
			}

			for (const row of dataRows) {
				const cells = getRowCells(row);
				if (cells.length < 5) {
					onError({
						lineNumber: row.startLine,
						detail: `Dependencies table row has too few columns (expected 5, got ${cells.length}). See: ${RULE_DOCS.CSH005}`,
					});
					continue;
				}

				const [dependency, type, action, from, to] = cells;

				// Validate dependency name (non-empty)
				if (!dependency) {
					onError({
						lineNumber: row.startLine,
						detail: `Dependencies table row has an empty 'Dependency' cell. See: ${RULE_DOCS.CSH005}`,
					});
				}

				// Validate type
				if (!VALID_TYPES.has(type)) {
					onError({
						lineNumber: row.startLine,
						detail: `Invalid dependency type '${type}'. Valid types are: ${[...VALID_TYPES].join(", ")}. See: ${RULE_DOCS.CSH005}`,
					});
				}

				// Validate action
				if (!VALID_ACTIONS.has(action)) {
					onError({
						lineNumber: row.startLine,
						detail: `Invalid dependency action '${action}'. Valid actions are: ${[...VALID_ACTIONS].join(", ")}. See: ${RULE_DOCS.CSH005}`,
					});
				}

				// Validate version format (from/to)
				if (from && !VERSION_RE.test(from)) {
					onError({
						lineNumber: row.startLine,
						detail: `Invalid 'from' value '${from}'. Must be a semver string or em dash (\u2014). See: ${RULE_DOCS.CSH005}`,
					});
				}

				if (to && !VERSION_RE.test(to)) {
					onError({
						lineNumber: row.startLine,
						detail: `Invalid 'to' value '${to}'. Must be a semver string or em dash (\u2014). See: ${RULE_DOCS.CSH005}`,
					});
				}

				// Semantic validation: from/to must match action
				if (action === "added" && from !== EM_DASH) {
					onError({
						lineNumber: row.startLine,
						detail: `'from' must be '\u2014' when action is 'added' (got '${from}'). See: ${RULE_DOCS.CSH005}`,
					});
				}

				if (action === "removed" && to !== EM_DASH) {
					onError({
						lineNumber: row.startLine,
						detail: `'to' must be '\u2014' when action is 'removed' (got '${to}'). See: ${RULE_DOCS.CSH005}`,
					});
				}
			}
		}
	},
};
