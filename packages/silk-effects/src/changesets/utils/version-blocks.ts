/**
 * Utilities for extracting version blocks and sections from CHANGELOG ASTs.
 *
 * @remarks
 * Provides MDAST tree traversal functions for navigating the hierarchical
 * structure of CHANGELOG.md files. A CHANGELOG follows a two-level heading
 * hierarchy:
 *
 * - **h1** — package name (skipped by these utilities)
 * - **h2** — version headings (e.g., `## 1.2.0`), defining version blocks
 * - **h3** — section headings within a version block (e.g., `### Features`)
 *
 * The {@link getVersionBlocks} function identifies h2-level boundaries,
 * and {@link getBlockSections} drills into a specific version block to
 * extract its h3-level sections. Both return index-based structures
 * referencing `tree.children` positions, enabling efficient AST manipulation
 * without copying nodes.
 *
 * @see {@link ChangelogTransformer} for the public API that uses version
 *   blocks during CHANGELOG post-processing
 *
 * @internal
 */

import type { Heading, Root, RootContent } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";

/**
 * A version block within a CHANGELOG document.
 *
 * @remarks
 * Represents the index range of a single version entry in `tree.children`.
 * The heading is at `headingIndex`, and the content spans from `startIndex`
 * (inclusive) to `endIndex` (exclusive).
 *
 * @internal
 */
export interface VersionBlock {
	/** Index of the h2 heading in root.children. */
	headingIndex: number;
	/** First content index after the heading. */
	startIndex: number;
	/** One past the last content index (next h2 or end of children). */
	endIndex: number;
}

/**
 * A section within a version block, delimited by h3 headings.
 *
 * @remarks
 * Represents a single h3-level section within a version block. The
 * `contentNodes` array contains all MDAST nodes between this h3 heading
 * and the next h3/h2 heading or end of the version block.
 *
 * @internal
 */
export interface BlockSection {
	/** The h3 heading node. */
	heading: Heading;
	/** Absolute index of the h3 heading in root.children. */
	headingIndex: number;
	/** Content nodes between this h3 and the next h3/h2/end. */
	contentNodes: RootContent[];
}

/**
 * Extract all version blocks from a CHANGELOG AST.
 *
 * @remarks
 * Scans `tree.children` linearly for h2-level headings. Each h2 starts
 * a new version block whose content extends to the next h2 or the end
 * of the document. The `endIndex` of each block is adjusted in a second
 * pass to stop at the next block's `headingIndex`.
 *
 * h1 headings (typically the package name) are ignored and do not
 * create version blocks.
 *
 * @param tree - The MDAST root node of a CHANGELOG document
 * @returns Array of version blocks in document order
 *
 * @example
 * ```typescript
 * import { getVersionBlocks } from "../utils/version-blocks.js";
 * import { parseMarkdown } from "../utils/remark-pipeline.js";
 *
 * const tree = parseMarkdown("# my-pkg\n\n## 1.1.0\n\nChanges.\n\n## 1.0.0\n\nInitial.");
 * const blocks = getVersionBlocks(tree);
 * // blocks.length === 2
 * // blocks[0] covers "## 1.1.0" section
 * // blocks[1] covers "## 1.0.0" section
 * ```
 *
 * @internal
 */
export function getVersionBlocks(tree: Root): VersionBlock[] {
	const blocks: VersionBlock[] = [];

	for (let i = 0; i < tree.children.length; i++) {
		const node = tree.children[i];
		if (node.type === "heading" && (node as Heading).depth === 2) {
			blocks.push({
				headingIndex: i,
				startIndex: i + 1,
				endIndex: tree.children.length, // will be adjusted below
			});
		}
	}

	// Adjust endIndex for each block to stop at the next h2
	for (let i = 0; i < blocks.length - 1; i++) {
		blocks[i].endIndex = blocks[i + 1].headingIndex;
	}

	return blocks;
}

/**
 * Extract h3 sections within a version block.
 *
 * @remarks
 * Iterates over the children of the given version block (from
 * `block.startIndex` to `block.endIndex`). Each h3 heading starts
 * a new section, and subsequent non-heading nodes are collected
 * into that section's `contentNodes` array until the next h3 or
 * the end of the block.
 *
 * Nodes before the first h3 within the block (e.g., a version
 * summary paragraph) are not included in any section.
 *
 * @param tree - The MDAST root node of a CHANGELOG document
 * @param block - The version block to extract sections from
 * @returns Array of sections in document order
 *
 * @example
 * ```typescript
 * import { getVersionBlocks, getBlockSections } from "../utils/version-blocks.js";
 * import { parseMarkdown } from "../utils/remark-pipeline.js";
 *
 * const tree = parseMarkdown("## 1.0.0\n\n### Features\n\n- New API\n\n### Bug Fixes\n\n- Fixed crash");
 * const blocks = getVersionBlocks(tree);
 * const sections = getBlockSections(tree, blocks[0]);
 * // sections.length === 2
 * // sections[0].heading text === "Features"
 * ```
 *
 * @internal
 */
export function getBlockSections(tree: Root, block: VersionBlock): BlockSection[] {
	const sections: BlockSection[] = [];

	for (let i = block.startIndex; i < block.endIndex; i++) {
		const node = tree.children[i];
		if (node.type === "heading" && (node as Heading).depth === 3) {
			sections.push({
				heading: node as Heading,
				headingIndex: i,
				contentNodes: [],
			});
		} else if (sections.length > 0) {
			sections[sections.length - 1].contentNodes.push(node);
		}
	}

	return sections;
}

/**
 * Get the plain text content of a heading node.
 *
 * @remarks
 * Delegates to `mdast-util-to-string` to extract concatenated text
 * from all inline children of the heading (handling bold, italic,
 * code spans, etc.).
 *
 * @param heading - The MDAST heading node
 * @returns The heading text content as a plain string
 *
 * @internal
 */
export function getHeadingText(heading: Heading): string {
	return mdastToString(heading);
}
