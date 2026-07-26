/**
 * Remark processing pipeline for markdown parsing and stringification.
 *
 * @remarks
 * Provides a shared, pre-configured unified processor with remark-parse,
 * remark-gfm, and remark-stringify. Used throughout the codebase wherever
 * markdown needs to be parsed into an MDAST tree or serialized back to
 * a string. Centralizing the processor configuration ensures consistent
 * GFM support (tables, strikethrough, etc.) across all markdown operations.
 *
 *
 * @internal
 */

import type { Root, Text } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { Options as RemarkStringifyOptions } from "remark-stringify";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/**
 * The `mdast-util-to-markdown` text-node handler signature, derived from
 * `remark-stringify`'s own options rather than imported from the underlying
 * utility — which is a transitive dependency, not a declared one.
 *
 * @privateRemarks
 * `handlers` is keyed by node type, so it must be indexed with `"text"`;
 * a `[string]` index widens the signature away to `any`.
 *
 * @internal
 */
type StringifyTextHandle = NonNullable<NonNullable<RemarkStringifyOptions["handlers"]>["text"]>;

declare module "mdast" {
	/**
	 * Augments the mdast text-node `data` bag with the literal-write marker.
	 *
	 * @remarks
	 * `data` is the sanctioned place for processor-specific annotations on a
	 * unist node; it survives tree manipulation and is ignored by anything
	 * that does not look for it.
	 */
	interface TextData {
		/** Set by {@link literalText} — write this node's value verbatim. */
		silkLiteralText?: boolean;
	}
}

/**
 * Marker set on the `data` of a text node whose value must be written to
 * markdown verbatim rather than escaped.
 *
 * @remarks
 * `remark-stringify` escapes any character that could open a markdown
 * construct. Inside a dependency table that is always wrong: with
 * `remark-gfm` enabled `~` is the strikethrough delimiter, so the specifier
 * `~0.2.1` is written as `\~0.2.1`, and `_` in a package name becomes `\_`.
 * The corruption compounds on every re-serialization, and dependency-table
 * cells round-trip through consolidation and PR-body reconstruction.
 *
 * The marker is deliberately narrow. It is set only by the dependency-table
 * cell builder, whose cell vocabulary is closed — package name, dependency
 * type, action, version specifier, and the em-dash sentinel — and none of
 * those can legitimately carry markdown. Prose elsewhere in a changeset keeps
 * the default escaping.
 *
 * @internal
 */
export const LITERAL_TEXT_MARKER = "silkLiteralText";

/**
 * Mark a text node so {@link createRemarkProcessor} writes it verbatim.
 *
 * @param value - The literal cell text
 * @returns An MDAST `Text` node carrying the literal marker
 *
 * @internal
 */
export function literalText(value: string): Text {
	return { type: "text", value, data: { [LITERAL_TEXT_MARKER]: true } };
}

/**
 * Whether a text node was marked by {@link literalText}.
 *
 * @internal
 */
function isLiteralText(node: Text): boolean {
	return node.data?.[LITERAL_TEXT_MARKER] === true;
}

/**
 * Escape the two characters that would otherwise corrupt the table grid.
 *
 * @remarks
 * A `|` would close the cell early and a `\` would be read as an escape
 * introducer, so both are escaped to keep the written cell parseable back to
 * its exact input. Every other character is emitted as-is. Because parsing
 * consumes the backslash, a value that already carries a legacy `\~` from the
 * old escaping path re-parses to its clean form rather than accumulating
 * another layer.
 *
 * @internal
 */
function escapeCellLiteral(value: string): string {
	return value.replace(/[\\|]/g, "\\$&");
}

/**
 * `mdast-util-to-markdown` handler overrides used by the shared processor.
 *
 * @remarks
 * Replaces the default `text` handler — which is `state.safe(node.value, info)`
 * — with one that bypasses escaping for nodes marked by {@link literalText}
 * and delegates to the default behavior for everything else.
 *
 * @internal
 */
const literalTextHandlers: Readonly<Record<"text", StringifyTextHandle>> = {
	text: (node, _parent, state, info) => {
		const text = node as Text;
		return isLiteralText(text) ? escapeCellLiteral(text.value) : state.safe(text.value, info);
	},
};

/**
 * Create a unified processor configured with remark-parse, remark-gfm,
 * and remark-stringify.
 *
 * @remarks
 * Each call creates a fresh processor instance. The plugin chain is:
 * 1. `remark-parse` — markdown to MDAST
 * 2. `remark-gfm` — GitHub Flavored Markdown extensions (tables, etc.)
 * 3. `remark-stringify` — MDAST back to markdown, with the
 *    {@link literalText} handler override
 *
 * @privateRemarks
 * Return type is intentionally inferred because the unified `Processor`
 * generic signature is complex and parameterized by the plugin chain.
 *
 * @returns A configured unified processor
 *
 * @internal
 */
export function createRemarkProcessor() {
	return unified().use(remarkParse).use(remarkGfm).use(remarkStringify, { handlers: literalTextHandlers });
}

/**
 * Parse a markdown string into an MDAST AST synchronously.
 *
 * @remarks
 * Uses {@link createRemarkProcessor} internally. The returned tree
 * includes GFM extensions (tables, strikethrough, etc.) thanks to
 * the remark-gfm plugin.
 *
 * @param content - Raw markdown string
 * @returns The parsed MDAST root node
 *
 * @example
 * ```typescript
 * import { parseMarkdown } from "../utils/remark-pipeline.js";
 *
 * const tree = parseMarkdown("## Version 1.0.0\n\nInitial release.");
 * // tree.type === "root"
 * // tree.children[0].type === "heading"
 * ```
 *
 * @internal
 */
export function parseMarkdown(content: string): Root {
	const processor = createRemarkProcessor();
	return processor.parse(content);
}

/**
 * Stringify an MDAST AST back to a markdown string synchronously.
 *
 * @remarks
 * Uses {@link createRemarkProcessor} internally. GFM constructs
 * (tables, etc.) are serialized correctly thanks to the remark-gfm plugin.
 *
 * @param tree - The MDAST root node
 * @returns The serialized markdown string
 *
 * @example
 * ```typescript
 * import { parseMarkdown, stringifyMarkdown } from "../utils/remark-pipeline.js";
 *
 * const tree = parseMarkdown("# Hello\n\nWorld.");
 * const md = stringifyMarkdown(tree);
 * // "# Hello\n\nWorld.\n"
 * ```
 *
 * @internal
 */
export function stringifyMarkdown(tree: Root): string {
	const processor = createRemarkProcessor();
	return processor.stringify(tree);
}
