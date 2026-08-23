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
 * An existing `### Thanks` section in a block is harvested conservatively:
 * only PURE attribution shapes -- attribution-only paragraphs, lists of
 * attribution-only bullets, and the plugin's own merged summary paragraph --
 * are absorbed into the contributor set and removed. Any other body content
 * (hand-authored prose, plain-name lists, code blocks, mixed prose+mention
 * paragraphs) is preserved untouched and never mined for mentions. When body
 * content survives, the section and its heading stay in place and the merged
 * paragraph is appended after the preserved body; when the whole body was
 * pure attribution, the section is removed and re-emitted at block end. This
 * keeps the plugin idempotent, lets successive releases merge contributor
 * lists, and guarantees a foreign changelog round-trips: no input node is
 * removed unless its content is reproduced in the emitted Thanks section.
 *
 * Contributors are deduplicated by lowercase username. The summary paragraph
 * uses Oxford comma formatting and preserves link URLs when available.
 *
 * With `thanks: false`, inline attributions and the pure attribution shapes
 * the plugin owns are stripped and no section is emitted; preserved
 * hand-authored Thanks content (and its heading) stays in place.
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

import type { Heading, Link, List, Paragraph, PhrasingContent, Root, Text } from "mdast";
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
 * Remove list items (recursively) whose content was emptied by attribution
 * stripping — a bullet that held ONLY `Thanks @user!` must not survive as a
 * bare `- ` husk. Runs in both the `thanks: true` and `thanks: false` paths,
 * since stripping is unconditional.
 *
 * @internal
 */
function pruneEmptiedListItems(list: List): void {
	list.children = list.children.filter((item) => {
		item.children = item.children.filter((child) => {
			if (child.type === "paragraph") return (child as Paragraph).children.length > 0;
			if (child.type === "list") {
				const nested = child as List;
				pruneEmptiedListItems(nested);
				return nested.children.length > 0;
			}
			return true;
		});
		return item.children.length > 0;
	});
}

/**
 * Text form of a paragraph: concatenated text values, with single-text link
 * children flattened to their label. Returns `undefined` when the paragraph
 * holds anything other than text and simple text-labelled links.
 *
 * @internal
 */
function flattenToText(para: Paragraph): string | undefined {
	let out = "";
	for (const child of para.children) {
		if (child.type === "text") {
			out += (child as Text).value;
			continue;
		}
		if (child.type === "link") {
			const link = child as Link;
			const only = link.children.length === 1 ? link.children[0] : undefined;
			if (only?.type === "text") {
				out += only.value;
				continue;
			}
		}
		return undefined;
	}
	return out;
}

/**
 * Pattern matching the plugin's own merged summary paragraph, e.g.
 * `Thanks to @alice, @bob, and @carol for their contributions!`.
 *
 * @internal
 */
const MERGED_SUMMARY_RE = /^Thanks to @\w[\w-]*(?:(?:, | and |, and |,and )@\w[\w-]*)* for their contributions!$/;

/**
 * Whether a paragraph consists ENTIRELY of attribution content the plugin
 * owns: either its own merged `Thanks to ... for their contributions!`
 * summary, or one or more trailing `Thanks @user!` / `Thanks [@user](url)!`
 * attributions with nothing else. Checked against a clone so the real node
 * is never mutated — a paragraph carrying anything beyond pure attribution
 * is not the plugin's to touch.
 *
 * @internal
 */
function isPureAttributionParagraph(para: Paragraph): boolean {
	const text = flattenToText(para);
	if (text !== undefined && MERGED_SUMMARY_RE.test(text)) return true;
	const clone = structuredClone(para);
	const scratch = new Map<string, Contributor>();
	while (clone.children.length > 0 && stripAttribution(clone, scratch)) {
		// keep stripping trailing attributions until none remain
	}
	return clone.children.length === 0;
}

/**
 * Whether a Thanks-section body node is a pure attribution shape the plugin
 * may harvest and remove: an attribution-only paragraph, or a list whose
 * every item holds only attribution-only paragraphs. Anything else
 * (mixed prose+mention, plain-name lists, code blocks, arbitrary prose) is
 * preserved untouched and never mined for mentions.
 *
 * @internal
 */
function isPureAttributionNode(node: Root["children"][number]): boolean {
	if (node.type === "paragraph") return isPureAttributionParagraph(node as Paragraph);
	if (node.type === "list") {
		const list = node as List;
		return (
			list.children.length > 0 &&
			list.children.every(
				(item) =>
					item.children.length > 0 &&
					item.children.every((child) => child.type === "paragraph" && isPureAttributionParagraph(child as Paragraph)),
			)
		);
	}
	return false;
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
			// The last surviving body node of a Thanks section whose heading was
			// preserved in place — the merged paragraph appends after it instead
			// of a new section being emitted at block end.
			let preservedThanksAnchor: Root["children"][number] | undefined;

			for (let i = block.startIndex; i < block.endIndex; i++) {
				const node = tree.children[i];

				// Inline attributions on list items
				if (node.type === "list") {
					const listNode = node as List;
					visit(listNode, "paragraph", (para: Paragraph) => {
						stripAttribution(para, contributors);
					});
					// A bullet emptied by the strip (its paragraph held only the
					// attribution) is removed rather than left as a bare `- `;
					// a list emptied entirely goes with it.
					pruneEmptiedListItems(listNode);
					if (listNode.children.length === 0) indicesToRemove.push(i);
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

				// An existing Thanks section: harvest ONLY pure attribution shapes
				// (the content the plugin itself owns). Anything else — hand-authored
				// prose, plain-name lists, code blocks, mixed prose+mention — is
				// preserved untouched and never mined for mentions: no input node is
				// removed unless its content is reproduced in the emitted section.
				if (isThanksHeading(node)) {
					const headingIndex = i;
					const harvested: number[] = [];
					let lastPreserved: Root["children"][number] | undefined;
					let j = i + 1;
					for (; j < block.endIndex; j++) {
						const contentNode = tree.children[j];
						if (contentNode.type === "heading" && [2, 3].includes((contentNode as Heading).depth)) break;
						// Reference definitions belong to the whole block (appended by
						// IssueLinkRefsPlugin after the Thanks section) — leave them.
						if (contentNode.type === "definition") continue;
						if (isPureAttributionNode(contentNode)) {
							harvestMentions(contentNode, contributors);
							harvested.push(j);
						} else {
							lastPreserved = contentNode;
						}
					}
					if (lastPreserved === undefined) {
						// Whole body was pure attribution (or empty): remove the section
						// and re-emit merged at block end, as before.
						indicesToRemove.push(headingIndex, ...harvested);
					} else {
						// Body nodes survive: the heading stays in place, only the pure
						// attribution shapes come out, and the merged paragraph appends
						// after the preserved body inside this section.
						indicesToRemove.push(...harvested);
						preservedThanksAnchor ??= lastPreserved;
					}
					// Advance the outer loop past the section range: revisiting a
					// harvested node would double-process it (an attribution-shaped
					// paragraph gets stripped AND its index pushed a second time).
					i = j - 1;
				}
			}

			// Remove collected nodes in descending, DEDUPLICATED index order — a
			// duplicate index would delete the sibling that shifted into the slot.
			const uniqueIndices = [...new Set(indicesToRemove)].sort((a, b) => b - a);
			for (const idx of uniqueIndices) {
				tree.children.splice(idx, 1);
			}

			if (!emitThanks || contributors.size === 0) continue;

			// A Thanks section survived with preserved body content: append the
			// merged paragraph into it (after the preserved body) rather than
			// emitting a second section — one Thanks section, never two.
			if (preservedThanksAnchor !== undefined) {
				const anchorIndex = tree.children.indexOf(preservedThanksAnchor);
				if (anchorIndex !== -1) {
					tree.children.splice(anchorIndex + 1, 0, buildSummaryParagraph(contributors));
					continue;
				}
			}

			// Insert the Thanks section at the end of the version block, but
			// before any trailing reference definitions so a second run (which
			// re-collects and re-inserts) reproduces the same layout.
			let insertAt = block.endIndex - uniqueIndices.length;
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
