/**
 * Remark transform: deduplicate list items within sections.
 *
 * Removes duplicate list items within each h3 section of a version block.
 *
 * @remarks
 * When multiple changesets contribute the same change description to the same
 * section, the generated CHANGELOG contains duplicate list items. This plugin
 * deduplicates them by comparing the plain text content of each list item
 * (extracted via `mdast-util-to-string`).
 *
 * Within each h3 section of each version block, the plugin keeps the first
 * occurrence of each unique text value and removes subsequent duplicates. If a
 * list becomes empty after deduplication, it is removed from the tree entirely.
 *
 * @example
 * ```typescript
 * import { DeduplicateItemsPlugin } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(DeduplicateItemsPlugin)
 *   .use(remarkStringify);
 *
 * const md = [
 *   "# 1.0.0",
 *   "",
 *   "### Features",
 *   "",
 *   "- Added dark mode",
 *   "- Added dark mode",
 *   "- Added search",
 *   "",
 * ].join("\n");
 *
 * const result = processor.processSync(new VFile(md));
 * // Output has "- Added dark mode" only once
 * ```
 *
 * @see {@link MergeSectionsPlugin} for merging duplicate sections (runs before this plugin)
 * @see {@link NormalizeFormatPlugin} for removing empty sections after deduplication
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { List, Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Plugin } from "unified";
import { getBlockSections, getVersionBlocks } from "../../utils/version-blocks.js";

export const DeduplicateItemsPlugin: Plugin<[], Root> = () => {
	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		for (const block of blocks) {
			const sections = getBlockSections(tree, block);

			for (const section of sections) {
				for (const node of section.contentNodes) {
					if (node.type !== "list") continue;

					const list = node as List;
					const seen = new Set<string>();
					list.children = list.children.filter((item) => {
						const text = mdastToString(item);
						if (seen.has(text)) return false;
						seen.add(text);
						return true;
					});
				}
			}
		}

		// Remove empty lists from tree
		tree.children = tree.children.filter((node) => {
			if (node.type === "list") {
				return (node as List).children.length > 0;
			}
			return true;
		});
	};
};
