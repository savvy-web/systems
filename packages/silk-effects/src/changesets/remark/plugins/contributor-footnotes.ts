/**
 * Remark transform: aggregate contributor attributions into a Thanks section.
 *
 * Extracts inline `Thanks [@user](url)!` or `Thanks @user!` text from
 * list items and standalone paragraphs and appends a deduplicated
 * `### Thanks` section at the end of each version block.
 *
 * @remarks
 * The Changesets changelog formatter appends contributor attributions to
 * individual entries (e.g., `- Fixed bug Thanks [@alice](url)!`, or a
 * standalone attribution paragraph after a block such as a dependency
 * table). This plugin strips those inline attributions and collects them
 * into a `### Thanks` section placed last in each version block:
 *
 * ```markdown
 * ### Thanks
 *
 * Thanks to \@alice, \@bob, and \@carol for their contributions!
 * ```
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
 * An existing `### Thanks` section in a block is harvested (its `@user`
 * mentions join the contributor set) and re-emitted, which makes the plugin
 * idempotent and lets successive releases merge their contributor lists.
 *
 * Contributors are deduplicated by lowercase username. The summary paragraph
 * uses Oxford comma formatting and preserves link URLs when available.
 *
 * With `thanks: false`, inline attributions and any existing Thanks section
 * are stripped and no section is emitted.
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
 * // Output includes a "### Thanks" section with
 * // "Thanks to @alice and @bob for their contributions!"
 * ```
 *
 * @see {@link NormalizeFormatPlugin} for cleanup that runs after this plugin
 * @see {@link SilkChangesetTransformPreset} for the full transform pipeline ordering
 *
 * @public
 */

import type { Heading, Link, Paragraph, PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { getVersionBlocks } from "../../utils/version-blocks.js";

/**
 * Options for {@link ContributorFootnotesPlugin}.
 *
 * @public
 */
export interface ContributorFootnotesOptions {
	/**
	 * Whether to emit the aggregated `### Thanks` section. Defaults to
	 * `true`. When `false`, inline attributions and any existing Thanks
	 * section are stripped and nothing is emitted.
	 */
	readonly thanks?: boolean;
}

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
 * Pattern matching `@user` mentions inside an existing Thanks section.
 *
 * @internal
 */
const MENTION_RE = /@(\w[\w-]*)/g;

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

/**
 * Strip a trailing attribution (linked or plain) from a paragraph, adding
 * the contributor to the map.
 *
 * @param para - The paragraph to inspect and mutate
 * @param contributors - The per-block contributor accumulator
 * @returns `true` when an attribution was found and removed
 *
 * @internal
 */
function stripAttribution(para: Paragraph, contributors: Map<string, Contributor>): boolean {
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
		return true;
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
			if (textNode.value === "") {
				para.children.pop();
			}
			return true;
		}
	}

	return false;
}

/**
 * Harvest every `@user` mention (linked or plain) from a node subtree.
 * Used to absorb an existing `### Thanks` section so re-running the plugin
 * is idempotent.
 *
 * @internal
 */
function harvestMentions(node: Paragraph | Root["children"][number], contributors: Map<string, Contributor>): void {
	visit(node, (child) => {
		if (child.type === "link") {
			const link = child as Link;
			const only = link.children.length === 1 ? link.children[0] : undefined;
			if (only?.type === "text" && only.value.startsWith("@")) {
				const username = only.value.slice(1);
				const key = username.toLowerCase();
				if (!contributors.has(key)) contributors.set(key, { username, url: link.url });
				return "skip";
			}
		} else if (child.type === "text") {
			for (const match of (child as Text).value.matchAll(MENTION_RE)) {
				const key = match[1].toLowerCase();
				if (!contributors.has(key)) contributors.set(key, { username: match[1], url: undefined });
			}
		}
		return undefined;
	});
}

/**
 * Build the `Thanks to ... for their contributions!` summary paragraph.
 *
 * @internal
 */
function buildSummaryParagraph(contributors: Map<string, Contributor>): Paragraph {
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

	return { type: "paragraph", children: phrasingChildren };
}

/**
 * Whether a node is a depth-3 heading whose text is `Thanks`.
 *
 * @internal
 */
function isThanksHeading(node: Root["children"][number]): node is Heading {
	if (node.type !== "heading" || (node as Heading).depth !== 3) return false;
	const heading = node as Heading;
	const only = heading.children.length === 1 ? heading.children[0] : undefined;
	return only?.type === "text" && only.value.trim().toLowerCase() === "thanks";
}

export const ContributorFootnotesPlugin: Plugin<[ContributorFootnotesOptions?], Root> = (options) => {
	const emitThanks = options?.thanks !== false;

	return (tree: Root) => {
		const blocks = getVersionBlocks(tree);

		// Process blocks in reverse so splices don't shift earlier blocks
		for (let b = blocks.length - 1; b >= 0; b--) {
			const block = blocks[b];
			const contributors = new Map<string, Contributor>();
			const indicesToRemove: number[] = [];

			for (let i = block.startIndex; i < block.endIndex; i++) {
				const node = tree.children[i];

				// Inline attributions on list items
				if (node.type === "list") {
					visit(node, "paragraph", (para: Paragraph) => {
						stripAttribution(para, contributors);
					});
					continue;
				}

				// Standalone attribution paragraphs (e.g. after a dependency table)
				if (node.type === "paragraph") {
					const para = node as Paragraph;
					const stripped = stripAttribution(para, contributors);
					if (stripped && para.children.length === 0) {
						indicesToRemove.push(i);
					}
					continue;
				}

				// An existing Thanks section: harvest its mentions and remove it
				// (heading + content up to the next h2/h3), then re-emit merged.
				if (isThanksHeading(node)) {
					indicesToRemove.push(i);
					for (let j = i + 1; j < block.endIndex; j++) {
						const contentNode = tree.children[j];
						if (contentNode.type === "heading" && [2, 3].includes((contentNode as Heading).depth)) break;
						// Reference definitions belong to the whole block (appended by
						// IssueLinkRefsPlugin after the Thanks section) — leave them.
						if (contentNode.type === "definition") continue;
						harvestMentions(contentNode, contributors);
						indicesToRemove.push(j);
					}
				}
			}

			// Remove collected nodes in reverse index order
			indicesToRemove.sort((a, b) => b - a);
			for (const idx of indicesToRemove) {
				tree.children.splice(idx, 1);
			}

			if (!emitThanks || contributors.size === 0) continue;

			// Insert the Thanks section at the end of the version block, but
			// before any trailing reference definitions so a second run (which
			// re-collects and re-inserts) reproduces the same layout.
			let insertAt = block.endIndex - indicesToRemove.length;
			while (insertAt > block.startIndex && tree.children[insertAt - 1]?.type === "definition") {
				insertAt--;
			}

			const heading: Heading = {
				type: "heading",
				depth: 3,
				children: [{ type: "text", value: "Thanks" }],
			};
			tree.children.splice(insertAt, 0, heading, buildSummaryParagraph(contributors));
		}
	};
};
