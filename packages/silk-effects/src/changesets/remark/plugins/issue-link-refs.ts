/**
 * Remark transform: convert inline issue links to reference-style links.
 *
 * Converts `[#N](url)` inline links to `[#N]` reference-style links with
 * link definitions at the end of each version block.
 *
 * @remarks
 * Inline issue links like `[#42](https://github.com/org/repo/issues/42)` add
 * visual noise to the markdown source. This plugin rewrites them to
 * reference-style links (`[#42]`) and appends the corresponding link
 * definitions (`[#42]: https://...`) at the end of each version block.
 *
 * Only links whose text content matches the pattern `#N` (a hash followed by
 * one or more digits) are converted. Other links are left untouched.
 *
 * Within each version block, definitions are deduplicated by label and sorted
 * numerically (e.g., `#1`, `#12`, `#123`).
 *
 * @example
 * ```typescript
 * import { IssueLinkRefsPlugin } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(IssueLinkRefsPlugin)
 *   .use(remarkStringify);
 *
 * const md = [
 *   "# 1.0.0",
 *   "",
 *   "### Bug Fixes",
 *   "",
 *   "- Fixed crash [#42](https://github.com/org/repo/issues/42)",
 *   "",
 * ].join("\n");
 *
 * const result = processor.processSync(new VFile(md));
 * // Output: "- Fixed crash [#42]" with "[#42]: https://..." definition at block end
 * ```
 *
 * @see {@link ContributorFootnotesPlugin} for another plugin that appends content at block end
 * @see {@link NormalizeFormatPlugin} for cleanup that runs after this plugin
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { Definition, Link, LinkReference, Root } from "mdast";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";
import { getVersionBlocks } from "../../utils/version-blocks.js";

/**
 * Pattern matching issue numbers like `#123`.
 *
 * @internal
 */
const ISSUE_RE = /^#\d+$/;

export const IssueLinkRefsPlugin: Plugin<[], Root> = () => {
	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		// Process blocks in reverse so insertions don't shift earlier indices
		for (let b = blocks.length - 1; b >= 0; b--) {
			const block = blocks[b];
			const definitions = new Map<string, { label: string; url: string }>();

			// Walk link nodes in this block and convert issue links
			for (let i = block.startIndex; i < block.endIndex; i++) {
				const node = tree.children[i];

				visit(node, "link", (linkNode: Link, index, parent) => {
					if (!parent || index === undefined) return;

					// Check if link text is an issue reference
					if (linkNode.children.length !== 1 || linkNode.children[0].type !== "text") return;
					const text = linkNode.children[0].value;
					if (!ISSUE_RE.test(text)) return;

					// Collect definition
					const label = text;
					if (!definitions.has(label)) {
						definitions.set(label, { label, url: linkNode.url });
					}

					// Replace link with linkReference
					const ref: LinkReference = {
						type: "linkReference",
						identifier: label,
						label,
						referenceType: "full",
						children: [{ type: "text", value: label }],
					};

					parent.children[index] = ref;
					return SKIP;
				});
			}

			if (definitions.size === 0) continue;

			// Sort definitions numerically
			const sorted = [...definitions.values()].sort((a, b) => {
				const aNum = Number.parseInt(a.label.slice(1), 10);
				const bNum = Number.parseInt(b.label.slice(1), 10);
				return aNum - bNum;
			});

			// Create definition nodes
			const defNodes: Definition[] = sorted.map((def) => ({
				type: "definition",
				identifier: def.label,
				label: def.label,
				url: def.url,
			}));

			// Insert at end of version block
			tree.children.splice(block.endIndex, 0, ...defNodes);
		}
	};
};
