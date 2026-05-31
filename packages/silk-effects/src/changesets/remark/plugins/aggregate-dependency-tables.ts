/**
 * Remark transform: aggregate dependency tables.
 *
 * Consolidates all `### Dependencies` sections within each version block
 * into a single section with a merged, collapsed, and sorted table.
 *
 * @remarks
 * When multiple changesets each produce their own `### Dependencies` section,
 * the generated CHANGELOG ends up with duplicate sections under the same
 * version heading. This plugin merges them into one.
 *
 * The consolidation pipeline for each version block:
 *
 * 1. **Collect** -- Find all `### Dependencies` sections and extract rows from
 *    their tables. Tables that fail to parse (e.g., legacy free-form content)
 *    are preserved as-is.
 * 2. **Collapse** -- Combine rows for the same package. For example, if package
 *    `foo` was `added` in one changeset and `removed` in another, the two rows
 *    collapse to a net-zero and are dropped. If `foo` was `added 1.0` then
 *    `updated 1.0 -> 2.0`, it collapses to `added 2.0`.
 * 3. **Sort** -- Rows are sorted by action (`removed`, `updated`, `added`),
 *    then alphabetically by type and package name.
 * 4. **Replace** -- All original `### Dependencies` sections (headings and
 *    content) are removed and a single replacement section is inserted at the
 *    position of the first original section. If all rows collapsed to nothing
 *    and there is no legacy content, the section is dropped entirely.
 *
 * This plugin must run before {@link MergeSectionsPlugin} (position 0 in
 * {@link SilkChangesetTransformPreset}) so that the generic section merger
 * does not naively concatenate dependency tables as list content.
 *
 * @example
 * ```typescript
 * import { AggregateDependencyTablesPlugin } from "\@savvy-web/changesets/remark";
 * import remarkGfm from "remark-gfm";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkGfm)
 *   .use(AggregateDependencyTablesPlugin)
 *   .use(remarkStringify);
 *
 * const md = [
 *   "# 1.0.0",
 *   "",
 *   "### Dependencies",
 *   "",
 *   "| Dependency | Type | Action | From | To |",
 *   "| --- | --- | --- | --- | --- |",
 *   "| foo | dependency | added | \u2014 | 1.0.0 |",
 *   "",
 *   "### Dependencies",
 *   "",
 *   "| Dependency | Type | Action | From | To |",
 *   "| --- | --- | --- | --- | --- |",
 *   "| bar | devDependency | updated | 2.0.0 | 3.0.0 |",
 *   "",
 * ].join("\n");
 *
 * const result = processor.processSync(new VFile(md));
 * // Output has a single ### Dependencies section with both rows
 * ```
 *
 * @see {@link DependencyTableFormatRule} for the lint rule that validates dependency table structure
 * @see {@link MergeSectionsPlugin} for the generic section merger that runs after this plugin
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { Heading, Root, RootContent, Table } from "mdast";
import type { Plugin } from "unified";

import type { DependencyTableRow } from "../../schemas/dependency-table.js";
import {
	collapseDependencyRows,
	parseDependencyTable,
	serializeDependencyTable,
	sortDependencyRows,
} from "../../utils/dependency-table.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../../utils/version-blocks.js";

export const AggregateDependencyTablesPlugin: Plugin<[], Root> = () => {
	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		// Process blocks in reverse to avoid index shifts
		for (let b = blocks.length - 1; b >= 0; b--) {
			const sections = getBlockSections(tree, blocks[b]);
			const depSections = sections.filter((s) => getHeadingText(s.heading).toLowerCase() === "dependencies");

			if (depSections.length === 0) continue;

			// Collect all rows from all dependency tables
			const allRows: DependencyTableRow[] = [];
			const legacyContent: RootContent[] = [];

			for (const section of depSections) {
				for (const node of section.contentNodes) {
					if (node.type === "table") {
						try {
							const rows = parseDependencyTable(node as Table);
							allRows.push(...rows);
						} catch {
							// If table doesn't parse, treat as legacy content
							legacyContent.push(node);
						}
					} else {
						legacyContent.push(node);
					}
				}
			}

			// Collapse and sort
			const collapsed = sortDependencyRows(collapseDependencyRows(allRows));

			// Collect all indices to remove (headings + content) in reverse order
			const indicesToRemove: number[] = [];
			for (const section of depSections) {
				indicesToRemove.push(section.headingIndex);
				for (let c = 0; c < section.contentNodes.length; c++) {
					indicesToRemove.push(section.headingIndex + 1 + c);
				}
			}
			indicesToRemove.sort((a, b) => b - a);

			// Remove all dependency sections
			for (const idx of indicesToRemove) {
				tree.children.splice(idx, 1);
			}

			// If no rows left after collapse and no legacy content, skip (section drops naturally)
			if (collapsed.length === 0 && legacyContent.length === 0) continue;

			// Build replacement section at the position of the first dep section
			const insertAt = depSections[0].headingIndex;
			const newNodes: RootContent[] = [];

			// Re-create the heading
			const heading: Heading = {
				type: "heading",
				depth: 3,
				children: [{ type: "text", value: "Dependencies" }],
			};
			newNodes.push(heading);

			// Add table if there are rows
			if (collapsed.length > 0) {
				newNodes.push(serializeDependencyTable(collapsed));
			}

			// Add legacy content after the table
			newNodes.push(...legacyContent);

			tree.children.splice(insertAt, 0, ...newNodes);
		}
	};
};
