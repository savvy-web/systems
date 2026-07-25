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
 * CommonMark backslash escapes: a backslash is literal unless it precedes an
 * ASCII punctuation character, in which case the pair denotes that character.
 */
const BACKSLASH_ESCAPE_RE = /\\([!-/:-@[-`{-~])/g;

/**
 * Resolve CommonMark backslash escapes in raw micromark source text.
 *
 * @remarks
 * Every rule in this directory has a sibling remark implementation that reads
 * the parsed mdast tree, where the parser has already resolved escapes, via
 * `mdast-util-to-string`. Micromark tokens instead carry RAW source. Comparing
 * raw text against a value the parsed form would produce makes the two
 * implementations of one documented rule disagree about the same file
 * (issue #367).
 *
 * Applied at the shared extractors below so both implementations judge the
 * value a reader actually sees, rather than per-rule where the next extractor
 * added would silently reintroduce the split.
 *
 * @internal
 */
export function unescapeMarkdown(raw: string): string {
	return raw.replace(BACKSLASH_ESCAPE_RE, "$1");
}

/**
 * Get the plain text content of an `atxHeading` token.
 *
 * @remarks
 * Escape-resolved, so a heading compares equal to the same heading as the
 * remark rules see it. `getHeadingLevel` needs no equivalent — it counts
 * sequence characters rather than reading text.
 *
 * @param heading - The `atxHeading` micromark token
 * @returns The heading text, or empty string if no text token found
 *
 * @internal
 */
export function getHeadingText(heading: MicromarkToken): string {
	const textToken = heading.children.find((c) => c.type === "atxHeadingText");
	return textToken ? unescapeMarkdown(textToken.text) : "";
}
