/**
 * Section-aware changeset summary parser.
 *
 * @remarks
 * Parses changeset summaries that contain h2 headings into structured
 * sections mapped to {@link SectionCategory} values. This is the bridge
 * between raw changeset markdown and the category system: it walks the
 * MDAST tree to find h2 headings, resolves each heading to a category
 * via `fromHeading()`, and collects the content between headings.
 *
 * Supports two modes:
 * - **Sectioned mode**: when h2 headings are present, each heading becomes
 *   a section with its category and content
 * - **Flat-text mode**: when no h2 headings are found, the entire content
 *   is returned as the preamble (backward-compatible with plain changesets)
 *
 * @see {@link Changelog} for the public API that consumes parsed sections
 * @see {@link Categories} for the category resolution system
 *
 * @internal
 */

import type { FlowContent, Root } from "@effected/markdown";
import { MarkdownTransform, Mdast, Root as RootNode } from "@effected/markdown";

import { fromHeading } from "../categories/index.js";
import type { SectionCategory } from "../categories/types.js";
import { emitKitMarkdown, parseKitMarkdown } from "./markdown-emit.js";

/**
 * A parsed section from a changeset summary.
 *
 * @remarks
 * Represents a single h2-delimited section within a changeset summary,
 * with the heading text resolved to a {@link SectionCategory}.
 *
 * @internal
 */
export interface ParsedSection {
	/** The resolved category for this section */
	category: SectionCategory;
	/** The original heading text */
	heading: string;
	/** The markdown content under this heading */
	content: string;
	/**
	 * The kit nodes under this heading.
	 *
	 * @remarks
	 * The same content as {@link ParsedSection.content}, but as the parsed
	 * tree slice. The changelog formatter renders from these nodes so that
	 * emit decisions (bullet vs block) are made on node types rather than
	 * string prefixes.
	 */
	contentNodes: FlowContent[];
}

/**
 * A fully parsed changeset with optional preamble and sections.
 *
 * @remarks
 * The preamble captures any content before the first h2 heading.
 * If no h2 headings are present, the entire summary is stored as
 * the preamble with an empty `sections` array.
 *
 * @example
 * ```typescript
 * import type { ParsedChangeset } from "../utils/section-parser.js";
 *
 * const result: ParsedChangeset = {
 *   preamble: "General notes about this release.",
 *   sections: [
 *     { category: "Features", heading: "Features", content: "- Added new API" },
 *     { category: "Bug Fixes", heading: "Bug Fixes", content: "- Fixed crash" },
 *   ],
 * };
 * ```
 *
 * @internal
 */
export interface ParsedChangeset {
	/** Content before any h2 heading (if present) */
	preamble?: string;
	/** Sections identified by h2 headings */
	sections: ParsedSection[];
}

/**
 * Parse a changeset summary into structured sections.
 *
 * @remarks
 * The algorithm works in three steps:
 * 1. Parse the summary markdown into `@effected/markdown` nodes via
 *    {@link parseKitMarkdown}
 * 2. Hand the tree to {@link sectionsOf}, which slices it at root-level h2
 *    headings with `MarkdownTransform.sections`
 *
 * If the summary contains h2 (`##`) headings, they are mapped to categories
 * via `fromHeading()`. Content between headings becomes the section content.
 * Content before the first h2 becomes the preamble.
 *
 * If no h2 headings are present, the entire content is returned as the preamble
 * with an empty sections array (backward-compatible flat-text mode).
 *
 * Unknown headings (those not recognized by `fromHeading()`) are silently
 * skipped; validation of heading names is the responsibility of Layer 1
 * (remark-lint).
 *
 * @param summary - The changeset summary markdown
 * @returns Parsed sections and optional preamble
 *
 * @example
 * ```typescript
 * import { parseChangesetSections } from "../utils/section-parser.js";
 *
 * const result = parseChangesetSections("## Features\n\n- New API\n\n## Bug Fixes\n\n- Fixed crash");
 * // result.sections.length === 2
 * // result.sections[0].category === "Features"
 * // result.preamble === undefined
 * ```
 *
 * @internal
 */
export function parseChangesetSections(summary: string): ParsedChangeset {
	return sectionsOf(parseKitMarkdown(summary), summary);
}

/**
 * Slice an already-parsed changeset tree into categorized sections.
 *
 * @remarks
 * Split from {@link parseChangesetSections} so a caller can transform the
 * tree (the renderer appends attribution with `MarkdownTransform.map`) and
 * re-slice it without re-parsing. A section runs from its h2 to the next
 * root-level h2 (or the end of the summary); a stray h1 inside a section stays
 * in that section's content, as it always has.
 *
 * @param tree - The parsed summary
 * @param summary - The summary source, returned verbatim as the preamble in
 *   flat-text mode
 * @returns Parsed sections and optional preamble
 *
 * @internal
 */
export function sectionsOf(tree: Root, summary: string): ParsedChangeset {
	const spans = MarkdownTransform.sections(tree, { depth: 2 });

	// No h2 headings: flat-text mode
	if (spans.length === 0) {
		return {
			preamble: summary.trim(),
			sections: [],
		};
	}

	const result: ParsedChangeset = { sections: [] };
	if (spans[0].headingIndex > 0) {
		result.preamble = stringifyAstSlice(tree.children.slice(0, spans[0].headingIndex));
	}

	for (let i = 0; i < spans.length; i++) {
		const span = spans[i];
		const headingText = Mdast.toText(span.heading);
		// A section runs to the NEXT h2, not to `span.end`: the kit also ends a
		// section at a shallower (h1) heading, which would silently drop every
		// node between a stray h1 and the next h2 from both section and preamble.
		const end = i + 1 < spans.length ? spans[i + 1].headingIndex : tree.children.length;
		const contentNodes = tree.children.slice(span.headingIndex + 1, end).filter(isFlowContent);
		const category = fromHeading(headingText);
		if (category) {
			result.sections.push({ category, heading: headingText, content: stringifyAstSlice(contentNodes), contentNodes });
		}
		// Unknown headings are skipped (Layer 1 validation catches them)
	}

	return result;
}

/**
 * Narrow a root child to block content (frontmatter capture is off and the
 * dialect is GFM, so this only ever drops nothing).
 *
 * @internal
 */
function isFlowContent(node: Root["children"][number]): node is FlowContent {
	return node.type !== "frontmatter" && node.type !== "mdxjsEsm";
}

/**
 * Stringify a slice of root children back to trimmed markdown.
 *
 * @internal
 */
function stringifyAstSlice(nodes: ReadonlyArray<Root["children"][number]>): string {
	if (nodes.length === 0) return "";
	return emitKitMarkdown(new RootNode({ children: nodes })).trim();
}
