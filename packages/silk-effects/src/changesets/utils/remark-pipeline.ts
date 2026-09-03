/**
 * Remark parsing pipeline and the canonical stringify bridge.
 *
 * @remarks
 * Provides a shared, pre-configured unified processor with remark-parse and
 * remark-gfm for the PARSE side of the pipeline — markdown into an MDAST
 * tree, with consistent GFM support (tables, strikethrough, etc.) across all
 * markdown operations.
 *
 * The EMIT side no longer lives here: {@link stringifyMarkdown} delegates to
 * the canonical `@effected/markdown` stringifier via
 * `../utils/markdown-emit.js`, whose output form is a documented stability
 * commitment of that package. The old remark-stringify emit — and with it
 * the literal-text handler that suppressed cell escaping — is gone: the
 * canonical stringifier escapes inline text minimally (`~` as `\~`, a
 * word-edge `_` as `\_`; an interior `snake_case` underscore stays raw), and
 * parsing consumes those escapes, so cell values still round-trip
 * byte-identically through parse.
 *
 * @internal
 */

import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { emitMarkdown } from "./markdown-emit.js";

/**
 * Create a unified processor configured with remark-parse and remark-gfm.
 *
 * @remarks
 * Each call creates a fresh processor instance. The plugin chain is:
 * 1. `remark-parse` — markdown to MDAST
 * 2. `remark-gfm` — GitHub Flavored Markdown extensions (tables, etc.)
 *
 * The processor carries no compiler: stringification goes through
 * {@link stringifyMarkdown}, never `processor.stringify`.
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
	return unified().use(remarkParse).use(remarkGfm);
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
 * Stringify an MDAST AST back to markdown text synchronously.
 *
 * @remarks
 * Delegates to the canonical `@effected/markdown` emit boundary
 * (`emitMarkdown`), so the output is the kit's canonical form — ATX
 * headings, `-` bullets, `*`/`**` emphasis, `***` thematic breaks, one
 * blank line between blocks, a single trailing newline. GFM constructs
 * (tables, strikethrough) are serialized natively.
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
	return emitMarkdown(tree);
}
