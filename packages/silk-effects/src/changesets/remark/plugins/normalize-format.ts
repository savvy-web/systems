/**
 * Remark transform: normalize markdown formatting.
 *
 * Final cleanup pass that removes empty sections and empty lists from the
 * document.
 *
 * @remarks
 * This plugin runs last in the {@link SilkChangesetTransformPreset} pipeline
 * and handles cleanup left behind by earlier plugins:
 *
 * - **Empty sections** -- An h3 heading followed immediately by another h2/h3
 *   heading or the end of the version block has no content. This can happen
 *   after {@link DeduplicateItemsPlugin} removes all items from a list or after
 *   {@link AggregateDependencyTablesPlugin} consolidates dependency sections.
 * - **Empty lists** -- Lists with zero items (e.g., after deduplication removed
 *   all children) are removed from the tree.
 * - **Whitespace-only paragraphs** -- Paragraphs containing only whitespace are
 *   removed as part of empty-section detection.
 *
 * @example
 * ```typescript
 * import { NormalizeFormatPlugin } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(NormalizeFormatPlugin)
 *   .use(remarkStringify);
 *
 * const md = [
 *   "# 1.0.0",
 *   "",
 *   "### Features",
 *   "",
 *   "- Added dark mode",
 *   "",
 *   "### Bug Fixes",
 *   "",
 *   "### Other",
 *   "",
 *   "- Misc update",
 *   "",
 * ].join("\n");
 *
 * const result = processor.processSync(new VFile(md));
 * // Output omits the empty "### Bug Fixes" section
 * ```
 *
 * @see {@link DeduplicateItemsPlugin} for the plugin that may leave empty lists
 * @see {@link AggregateDependencyTablesPlugin} for the plugin that may leave empty sections
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { Heading, List, Root, RootContent } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Plugin } from "unified";

import { getVersionBlocks } from "../../utils/version-blocks.js";

/**
 * Check if a node is a heading at one of the given depths.
 *
 * @param node - The AST node to check
 * @param depths - Allowed heading depths
 * @returns `true` if the node is a heading at one of the specified depths
 *
 * @internal
 */
function isHeadingAtDepth(node: RootContent, depths: number[]): node is Heading {
	return node.type === "heading" && depths.includes((node as Heading).depth);
}

export const NormalizeFormatPlugin: Plugin<[], Root> = () => {
	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		// Collect indices to remove (empty sections, empty lists)
		const indicesToRemove = new Set<number>();

		for (const block of blocks) {
			for (let i = block.startIndex; i < block.endIndex; i++) {
				const node = tree.children[i];

				// Remove empty lists
				if (node.type === "list" && (node as List).children.length === 0) {
					indicesToRemove.add(i);
					continue;
				}

				// Detect empty sections: h3 followed immediately by h2/h3 or end of block
				if (!isHeadingAtDepth(node, [3])) continue;

				// Check if the next non-empty content is another heading or end of block
				let hasContent = false;
				for (let j = i + 1; j < block.endIndex; j++) {
					const next = tree.children[j];

					// Skip whitespace-only paragraphs
					if (next.type === "paragraph" && mdastToString(next).trim() === "") {
						indicesToRemove.add(j);
						continue;
					}

					// If next real node is a heading, this section is empty
					if (isHeadingAtDepth(next, [2, 3])) break;

					// Found real content
					hasContent = true;
					break;
				}

				if (!hasContent) {
					indicesToRemove.add(i);
				}
			}
		}

		// Remove in reverse order to preserve indices
		const sorted = [...indicesToRemove].sort((a, b) => b - a);
		for (const idx of sorted) {
			tree.children.splice(idx, 1);
		}
	};
};
