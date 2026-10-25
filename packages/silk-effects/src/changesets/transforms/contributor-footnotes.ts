/**
 * Changelog transform: aggregate contributor attributions into a Thanks section.
 *
 * @remarks
 * Kit transform. Inline `Thanks [@user](url)!` and
 * `Thanks @user!` attributions are stripped from list items and standalone
 * paragraphs and collected into a deduplicated `### Thanks` section placed at
 * the end of each version block (before trailing reference definitions).
 *
 * An existing `### Thanks` section is harvested conservatively: only PURE
 * attribution shapes (attribution-only paragraphs, lists of attribution-only
 * bullets, and the transform's own merged summary paragraph) are absorbed and
 * removed. Any other body content is preserved untouched and never mined for
 * mentions; when such content survives, the heading stays in place and the
 * merged paragraph is appended after it, so there is only ever one Thanks
 * section and no input node is lost unless its content is reproduced.
 *
 * Kit nodes are immutable, so every helper is pure: a stripped paragraph or a
 * pruned list is rebuilt, and section-level edits go through a copy of the
 * root's children.
 *
 * With `thanks: false`, attributions and the pure attribution shapes are still
 * stripped but no section is emitted; preserved hand-authored Thanks content
 * (and its heading) stays in place.
 *
 * @internal
 */

import type { FlowContent, PhrasingContent } from "@effected/markdown";
import {
	Heading,
	Link,
	List,
	ListItem,
	MarkdownTransform,
	MarkdownVisitor,
	Paragraph,
	Root,
	Text,
} from "@effected/markdown";

import type { RootChild } from "../utils/blocks.js";
import { getVersionBlocks, isHeadingOfDepth } from "../utils/blocks.js";
import type { ChangelogTransform } from "./types.js";

/**
 * Options for {@link contributorFootnotes}.
 *
 * @internal
 */
export interface ContributorFootnotesOptions {
	/**
	 * Whether to emit the aggregated `### Thanks` section. Defaults to
	 * `true`. When `false`, inline attributions and the pure attribution
	 * shapes of an existing Thanks section are stripped and nothing is emitted.
	 */
	readonly thanks?: boolean;
}

/** A contributor extracted from an attribution. */
interface Contributor {
	readonly username: string;
	readonly url: string | undefined;
}

/** Pattern matching `Thanks @user!` at end of text. */
const ATTRIBUTION_PLAIN_RE = /\s*Thanks @(\w[\w-]*)!$/;

/** Pattern matching the `Thanks ` text suffix that precedes a linked attribution. */
const LINKED_PREFIX_RE = /\s*Thanks $/;

/** Pattern matching `@user` mentions inside text. */
const MENTION_RE = /@(\w[\w-]*)/g;

/**
 * Pattern matching the transform's own merged summary paragraph, e.g.
 * `Thanks to @alice, @bob, and @carol for their contributions!`.
 */
const MERGED_SUMMARY_RE = /^Thanks to @\w[\w-]*(?:(?:, | and |, and |,and )@\w[\w-]*)* for their contributions!$/;

/** Record a contributor unless one with the same lowercase username is already known. */
function addContributor(contributors: Map<string, Contributor>, contributor: Contributor): void {
	const key = contributor.username.toLowerCase();
	if (!contributors.has(key)) contributors.set(key, contributor);
}

/**
 * Match a linked attribution at the end of a paragraph's children:
 * text `"...Thanks "` + link `"@user"` + text `"!"`.
 */
function extractLinkedAttribution(
	children: ReadonlyArray<PhrasingContent>,
): { readonly contributor: Contributor; readonly removeFrom: number; readonly prefix: Text } | undefined {
	if (children.length < 3) return undefined;
	const last = children[children.length - 1];
	const link = children[children.length - 2];
	const prefix = children[children.length - 3];

	if (last.type !== "text" || last.value !== "!") return undefined;
	if (link.type !== "link" || link.children.length !== 1) return undefined;
	const [label] = link.children;
	if (label.type !== "text" || !label.value.startsWith("@")) return undefined;
	if (prefix.type !== "text" || !LINKED_PREFIX_RE.test(prefix.value)) return undefined;

	return {
		contributor: { username: label.value.slice(1), url: link.url },
		removeFrom: children.length - 3,
		prefix,
	};
}

/**
 * Strip one trailing attribution (linked or plain) from a paragraph, recording
 * the contributor.
 *
 * @param para - The paragraph to inspect
 * @param contributors - The per-block contributor accumulator
 * @returns The rebuilt paragraph, or `undefined` when nothing was stripped
 */
function stripAttribution(para: Paragraph, contributors: Map<string, Contributor>): Paragraph | undefined {
	const linked = extractLinkedAttribution(para.children);
	if (linked) {
		addContributor(contributors, linked.contributor);
		const value = linked.prefix.value.replace(LINKED_PREFIX_RE, "");
		const kept = para.children.slice(0, linked.removeFrom);
		const children = value === "" ? kept : [...kept, new Text({ ...linked.prefix, value })];
		return new Paragraph({ ...para, children });
	}

	const last = para.children[para.children.length - 1];
	if (last?.type === "text") {
		const match = last.value.match(ATTRIBUTION_PLAIN_RE);
		if (match) {
			addContributor(contributors, { username: match[1], url: undefined });
			const value = last.value.replace(ATTRIBUTION_PLAIN_RE, "");
			const kept = para.children.slice(0, -1);
			const children = value === "" ? kept : [...kept, new Text({ ...last, value })];
			return new Paragraph({ ...para, children });
		}
	}

	return undefined;
}

/**
 * Harvest every `@user` mention (linked or plain) from a node subtree.
 *
 * @remarks
 * A mention link is entered before its own label text, so the link's URL wins
 * and the label's plain re-match is a no-op.
 */
function harvestMentions(node: RootChild, contributors: Map<string, Contributor>): void {
	for (const event of MarkdownVisitor.walk(new Root({ children: [node] }))) {
		if (event._tag !== "Enter") continue;
		const child = event.node;
		if (child.type === "link") {
			const [only] = child.children;
			if (child.children.length === 1 && only.type === "text" && only.value.startsWith("@")) {
				addContributor(contributors, { username: only.value.slice(1), url: child.url });
			}
		} else if (child.type === "text") {
			for (const match of child.value.matchAll(MENTION_RE)) {
				addContributor(contributors, { username: match[1], url: undefined });
			}
		}
	}
}

/** Build the `Thanks to ... for their contributions!` summary paragraph. */
function buildSummaryParagraph(contributors: Map<string, Contributor>): Paragraph {
	const sorted = [...contributors.values()].sort((a, b) =>
		a.username.toLowerCase().localeCompare(b.username.toLowerCase()),
	);

	const children: PhrasingContent[] = [new Text({ value: "Thanks to " })];
	sorted.forEach((contrib, i) => {
		if (i > 0 && sorted.length > 2) children.push(new Text({ value: ", " }));
		if (i > 0 && i === sorted.length - 1) {
			children.push(new Text({ value: sorted.length === 2 ? " and " : "and " }));
		}
		const mention = `@${contrib.username}`;
		children.push(
			contrib.url
				? new Link({ url: contrib.url, children: [new Text({ value: mention })] })
				: new Text({ value: mention }),
		);
	});
	children.push(new Text({ value: " for their contributions!" }));

	return new Paragraph({ children });
}

/**
 * Remove list items (recursively) emptied by attribution stripping, so a
 * bullet that held only `Thanks @user!` does not survive as a bare `- `.
 *
 * @param list - The list to prune
 * @returns The rebuilt list
 */
function pruneEmptiedListItems(list: List): List {
	const items: ListItem[] = [];
	for (const item of list.children) {
		const kept: FlowContent[] = [];
		for (const child of item.children) {
			if (child.type === "paragraph") {
				if (child.children.length > 0) kept.push(child);
			} else if (child.type === "list") {
				const nested = pruneEmptiedListItems(child);
				if (nested.children.length > 0) kept.push(nested);
			} else {
				kept.push(child);
			}
		}
		if (kept.length > 0) items.push(new ListItem({ ...item, children: kept }));
	}
	return new List({ ...list, children: items });
}

/**
 * Text form of a paragraph, with single-text links flattened to their label;
 * `undefined` when the paragraph holds anything else.
 */
function flattenToText(para: Paragraph): string | undefined {
	let out = "";
	for (const child of para.children) {
		if (child.type === "text") {
			out += child.value;
			continue;
		}
		if (child.type === "link" && child.children.length === 1) {
			const [only] = child.children;
			if (only.type === "text") {
				out += only.value;
				continue;
			}
		}
		return undefined;
	}
	return out;
}

/**
 * Whether a paragraph consists ENTIRELY of attribution content the transform
 * owns: its own merged summary, or one or more trailing attributions with
 * nothing else.
 */
function isPureAttributionParagraph(para: Paragraph): boolean {
	const text = flattenToText(para);
	if (text !== undefined && MERGED_SUMMARY_RE.test(text)) return true;
	const scratch = new Map<string, Contributor>();
	let current = para;
	while (current.children.length > 0) {
		const next = stripAttribution(current, scratch);
		if (next === undefined) break;
		current = next;
	}
	return current.children.length === 0;
}

/**
 * Whether a Thanks-section body node is a pure attribution shape: an
 * attribution-only paragraph, or a non-empty list whose every item holds only
 * attribution-only paragraphs.
 */
function isPureAttributionNode(node: RootChild): boolean {
	if (node.type === "paragraph") return isPureAttributionParagraph(node);
	if (node.type === "list") {
		return (
			node.children.length > 0 &&
			node.children.every(
				(item) =>
					item.children.length > 0 &&
					item.children.every((child) => child.type === "paragraph" && isPureAttributionParagraph(child)),
			)
		);
	}
	return false;
}

/** Whether a node is a depth-3 heading whose text is `Thanks`. */
function isThanksHeading(node: RootChild): node is Heading {
	if (!isHeadingOfDepth(node, [3]) || node.children.length !== 1) return false;
	const [only] = node.children;
	return only.type === "text" && only.value.trim().toLowerCase() === "thanks";
}

/**
 * Create the contributor-footnotes transform.
 *
 * @param options - Whether to emit the aggregated Thanks section
 * @returns A transform that strips attributions and aggregates them per version block
 *
 * @internal
 */
export function contributorFootnotes(options?: ContributorFootnotesOptions): ChangelogTransform {
	const emitThanks = options?.thanks !== false;

	return (root) => {
		const children: RootChild[] = [...root.children];
		const blocks = getVersionBlocks(children);

		// Process blocks in reverse so splices don't shift earlier blocks
		for (let b = blocks.length - 1; b >= 0; b--) {
			const block = blocks[b];
			const contributors = new Map<string, Contributor>();
			const indicesToRemove: number[] = [];
			// The last surviving body node of a Thanks section whose heading was
			// preserved in place; the merged paragraph appends after it.
			let preservedThanksAnchor: RootChild | undefined;

			for (let i = block.startIndex; i < block.endIndex; i++) {
				const node = children[i];

				// Inline attributions on list items. The handler fills
				// `contributors` as a side effect, in document order.
				if (node.type === "list") {
					const stripped = MarkdownTransform.map(node, {
						paragraph: (para) => stripAttribution(para, contributors) ?? para,
					});
					const pruned = pruneEmptiedListItems(stripped);
					children[i] = pruned;
					if (pruned.children.length === 0) indicesToRemove.push(i);
					continue;
				}

				// Standalone attribution paragraphs (e.g. after a dependency table)
				if (node.type === "paragraph") {
					const stripped = stripAttribution(node, contributors);
					if (stripped !== undefined) {
						children[i] = stripped;
						if (stripped.children.length === 0) indicesToRemove.push(i);
					}
					continue;
				}

				// An existing Thanks section: harvest ONLY pure attribution shapes.
				if (isThanksHeading(node)) {
					const headingIndex = i;
					const harvested: number[] = [];
					let lastPreserved: RootChild | undefined;
					let j = i + 1;
					for (; j < block.endIndex; j++) {
						const contentNode = children[j];
						if (isHeadingOfDepth(contentNode, [2, 3])) break;
						// Reference definitions belong to the whole block — leave them.
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
						// and re-emit merged at block end.
						indicesToRemove.push(headingIndex, ...harvested);
					} else {
						// Body survives: heading stays, only pure shapes come out.
						indicesToRemove.push(...harvested);
						preservedThanksAnchor ??= lastPreserved;
					}
					// Skip past the section so no harvested node is processed twice.
					i = j - 1;
				}
			}

			// Remove in descending, DEDUPLICATED index order.
			const uniqueIndices = [...new Set(indicesToRemove)].sort((x, y) => y - x);
			for (const idx of uniqueIndices) {
				children.splice(idx, 1);
			}

			if (!emitThanks || contributors.size === 0) continue;

			// A Thanks section survived with preserved body content: append the
			// merged paragraph into it rather than emitting a second section.
			if (preservedThanksAnchor !== undefined) {
				const anchorIndex = children.indexOf(preservedThanksAnchor);
				if (anchorIndex !== -1) {
					children.splice(anchorIndex + 1, 0, buildSummaryParagraph(contributors));
					continue;
				}
			}

			// Insert at block end, before any trailing reference definitions, so a
			// second run reproduces the same layout.
			let insertAt = block.endIndex - uniqueIndices.length;
			while (insertAt > block.startIndex && children[insertAt - 1]?.type === "definition") {
				insertAt--;
			}

			const heading = new Heading({ depth: 3, children: [new Text({ value: "Thanks" })] });
			children.splice(insertAt, 0, heading, buildSummaryParagraph(contributors));
		}

		return new Root({ ...root, children });
	};
}
