/**
 * Version-block helpers over `@effected/markdown` trees.
 *
 * @remarks
 * An h2 opens a version block, an h3 opens a section inside it. Functions take a `children` array rather than a `Root`
 * so a transform can pass its mutable working copy of `root.children`.
 *
 * @internal
 */

import type { Heading, HeadingDepth, Root } from "@effected/markdown";
import { Mdast } from "@effected/markdown";

/**
 * A top-level child of a kit `Root`.
 *
 * @internal
 */
export type RootChild = Root["children"][number];

/**
 * Index range of one version (h2) entry within a children array.
 *
 * @internal
 */
export interface VersionBlock {
	/** Index of the h2 heading. */
	readonly headingIndex: number;
	/** First content index after the heading. */
	readonly startIndex: number;
	/** One past the last content index (next h2 or end of children). */
	readonly endIndex: number;
}

/**
 * An h3 section within a version block.
 *
 * @internal
 */
export interface BlockSection {
	/** The h3 heading node. */
	readonly heading: Heading;
	/** Absolute index of the h3 heading in the children array. */
	readonly headingIndex: number;
	/** Nodes between this h3 and the next h3/end of block. */
	readonly contentNodes: ReadonlyArray<RootChild>;
}

/**
 * Whether a node is a heading of one of the given depths.
 *
 * @param node - The node to test
 * @param depths - Accepted heading depths
 * @returns True (narrowing to `Heading`) when the node matches
 *
 * @internal
 */
export function isHeadingOfDepth(node: RootChild, depths: ReadonlyArray<HeadingDepth>): node is Heading {
	return node.type === "heading" && depths.includes(node.depth);
}

/**
 * Extract all version (h2) blocks from a children array.
 *
 * @param children - The root children
 * @returns Version blocks in document order
 *
 * @internal
 */
export function getVersionBlocks(children: ReadonlyArray<RootChild>): VersionBlock[] {
	const headings: number[] = [];
	for (let i = 0; i < children.length; i++) {
		if (isHeadingOfDepth(children[i], [2])) headings.push(i);
	}
	return headings.map((headingIndex, n) => ({
		headingIndex,
		startIndex: headingIndex + 1,
		endIndex: n + 1 < headings.length ? headings[n + 1] : children.length,
	}));
}

/**
 * Extract h3 sections within a version block; content before the first h3 is excluded.
 *
 * @param children - The root children
 * @param block - The version block to scan
 * @returns Sections in document order
 *
 * @internal
 */
export function getBlockSections(children: ReadonlyArray<RootChild>, block: VersionBlock): BlockSection[] {
	const sections: { heading: Heading; headingIndex: number; contentNodes: RootChild[] }[] = [];
	for (let i = block.startIndex; i < block.endIndex; i++) {
		const node = children[i];
		if (isHeadingOfDepth(node, [3])) {
			sections.push({ heading: node, headingIndex: i, contentNodes: [] });
		} else if (sections.length > 0) {
			sections[sections.length - 1].contentNodes.push(node);
		}
	}
	return sections;
}

/**
 * Plain text of a heading.
 *
 * @param heading - The heading node
 * @returns Concatenated inline text
 *
 * @internal
 */
export function getHeadingText(heading: Heading): string {
	return Mdast.toText(heading);
}
