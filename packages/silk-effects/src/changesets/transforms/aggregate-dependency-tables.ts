/**
 * Changelog transform: aggregate dependency tables.
 *
 * @remarks
 * Kit transform. Consolidates every
 * `### Dependencies` section within a version block into one section holding
 * a single collapsed and sorted table:
 *
 * 1. **Collect** rows from each section's tables, including tables an earlier
 *    formatter bullet-wrapped inside list items. Tables that fail to parse
 *    are kept as legacy content.
 * 2. **Collapse** rows for the same `dependency + type` and **sort** them.
 * 3. **Replace** all original sections with one rebuilt section at the
 *    position of the first; if nothing remains, the section is dropped.
 *
 * Runs first in the transform order so the generic section merger never
 * concatenates dependency tables as plain content.
 *
 * @internal
 */

import type { List as ListNode } from "@effected/markdown";
import { Heading, List, ListItem, Root, Text } from "@effected/markdown";

import type { DependencyTableRow } from "../schemas/dependency-table.js";
import type { RootChild } from "../utils/blocks.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../utils/blocks.js";
import {
	collapseDependencyRows,
	parseDependencyTable,
	serializeDependencyTable,
	sortDependencyRows,
} from "../utils/dependency-table.js";
import type { ChangelogTransform } from "./types.js";

/**
 * Unwrap dependency tables that an earlier (broken) formatter nested inside
 * list items.
 *
 * @remarks
 * Only tables that parse as dependency tables leave the list; every other
 * item child keeps its bullet structure, surviving as a rebuilt `List` in the
 * legacy content. When no table parses the caller keeps the whole list.
 *
 * @param list - A list node found inside a `### Dependencies` section
 * @returns Parsed rows plus the remaining non-table content
 *
 * @internal
 */
function extractTablesFromList(list: ListNode): { rows: DependencyTableRow[]; rest: RootChild[] } {
	const rows: DependencyTableRow[] = [];
	const keptItems: ListItem[] = [];
	for (const item of list.children) {
		const keptChildren: ListItem["children"][number][] = [];
		for (const child of item.children) {
			if (child.type === "table") {
				try {
					rows.push(...parseDependencyTable(child));
					continue;
				} catch {
					// fall through: keep the unparseable table, still bullet-wrapped
				}
			}
			keptChildren.push(child);
		}
		if (keptChildren.length > 0) {
			keptItems.push(new ListItem({ ...item, children: keptChildren }));
		}
	}
	const rest: RootChild[] = keptItems.length > 0 ? [new List({ ...list, children: keptItems })] : [];
	return { rows, rest };
}

/**
 * Merge every `### Dependencies` section of each version block into one.
 *
 * @param root - The changelog tree
 * @returns A tree with at most one aggregated dependencies section per block
 *
 * @internal
 */
export const aggregateDependencyTables: ChangelogTransform = (root) => {
	const children: RootChild[] = [...root.children];
	const blocks = getVersionBlocks(children);

	// Process blocks in reverse to avoid index shifts
	for (let b = blocks.length - 1; b >= 0; b--) {
		const sections = getBlockSections(children, blocks[b]);
		const depSections = sections.filter((s) => getHeadingText(s.heading).toLowerCase() === "dependencies");
		if (depSections.length === 0) continue;

		const allRows: DependencyTableRow[] = [];
		const legacyContent: RootChild[] = [];

		for (const section of depSections) {
			for (const node of section.contentNodes) {
				if (node.type === "table") {
					try {
						allRows.push(...parseDependencyTable(node));
					} catch {
						// If the table doesn't parse, treat it as legacy content
						legacyContent.push(node);
					}
				} else if (node.type === "list") {
					// Bullet-wrapped tables from the legacy formatter: unwrap and merge
					const extracted = extractTablesFromList(node);
					if (extracted.rows.length > 0) {
						allRows.push(...extracted.rows);
						legacyContent.push(...extracted.rest);
					} else {
						legacyContent.push(node);
					}
				} else {
					legacyContent.push(node);
				}
			}
		}

		const collapsed = sortDependencyRows(collapseDependencyRows(allRows));

		// Remove every dependency section (heading + content), highest index first
		const indicesToRemove: number[] = [];
		for (const section of depSections) {
			indicesToRemove.push(section.headingIndex);
			for (let c = 0; c < section.contentNodes.length; c++) {
				indicesToRemove.push(section.headingIndex + 1 + c);
			}
		}
		indicesToRemove.sort((x, y) => y - x);
		for (const idx of indicesToRemove) {
			children.splice(idx, 1);
		}

		// Nothing left after collapse and no legacy content: the section drops
		if (collapsed.length === 0 && legacyContent.length === 0) continue;

		const newNodes: RootChild[] = [new Heading({ depth: 3, children: [new Text({ value: "Dependencies" })] })];
		if (collapsed.length > 0) {
			newNodes.push(serializeDependencyTable(collapsed));
		}
		newNodes.push(...legacyContent);

		children.splice(depSections[0].headingIndex, 0, ...newNodes);
	}

	return new Root({ ...root, children });
};
