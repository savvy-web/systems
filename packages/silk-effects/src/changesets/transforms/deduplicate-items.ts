/**
 * Changelog transform: drop duplicate list items within a section.
 *
 * @remarks
 * Kit twin of `DeduplicateItemsPlugin`. Seen item text is tracked across every
 * list in a section, not per list, because merging sections can leave
 * duplicate content as sibling lists. Lists left empty are removed.
 *
 * @internal
 */

import { List, Mdast, Root } from "@effected/markdown";

import type { RootChild } from "../utils/blocks.js";
import { getBlockSections, getVersionBlocks } from "../utils/blocks.js";
import type { ChangelogTransform } from "./types.js";

/**
 * Remove duplicate list items within each section of each version block.
 *
 * @param root - The changelog tree
 * @returns A tree with duplicates (and resulting empty lists) removed
 *
 * @internal
 */
export const deduplicateItems: ChangelogTransform = (root) => {
	const children: RootChild[] = [...root.children];

	for (const block of getVersionBlocks(children)) {
		for (const section of getBlockSections(children, block)) {
			const seen = new Set<string>();
			section.contentNodes.forEach((node, offset) => {
				if (node.type !== "list") return;
				const filtered = node.children.filter((item) => {
					const text = Mdast.toText(item);
					if (seen.has(text)) return false;
					seen.add(text);
					return true;
				});
				children[section.headingIndex + 1 + offset] = new List({ ...node, children: filtered });
			});
		}
	}

	return new Root({
		...root,
		children: children.filter((node) => node.type !== "list" || node.children.length > 0),
	});
};
