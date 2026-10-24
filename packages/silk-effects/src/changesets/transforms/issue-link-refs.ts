/**
 * Changelog transform: convert `[#N](url)` links to reference-style links.
 *
 * @remarks
 * Kit transform. Within each version block, links whose
 * sole text child is `#<digits>` become full `linkReference` nodes and one
 * `definition` per distinct issue is appended after the block, ordered
 * numerically.
 *
 * @internal
 */

import type { PhrasingContent } from "@effected/markdown";
import { Definition, LinkReference, MarkdownTransform, Root, Text } from "@effected/markdown";

import type { RootChild } from "../utils/blocks.js";
import { getVersionBlocks } from "../utils/blocks.js";
import type { ChangelogTransform } from "./types.js";

/** Pattern matching issue numbers like `#123`. */
const ISSUE_RE = /^#\d+$/;

/**
 * Convert issue links to reference-style links with per-block definitions.
 *
 * @param root - The changelog tree
 * @returns A tree with reference links and appended definitions
 *
 * @internal
 */
export const issueLinkRefs: ChangelogTransform = (root) => {
	const children: RootChild[] = [...root.children];
	const blocks = getVersionBlocks(children);

	// Process blocks in reverse so insertions don't shift earlier indices
	for (let b = blocks.length - 1; b >= 0; b--) {
		const block = blocks[b];
		const definitions = new Map<string, string>();

		for (let i = block.startIndex; i < block.endIndex; i++) {
			children[i] = MarkdownTransform.map(children[i], {
				link: (link): PhrasingContent => {
					const [only] = link.children;
					if (link.children.length !== 1 || only.type !== "text" || !ISSUE_RE.test(only.value)) return link;
					const label = only.value;
					if (!definitions.has(label)) definitions.set(label, link.url);
					return new LinkReference({
						identifier: label,
						label,
						referenceType: "full",
						children: [new Text({ value: label })],
					});
				},
			});
		}

		if (definitions.size === 0) continue;

		const defNodes = [...definitions.entries()]
			.sort(([x], [y]) => Number.parseInt(x.slice(1), 10) - Number.parseInt(y.slice(1), 10))
			.map(([label, url]) => new Definition({ identifier: label, label, url }));

		children.splice(block.endIndex, 0, ...defNodes);
	}

	return new Root({ ...root, children });
};
