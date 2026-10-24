/**
 * Lint rule: changeset-dependency-table-format (CSH005).
 *
 * @remarks
 * Kit twin of `DependencyTableFormatRule`. A `## Dependencies` section must
 * contain a table anywhere before the next heading (prose may precede or
 * follow it); a section without one reports at the heading. The table must
 * parse through `parseDependencyTable` (columns, types, actions), and the
 * em-dash rules apply: `from` is `—` when `added`, `to` is `—` when
 * `removed`. Table-level findings anchor at the table.
 *
 * @internal
 */

import { Mdast } from "@effected/markdown";
import { RULE_DOCS } from "../constants.js";
import type { RootChild } from "../utils/blocks.js";
import { scanDependencySection } from "../utils/dependency-section.js";
import { parseDependencyTable } from "../utils/dependency-table.js";
import type { LintRule, RuleFinding } from "./types.js";
import { finding } from "./types.js";

const RULE = "changeset-dependency-table-format";

const EM_DASH = "—";

/**
 * Validate the structure and semantics of `## Dependencies` tables.
 *
 * @internal
 */
export const dependencyTableFormat: LintRule = (root) => {
	const findings: RuleFinding[] = [];

	root.children.forEach((node, index) => {
		if (node.type !== "heading" || node.depth !== 2) return;
		if (Mdast.toText(node).toLowerCase() !== "dependencies") return;

		// Shared section-scanning decision (issues #456/#457): see utils/dependency-section.ts.
		const scan = scanDependencySection<RootChild>(root.children, index + 1, {
			isHeading: (n) => n.type === "heading",
			isTable: (n) => n.type === "table",
		});

		const table = scan.table;
		if (table === undefined || table.type !== "table") {
			findings.push(
				finding(
					RULE,
					`Dependencies section must contain a table, not a list or paragraph. See: ${RULE_DOCS.CSH005}`,
					node,
				),
			);
			return;
		}

		try {
			const rows = parseDependencyTable(table);
			for (const row of rows) {
				if (row.action === "added" && row.from !== EM_DASH) {
					findings.push(
						finding(
							RULE,
							`'from' must be '—' when action is 'added' (got '${row.from}'). See: ${RULE_DOCS.CSH005}`,
							table,
						),
					);
				}
				if (row.action === "removed" && row.to !== EM_DASH) {
					findings.push(
						finding(
							RULE,
							`'to' must be '—' when action is 'removed' (got '${row.to}'). See: ${RULE_DOCS.CSH005}`,
							table,
						),
					);
				}
			}
		} catch (error) {
			findings.push(
				finding(RULE, `${error instanceof Error ? error.message : String(error)}. See: ${RULE_DOCS.CSH005}`, table),
			);
		}
	});

	return findings;
};
