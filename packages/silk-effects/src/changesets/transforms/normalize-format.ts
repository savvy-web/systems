/**
 * Changelog transform: remove empty sections and empty lists.
 *
 * @remarks
 * Kit twin of `NormalizeFormatPlugin`. Within each version block, drops empty
 * lists and h3 sections with no content before the next h2/h3 (or the end of
 * the block), along with whitespace-only paragraphs that trail them.
 *
 * @internal
 */

import { Mdast, Root } from "@effected/markdown";

import type { RootChild } from "../utils/blocks.js";
import { getVersionBlocks, isHeadingOfDepth } from "../utils/blocks.js";
import type { ChangelogTransform } from "./types.js";

/**
 * Remove empty h3 sections and empty lists from each version block.
 *
 * @param root - The changelog tree
 * @returns The normalized tree
 *
 * @internal
 */
export const normalizeFormat: ChangelogTransform = (root) => {
	const children: RootChild[] = [...root.children];
	const indicesToRemove = new Set<number>();

	for (const block of getVersionBlocks(children)) {
		for (let i = block.startIndex; i < block.endIndex; i++) {
			const node = children[i];

			if (node.type === "list" && node.children.length === 0) {
				indicesToRemove.add(i);
				continue;
			}

			if (!isHeadingOfDepth(node, [3])) continue;

			let hasContent = false;
			for (let j = i + 1; j < block.endIndex; j++) {
				const next = children[j];

				// Skip whitespace-only paragraphs
				if (next.type === "paragraph" && Mdast.toText(next).trim() === "") {
					indicesToRemove.add(j);
					continue;
				}

				// A heading next means this section is empty
				if (isHeadingOfDepth(next, [2, 3])) break;

				hasContent = true;
				break;
			}

			if (!hasContent) indicesToRemove.add(i);
		}
	}

	return new Root({ ...root, children: children.filter((_, i) => !indicesToRemove.has(i)) });
};
