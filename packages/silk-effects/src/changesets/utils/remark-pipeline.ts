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
 * @see {@link MarkdownService} for the Effect service layer built on top
 *   of these primitives
 *
 * @internal
 */

import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/**
 * Create a unified processor configured with remark-parse, remark-gfm,
 * and remark-stringify.
 *
 * @remarks
 * Each call creates a fresh processor instance. The plugin chain is:
 * 1. `remark-parse` — markdown to MDAST
 * 2. `remark-gfm` — GitHub Flavored Markdown extensions (tables, etc.)
 * 3. `remark-stringify` — MDAST back to markdown
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
	return unified().use(remarkParse).use(remarkGfm).use(remarkStringify);
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
