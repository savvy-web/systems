/**
 * Changelog transform: reorder h3 sections by category priority.
 *
 * @remarks
 * Kit transform. Sorts sections within each version
 * block so Breaking Changes come first and Other last; unknown headings sort
 * after every category and a `Thanks` section is pinned to the very end.
 *
 * @internal
 */

import { Root } from "@effected/markdown";

import { fromHeading } from "../categories/index.js";
import type { RootChild } from "../utils/blocks.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../utils/blocks.js";
import type { ChangelogTransform } from "./types.js";

/** Default priority for unrecognized headings (after all known categories). */
const UNKNOWN_PRIORITY = 999;

/** Priority for the `Thanks` section; closes the version block. */
const THANKS_PRIORITY = 1000;

/** Resolve the sort priority for a section heading. */
function headingPriority(text: string): number {
	if (text.trim().toLowerCase() === "thanks") return THANKS_PRIORITY;
	return fromHeading(text)?.priority ?? UNKNOWN_PRIORITY;
}

/**
 * Reorder h3 sections within each version block by category priority.
 *
 * @param root - The changelog tree
 * @returns A tree with sections in priority order
 *
 * @internal
 */
export const reorderSections: ChangelogTransform = (root) => {
	const children: RootChild[] = [...root.children];
	const blocks = getVersionBlocks(children);

	// Process blocks in reverse so index changes don't affect earlier blocks
	for (let b = blocks.length - 1; b >= 0; b--) {
		const block = blocks[b];
		const sections = getBlockSections(children, block);
		if (sections.length <= 1) continue;

		// Preamble: nodes before the first h3
		const preamble = children.slice(block.startIndex, sections[0].headingIndex);

		const sorted = [...sections].sort(
			(x, y) => headingPriority(getHeadingText(x.heading)) - headingPriority(getHeadingText(y.heading)),
		);

		if (sorted.every((s, i) => s.headingIndex === sections[i].headingIndex)) continue;

		const rebuilt: RootChild[] = [...preamble];
		for (const section of sorted) {
			rebuilt.push(section.heading, ...section.contentNodes);
		}

		children.splice(block.startIndex, block.endIndex - block.startIndex, ...rebuilt);
	}

	return new Root({ ...root, children });
};
