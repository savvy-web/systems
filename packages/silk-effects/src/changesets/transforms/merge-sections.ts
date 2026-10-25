/**
 * Changelog transform: merge duplicate h3 section headings.
 *
 * @remarks
 * Kit transform. Groups h3 sections within each version
 * block by normalized heading text (via the category system's `fromHeading`)
 * and moves the content of duplicates under the first occurrence, then drops
 * the duplicate headings. Runs after dependency-table aggregation and before
 * section reordering.
 *
 * @internal
 */

import { Root } from "@effected/markdown";

import { fromHeading } from "../categories/index.js";
import type { RootChild } from "../utils/blocks.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../utils/blocks.js";
import type { ChangelogTransform } from "./types.js";

/**
 * Merge duplicate h3 sections within each version block.
 *
 * @param root - The changelog tree
 * @returns A tree with a single section per heading in each version block
 *
 * @internal
 */
export const mergeSections: ChangelogTransform = (root) => {
	const children: RootChild[] = [...root.children];
	const blocks = getVersionBlocks(children);

	// Process blocks in reverse so a rebuilt block never shifts an earlier block's indices
	for (let b = blocks.length - 1; b >= 0; b--) {
		const sections = getBlockSections(children, blocks[b]);
		if (sections.length <= 1) continue;

		// Group sections by normalized heading text
		const groups = new Map<string, number[]>();
		for (let s = 0; s < sections.length; s++) {
			const text = getHeadingText(sections[s].heading);
			const category = fromHeading(text);
			const key = category ? category.heading.toLowerCase() : text.toLowerCase();
			const existing = groups.get(key);
			if (existing) {
				existing.push(s);
			} else {
				groups.set(key, [s]);
			}
		}

		if (![...groups.values()].some((indices) => indices.length > 1)) continue;

		// Rebuild the block: anything before the first h3 stays, then each
		// distinct heading in first-occurrence order with its own content
		// followed by the content of its duplicates. Rebuilding from the
		// original section snapshot avoids the stale-index trap of splicing
		// group by group when duplicates interleave (Features, Bug Fixes,
		// Features, Bug Fixes).
		const block = blocks[b];
		const rebuilt: RootChild[] = children.slice(block.startIndex, sections[0].headingIndex);
		for (const indices of groups.values()) {
			const [target, ...duplicates] = indices.map((s) => sections[s]);
			rebuilt.push(target.heading, ...target.contentNodes, ...duplicates.flatMap((d) => d.contentNodes));
		}
		children.splice(block.startIndex, block.endIndex - block.startIndex, ...rebuilt);
	}

	return new Root({ ...root, children });
};
