/**
 * Lint rule: changeset-dependency-table-format (CSH005).
 *
 * @remarks
 * A `## Dependencies` section must contain a table anywhere before the next
 * heading (prose may precede or follow it); a section without one reports at
 * the heading. The table must parse through `parseDependencyTable` (columns,
 * types, actions), and the em-dash rules apply: `from` is `—` when `added`,
 * `to` is `—` when `removed`. Table-level findings anchor at the table.
 *
 * @internal
 */

import { Mdast } from "@effected/markdown";
import { LintRule } from "@effected/markdown-lint";
import { RULE_DOCS } from "../constants.js";
import type { RootChild } from "../utils/blocks.js";
import { scanDependencySection } from "../utils/dependency-section.js";
import { parseDependencyTable } from "../utils/dependency-table.js";
import { TAGS, bodyChildren, reportAt } from "./shared.js";

const EM_DASH = "—";

/**
 * `changeset-dependency-table-format` (CSH005): a `## Dependencies` section
 * holds one valid dependency table.
 *
 * @public
 */
export const DependencyTableFormatRule: LintRule = LintRule.make({
	names: ["changeset-dependency-table-format", "CSH005"],
	description: "Dependencies section must contain a valid dependency table",
	tags: TAGS,
	information: RULE_DOCS.CSH005,
	check: (context, report) => {
		const children = bodyChildren(context.root);
		children.forEach((node, index) => {
			if (node.type !== "heading" || node.depth !== 2) return;
			if (Mdast.toText(node).toLowerCase() !== "dependencies") return;

			// Shared section-scanning decision (issues #456/#457): see utils/dependency-section.ts.
			const scan = scanDependencySection<RootChild>(children, index + 1, {
				isHeading: (n) => n.type === "heading",
				isTable: (n) => n.type === "table",
			});

			const table = scan.table;
			if (table === undefined || table.type !== "table") {
				reportAt(
					context,
					report,
					node,
					`Dependencies section must contain a table, not a list or paragraph. See: ${RULE_DOCS.CSH005}`,
				);
				return;
			}

			try {
				for (const row of parseDependencyTable(table)) {
					if (row.action === "added" && row.from !== EM_DASH) {
						reportAt(
							context,
							report,
							table,
							`'from' must be '—' when action is 'added' (got '${row.from}'). See: ${RULE_DOCS.CSH005}`,
						);
					}
					if (row.action === "removed" && row.to !== EM_DASH) {
						reportAt(
							context,
							report,
							table,
							`'to' must be '—' when action is 'removed' (got '${row.to}'). See: ${RULE_DOCS.CSH005}`,
						);
					}
				}
			} catch (error) {
				reportAt(
					context,
					report,
					table,
					`${error instanceof Error ? error.message : String(error)}. See: ${RULE_DOCS.CSH005}`,
				);
			}
		});
	},
});
