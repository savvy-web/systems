/**
 * Remark transform: aggregate contributor attributions.
 *
 * Extracts inline `Thanks [@user](url)!` or `Thanks @user!` text from
 * list items and appends a deduplicated contributors paragraph at the
 * end of each version block.
 *
 * @remarks
 * The Changesets changelog formatter appends contributor attributions to
 * individual list items (e.g., `- Fixed bug Thanks [@alice](url)!`). This
 * plugin strips those inline attributions and collects them into a single
 * summary paragraph at the end of each version block:
 *
 * "Thanks to \@alice, \@bob, and \@carol for their contributions!"
 *
 * Two attribution formats are recognized:
 *
 * - **Linked**: `Thanks [@user](https://github.com/user)!` -- after markdown
 *   parsing this appears as three sibling nodes inside a paragraph: a text
 *   node ending with `"Thanks "`, a link node with child text `"@user"`, and
 *   a text node `"!"`.
 * - **Plain**: `Thanks @user!` -- remains a single text node matching the
 *   pattern `Thanks @user!` at the end of the text.
 *
 * Contributors are deduplicated by lowercase username. The summary paragraph
 * uses Oxford comma formatting and preserves link URLs when available.
 *
 * @example
 * ```typescript
 * import { ContributorFootnotesPlugin } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 * import { VFile } from "vfile";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(ContributorFootnotesPlugin)
 *   .use(remarkStringify);
 *
 * const md = [
 *   "# 1.0.0",
 *   "",
 *   "### Features",
 *   "",
 *   "- Added dark mode Thanks @alice!",
 *   "- Added search Thanks @bob!",
 *   "",
 * ].join("\n");
 *
 * const result = processor.processSync(new VFile(md));
 * // Output includes a "Thanks to @alice and @bob for their contributions!" paragraph
 * ```
 *
 * @see {@link NormalizeFormatPlugin} for cleanup that runs after this plugin
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { Link, Paragraph, PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { getVersionBlocks } from "../../utils/version-blocks.js";

/**
 * A contributor extracted from an inline attribution.
 *
 * @internal
 */
interface Contributor {
	username: string;
	url: string | undefined;
}

/**
 * Pattern matching `Thanks @user!` at end of text.
 *
 * @internal
 */
const ATTRIBUTION_PLAIN_RE = /\s*Thanks @(\w[\w-]*)!$/;

/**
 * Try to extract a linked attribution from the end of a paragraph's children.
 * Pattern: text "...Thanks " + link "\@user" + text "!"
 *
 * @param children - The phrasing content children of a paragraph node
 * @returns The contributor and the index to start removal from, or `undefined`
 *
 * @internal
 */
function extractLinkedAttribution(
	children: PhrasingContent[],
): { contributor: Contributor; removeFrom: number } | undefined {
	if (children.length < 3) return undefined;

	const last = children[children.length - 1];
	const secondLast = children[children.length - 2];
	const thirdLast = children[children.length - 3];

	// Last must be text "!"
	if (last.type !== "text" || last.value !== "!") return undefined;

	// Second-to-last must be a link with child text starting with "@"
	if (secondLast.type !== "link") return undefined;
	const linkNode = secondLast as Link;
	if (linkNode.children.length !== 1 || linkNode.children[0].type !== "text") return undefined;
	const linkText = linkNode.children[0].value;
	if (!linkText.startsWith("@")) return undefined;
	const username = linkText.slice(1);

	// Third-to-last must be text ending with "Thanks " (possibly with leading space)
	if (thirdLast.type !== "text") return undefined;
	const textNode = thirdLast as Text;
	if (!/\s*Thanks $/.test(textNode.value)) return undefined;

	return {
		contributor: { username, url: linkNode.url },
		removeFrom: children.length - 3,
	};
}

export const ContributorFootnotesPlugin: Plugin<[], Root> = () => {
	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		// Process blocks in reverse so insertions don't shift earlier indices
		for (let b = blocks.length - 1; b >= 0; b--) {
			const block = blocks[b];
			const contributors = new Map<string, Contributor>();

			// Walk paragraphs inside list items in this block
			for (let i = block.startIndex; i < block.endIndex; i++) {
				const node = tree.children[i];
				if (node.type !== "list") continue;

				visit(node, "paragraph", (para: Paragraph) => {
					// Try linked attribution: text + link + "!"
					const linked = extractLinkedAttribution(para.children);
					if (linked) {
						const key = linked.contributor.username.toLowerCase();
						if (!contributors.has(key)) {
							contributors.set(key, linked.contributor);
						}
						// Remove the "Thanks " text suffix and the link + "!" nodes
						const textNode = para.children[linked.removeFrom] as Text;
						textNode.value = textNode.value.replace(/\s*Thanks $/, "");
						para.children.splice(linked.removeFrom + 1, 2);
						// Remove the text node too if it became empty
						if (textNode.value === "") {
							para.children.splice(linked.removeFrom, 1);
						}
						return;
					}

					// Try plain attribution: text ending with "Thanks @user!"
					const last = para.children[para.children.length - 1];
					if (last?.type === "text") {
						const textNode = last as Text;
						const match = textNode.value.match(ATTRIBUTION_PLAIN_RE);
						if (match) {
							const username = match[1];
							const key = username.toLowerCase();
							if (!contributors.has(key)) {
								contributors.set(key, { username, url: undefined });
							}
							textNode.value = textNode.value.replace(ATTRIBUTION_PLAIN_RE, "");
						}
					}
				});
			}

			if (contributors.size === 0) continue;

			// Build contributors paragraph
			const sorted = [...contributors.values()].sort((a, b) =>
				a.username.toLowerCase().localeCompare(b.username.toLowerCase()),
			);

			const phrasingChildren: (Text | Link)[] = [];
			phrasingChildren.push({ type: "text", value: "Thanks to " });

			for (let i = 0; i < sorted.length; i++) {
				const contrib = sorted[i];

				if (i > 0 && sorted.length > 2) {
					phrasingChildren.push({ type: "text", value: ", " });
				}
				if (i > 0 && i === sorted.length - 1) {
					phrasingChildren.push({
						type: "text",
						value: sorted.length === 2 ? " and " : "and ",
					});
				}

				if (contrib.url) {
					phrasingChildren.push({
						type: "link",
						url: contrib.url,
						children: [{ type: "text", value: `@${contrib.username}` }],
					});
				} else {
					phrasingChildren.push({ type: "text", value: `@${contrib.username}` });
				}
			}

			phrasingChildren.push({
				type: "text",
				value: " for their contributions!",
			});

			const paragraph: Paragraph = {
				type: "paragraph",
				children: phrasingChildren,
			};

			// Insert at end of version block
			tree.children.splice(block.endIndex, 0, paragraph);
		}
	};
};
