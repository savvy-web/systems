/**
 * Remark transform: merge duplicate h3 section headings.
 *
 * When multiple changesets produce the same section heading (e.g., two
 * `### Features` blocks), this plugin merges their content under a
 * single heading within each version block.
 *
 * @remarks
 * The Changesets changelog formatter generates one section per changeset per
 * category. If three changesets all have Features entries, the raw CHANGELOG
 * will contain three `### Features` headings under the same version. This
 * plugin groups sections by heading text (case-insensitive, normalized via the
 * category system's `fromHeading`) and moves content from duplicate sections
 * into the first occurrence.
 *
 * The merge preserves the original order of content within each section. After
 * merging, duplicate headings and their content nodes are removed from the tree.
 *
 * This plugin must run after {@link AggregateDependencyTablesPlugin} (which
 * handles the special case of dependency tables) and before
 * {@link ReorderSectionsPlugin} (which sorts sections by category priority).
 *
 * @example
 * ```typescript
 * import { MergeSectionsPlugin } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(MergeSectionsPlugin)
 *   .use(remarkStringify);
 *
 * const md = [
 *   "# 1.0.0",
 *   "",
 *   "### Features",
 *   "",
 *   "- Added dark mode",
 *   "",
 *   "### Features",
 *   "",
 *   "- Added search",
 *   "",
 * ].join("\n");
 *
 * const result = processor.processSync(new VFile(md));
 * // Output has a single ### Features with both items
 * ```
 *
 * @see {@link AggregateDependencyTablesPlugin} for dependency-specific merging (runs before)
 * @see {@link ReorderSectionsPlugin} for sorting merged sections by priority (runs after)
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { Root } from "mdast";
import type { Plugin } from "unified";

import { fromHeading } from "../../categories/index.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../../utils/version-blocks.js";

export const MergeSectionsPlugin: Plugin<[], Root> = () => {
	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		// Process blocks in reverse so index adjustments don't affect earlier blocks
		for (let b = blocks.length - 1; b >= 0; b--) {
			const sections = getBlockSections(tree, blocks[b]);
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
				// Find where to insert merged content: after target's existing content
				const targetEndIndex = target.headingIndex + 1 + target.contentNodes.length;

				// Collect content from duplicates (in order)
				const mergedContent = [];
				for (let d = 1; d < indices.length; d++) {
					const dup = sections[indices[d]];
					mergedContent.push(...dup.contentNodes);
					// Mark the heading + content for removal
					indicesToRemove.push(dup.headingIndex);
					for (let c = 0; c < dup.contentNodes.length; c++) {
						indicesToRemove.push(dup.headingIndex + 1 + c);
					}
				}

				// Insert merged content after target's content
				tree.children.splice(targetEndIndex, 0, ...mergedContent);

				// Adjust indices that come after insertion point
				const shift = mergedContent.length;
				for (let r = 0; r < indicesToRemove.length; r++) {
					if (indicesToRemove[r] >= targetEndIndex) {
						indicesToRemove[r] += shift;
					}
				}
			}

			// Remove marked indices in reverse order
			indicesToRemove.sort((a, b) => b - a);
			for (const idx of indicesToRemove) {
				tree.children.splice(idx, 1);
			}
		}
	};
};
