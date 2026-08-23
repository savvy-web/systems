/**
 * Shared section-scanning decision for the CSH005 dependency-table rule.
 *
 * @remarks
 * CSH005 has two implementations — a remark-lint rule over the mdast tree and
 * a markdownlint rule over micromark tokens. Both must agree on ONE question:
 * given the blocks of a `## Dependencies` section, which block (if any) is the
 * dependency table? Issues #456/#457 arose because each rule answered it with
 * its own inline loop and the answers drifted: the markdownlint rule required
 * the table to be the FIRST block after the heading, while the remark rule
 * accepted a table anywhere in the section.
 *
 * The decided semantics live here, engine-agnostically:
 *
 * - A section spans from the node after its heading to the next heading (any
 *   depth) or end of document.
 * - The FIRST table found anywhere in that span satisfies the rule; prose may
 *   precede or follow it.
 * - A section with no table (prose/list only) fails.
 *
 * Each rule supplies a tiny {@link SectionScanAdapter} describing its node
 * representation; the scanning decision itself cannot drift because it is
 * written once.
 *
 * Position reporting (documented here so both rules stay aligned): the
 * "section has no table" diagnostic anchors at the `## Dependencies` HEADING
 * in both engines — there is no table node to point at, and the heading is
 * the one position both parsers agree on. Diagnostics about a table that was
 * found anchor at the table (or the offending row).
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
