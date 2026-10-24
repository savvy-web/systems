/**
 * Changelog transform: merge duplicate h3 section headings.
 *
 * @remarks
 * Kit twin of `MergeSectionsPlugin`. Groups h3 sections within each version
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

	// Process blocks in reverse so index adjustments don't affect earlier blocks
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

		// Collect indices to remove (in reverse order for safe splicing)
		const indicesToRemove: number[] = [];

		for (const indices of groups.values()) {
			if (indices.length <= 1) continue;

			// First occurrence is the merge target
			const target = sections[indices[0]];
			// Merged content goes after the target's existing content
			const targetEndIndex = target.headingIndex + 1 + target.contentNodes.length;

			// Collect content from duplicates (in order)
			const mergedContent: RootChild[] = [];
			for (let d = 1; d < indices.length; d++) {
				const dup = sections[indices[d]];
				mergedContent.push(...dup.contentNodes);
				// Mark the heading + content for removal
				indicesToRemove.push(dup.headingIndex);
				for (let c = 0; c < dup.contentNodes.length; c++) {
					indicesToRemove.push(dup.headingIndex + 1 + c);
				}
			}

			children.splice(targetEndIndex, 0, ...mergedContent);

			// Adjust indices that come after the insertion point
			const shift = mergedContent.length;
			for (let r = 0; r < indicesToRemove.length; r++) {
				if (indicesToRemove[r] >= targetEndIndex) {
					indicesToRemove[r] += shift;
				}
			}
		}

		// Remove marked indices in reverse order
		indicesToRemove.sort((x, y) => y - x);
		for (const idx of indicesToRemove) {
			children.splice(idx, 1);
		}
	}

	return new Root({ ...root, children });
};
