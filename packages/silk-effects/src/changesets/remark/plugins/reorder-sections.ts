/**
 * Remark transform: reorder h3 sections by category priority.
 *
 * Sorts sections within each version block so that Breaking Changes
 * appear first (priority 1) and Other appears last (priority 13).
 *
 * @remarks
 * The category system assigns a numeric priority to each section heading
 * (Breaking Changes = 1, Features = 2, Bug Fixes = 3, ... Other = 13).
 * This plugin reorders h3 sections within each version block to match that
 * priority ordering, ensuring a consistent section order across all versions
 * in the CHANGELOG.
 *
 * Unrecognized headings (those not matching any known category) are assigned
 * a priority of 999 and sort to the end, after all known categories.
 *
 * Preamble content (nodes between the version heading and the first h3) is
 * preserved in place. If sections are already in the correct order, the tree
 * is left untouched.
 *
 * This plugin must run after {@link MergeSectionsPlugin} so that duplicate
 * sections have already been consolidated before sorting.
 *
 * @example
 * ```typescript
 * import { ReorderSectionsPlugin } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(ReorderSectionsPlugin)
 *   .use(remarkStringify);
 *
 * const md = [
 *   "# 1.0.0",
 *   "",
 *   "### Other",
 *   "",
 *   "- Misc change",
 *   "",
 *   "### Breaking Changes",
 *   "",
 *   "- Removed deprecated API",
 *   "",
 * ].join("\n");
 *
 * const result = processor.processSync(new VFile(md));
 * // Output: Breaking Changes (priority 1) appears before Other (priority 13)
 * ```
 *
 * @see {@link MergeSectionsPlugin} for merging duplicate sections (runs before)
 * @see {@link DeduplicateItemsPlugin} for removing duplicate items (runs after)
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { Root, RootContent } from "mdast";
import type { Plugin } from "unified";
import { fromHeading } from "../../categories/index.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../../utils/version-blocks.js";

/**
 * Default priority for unrecognized headings (sorts after all known categories).
 *
 * @internal
 */
const UNKNOWN_PRIORITY = 999;

export const ReorderSectionsPlugin: Plugin<[], Root> = () => {
	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		// Process blocks in reverse so index changes don't affect earlier blocks
		for (let b = blocks.length - 1; b >= 0; b--) {
			const block = blocks[b];
			const sections = getBlockSections(tree, block);
			if (sections.length <= 1) continue;

			// Collect preamble nodes (content before first h3)
			const preamble: RootContent[] = [];
			for (let i = block.startIndex; i < block.endIndex; i++) {
				if (i < sections[0].headingIndex) {
					preamble.push(tree.children[i]);
				} else {
					break;
				}
			}

			// Sort sections by category priority
			const sorted = [...sections].sort((a, b) => {
				const aPriority = fromHeading(getHeadingText(a.heading))?.priority ?? UNKNOWN_PRIORITY;
				const bPriority = fromHeading(getHeadingText(b.heading))?.priority ?? UNKNOWN_PRIORITY;
				return aPriority - bPriority;
			});

			// Check if already in order
			const alreadySorted = sorted.every((s, i) => s.headingIndex === sections[i].headingIndex);
			if (alreadySorted) continue;

			// Rebuild the block: preamble + sorted sections
			const newChildren: RootContent[] = [...preamble];
			for (const section of sorted) {
				newChildren.push(section.heading, ...section.contentNodes);
			}

			// Replace block content in tree
			const blockLength = block.endIndex - block.startIndex;
			tree.children.splice(block.startIndex, blockLength, ...newChildren);
		}
	};
};
