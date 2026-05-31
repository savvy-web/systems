/**
 * Shared helpers for markdownlint custom rules.
 *
 * Provides utility functions for extracting heading metadata from micromark
 * tokens and re-exports the {@link RULE_DOCS} map used by each rule to link
 * error details to online documentation.
 *
 * @remarks
 * These helpers are consumed by all five CSH markdownlint rules. They operate
 * on the `MicromarkToken` type from the `markdownlint` package, reading child
 * tokens of `atxHeading` nodes to determine heading depth and text content.
 *
 * @internal
 */

import type { MicromarkToken } from "markdownlint";

/**
 * Documentation URL map for changeset lint rules (CSH001--CSH005).
 *
 * Re-exported from `src/constants.ts` for use in rule error detail strings.
 *
 * @internal
 */
export { RULE_DOCS } from "../../constants.js";

/**
 * Get the heading level (1-6) from an `atxHeading` token.
 *
 * @param heading - The `atxHeading` micromark token
 * @returns The heading depth (number of `#` characters), or 0 if no sequence found
 *
 * @internal
 */
export function getHeadingLevel(heading: MicromarkToken): number {
	const sequence = heading.children.find((c) => c.type === "atxHeadingSequence");
	return sequence ? sequence.text.length : 0;
}

/**
 * Get the plain text content of an `atxHeading` token.
 *
 * @param heading - The `atxHeading` micromark token
 * @returns The heading text, or empty string if no text token found
 *
 * @internal
 */
export function getHeadingText(heading: MicromarkToken): string {
	const textToken = heading.children.find((c) => c.type === "atxHeadingText");
	return textToken ? textToken.text : "";
}
