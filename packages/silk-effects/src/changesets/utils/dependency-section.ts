/**
 * Shared section-scanning decision for the CSH005 dependency-table rule.
 *
 * @remarks
 * Answers one question: given the blocks of a `## Dependencies` section, which
 * block (if any) is the dependency table? Issues #456/#457 arose when CSH005
 * had two implementations (a tree rule and a markdownlint micromark rule) that
 * answered it differently. There is now one rule, run by both hosts through
 * `\@effected/markdown-lint`, but the decision stays written down here:
 *
 * - A section spans from the node after its heading to the next heading (any
 *   depth) or end of document.
 * - The FIRST table found anywhere in that span satisfies the rule; prose may
 *   precede or follow it.
 * - A section with no table (prose/list only) fails.
 *
 * Position reporting: the "section has no table" diagnostic anchors at the
 * `## Dependencies` HEADING, since there is no table node to point at.
 * Diagnostics about a table that was found anchor at the table.
 *
 * @internal
 */

/**
 * Engine-specific predicates over one node representation (mdast
 * `RootContent` or micromark token).
 *
 * @internal
 */
export interface SectionScanAdapter<T> {
	/** True for a heading node — ends the section. */
	readonly isHeading: (node: T) => boolean;
	/** True for a table node. */
	readonly isTable: (node: T) => boolean;
	/**
	 * True for structural noise to skip entirely (e.g. micromark `lineEnding` /
	 * `lineEndingBlank` tokens). Optional; mdast has no such nodes.
	 */
	readonly isSkippable?: (node: T) => boolean;
}

/**
 * Result of scanning one `## Dependencies` section.
 *
 * @internal
 */
export interface SectionScanResult<T> {
	/** All content blocks of the section, in order (noise excluded). */
	readonly blocks: readonly T[];
	/** The first table block anywhere in the section, or `undefined` if none. */
	readonly table: T | undefined;
}

/**
 * Scan a `## Dependencies` section starting at the node AFTER its heading.
 *
 * Collects every content block until the next heading (any depth) or end of
 * input, and selects the first table found anywhere among them. See the module
 * remarks for the semantics this encodes and why they live in one place.
 *
 * @param nodes - The sibling node list containing the section (root children
 *   for mdast, the top-level token list for micromark)
 * @param startIndex - Index of the first node after the section heading
 * @param adapter - Engine-specific node predicates
 * @returns The section's blocks and its first table, if any
 *
 * @internal
 */
export function scanDependencySection<T>(
	nodes: readonly T[],
	startIndex: number,
	adapter: SectionScanAdapter<T>,
): SectionScanResult<T> {
	const blocks: T[] = [];
	let table: T | undefined;

	for (let i = startIndex; i < nodes.length; i++) {
		const node = nodes[i];

		if (adapter.isSkippable?.(node)) {
			continue;
		}

		if (adapter.isHeading(node)) {
			break;
		}

		blocks.push(node);

		if (table === undefined && adapter.isTable(node)) {
			table = node;
		}
	}

	return { blocks, table };
}
