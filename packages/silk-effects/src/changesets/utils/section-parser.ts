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

import type { Heading, Root, RootContent } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";

import { fromHeading } from "../categories/index.js";
import type { SectionCategory } from "../categories/types.js";
import { parseMarkdown, stringifyMarkdown } from "./remark-pipeline.js";

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
 * 1. Parse the summary markdown into an MDAST tree via {@link parseMarkdown}
 * 2. Scan `tree.children` for h2 (`depth === 2`) headings, recording their
 *    indices
 * 3. For each h2, extract the heading text, resolve it to a
 *    {@link SectionCategory} via `fromHeading()`, and collect all nodes
 *    between this h2 and the next h2 (or end of document) as the section
 *    content
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
	const tree = parseMarkdown(summary);

	// Find indices of all h2 headings
	const h2Indices: number[] = [];
	for (let i = 0; i < tree.children.length; i++) {
		const node = tree.children[i];
		if (node.type === "heading" && (node as Heading).depth === 2) {
			h2Indices.push(i);
		}
	}

	// No h2 headings → flat-text mode
	if (h2Indices.length === 0) {
		return {
			preamble: summary.trim(),
			sections: [],
		};
	}

	// Extract preamble (content before the first h2)
	const result: ParsedChangeset = { sections: [] };
	if (h2Indices[0] > 0) {
		const preambleNodes = tree.children.slice(0, h2Indices[0]);
		result.preamble = stringifyAstSlice(preambleNodes);
	}

	// Extract each section
	for (let i = 0; i < h2Indices.length; i++) {
		const headingIndex = h2Indices[i];
		const headingNode = tree.children[headingIndex] as Heading;
		const headingText = mdastToString(headingNode);

		// Content extends from after the heading to the next h2 (or end)
		const nextIndex = i + 1 < h2Indices.length ? h2Indices[i + 1] : tree.children.length;
		const contentNodes = tree.children.slice(headingIndex + 1, nextIndex);
		const content = stringifyAstSlice(contentNodes);

		const category = fromHeading(headingText);
		if (category) {
			result.sections.push({ category, heading: headingText, content });
		}
		// Unknown headings are silently skipped (validation is Layer 1's job)
	}

	return result;
}

/**
 * Stringify a slice of MDAST nodes back to markdown.
 *
 * @remarks
 * Wraps the nodes in a synthetic root node and delegates to
 * {@link stringifyMarkdown}. Returns an empty string for empty slices.
 *
 * @param nodes - Array of MDAST content nodes
 * @returns Trimmed markdown string, or empty string if no nodes
 *
 * @internal
 */
function stringifyAstSlice(nodes: RootContent[]): string {
	if (nodes.length === 0) return "";
	const root: Root = { type: "root", children: nodes };
	return stringifyMarkdown(root).trim();
}
