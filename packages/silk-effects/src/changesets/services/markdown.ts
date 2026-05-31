/**
 * Markdown service for parsing and stringifying mdast trees.
 *
 * Defines the {@link MarkdownService} Effect service tag and the
 * {@link MarkdownLive | production layer} backed by the remark/unified
 * pipeline. This service provides a pure, side-effect-free interface to
 * markdown parsing and stringification used throughout the changelog
 * formatter and remark transform pipeline.
 *
 * @remarks
 * The service wraps the `remark-pipeline` utility functions (`parseMarkdown`
 * and `stringifyMarkdown`) behind an Effect interface. The `parse` operation
 * returns an mdast `Root` node; the `stringify` operation serializes an
 * mdast `Root` back to a markdown string. Both operations are synchronous
 * under the hood but are lifted into `Effect.sync` for composability.
 *
 * @see {@link MarkdownService} for the Effect service tag
 * @see {@link MarkdownServiceShape} for the service interface
 * @see {@link MarkdownLive} for the production layer
 */

import { Context, Effect, Layer } from "effect";
import type { Root } from "mdast";

import { parseMarkdown, stringifyMarkdown } from "../utils/remark-pipeline.js";

/**
 * Service interface for markdown parsing and stringification.
 *
 * Describes the two operations a `MarkdownService` implementation must
 * provide: parsing markdown text into an mdast AST and stringifying an
 * mdast AST back to markdown text.
 *
 * @remarks
 * Both operations are infallible (no error channel) because the underlying
 * remark pipeline is configured to handle all valid markdown input. The
 * `Root` type comes from the `mdast` package and represents the root node
 * of a markdown abstract syntax tree.
 *
 * @public
 */
export interface MarkdownServiceShape {
	/**
	 * Parse a markdown string into an mdast abstract syntax tree.
	 *
	 * @param content - Raw markdown text to parse
	 * @returns An `Effect` that resolves to an mdast `Root` node
	 */
	readonly parse: (content: string) => Effect.Effect<Root>;

	/**
	 * Stringify an mdast abstract syntax tree back to markdown text.
	 *
	 * @param tree - The mdast `Root` node to serialize
	 * @returns An `Effect` that resolves to a markdown string
	 */
	readonly stringify: (tree: Root) => Effect.Effect<string>;
}

const _tag = Context.Tag("MarkdownService");

/**
 * Base class for MarkdownService.
 *
 * @privateRemarks
 * This export is required for api-extractor documentation generation.
 * Effect's Context.Tag creates an anonymous base class that must be
 * explicitly exported to avoid "forgotten export" warnings. Do not delete.
 *
 * @internal
 */
export const MarkdownServiceBase = _tag<MarkdownService, MarkdownServiceShape>();

/**
 * Effect service tag for markdown parsing and stringification.
 *
 * Provides dependency-injected access to markdown parse/stringify operations.
 * Use `yield* MarkdownService` inside an `Effect.gen` block to obtain the
 * service instance.
 *
 * @remarks
 * This tag follows the standard Effect `Context.Tag` pattern. The
 * {@link MarkdownLive} layer provides the default implementation backed by
 * the remark/unified pipeline. For testing, you can supply a custom layer
 * via `Layer.succeed(MarkdownService, { parse: ..., stringify: ... })`.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { MarkdownService, MarkdownLive } from "\@savvy-web/changesets";
 *
 * const program = Effect.gen(function* () {
 *   const md = yield* MarkdownService;
 *   const tree = yield* md.parse("# Hello\n\nWorld");
 *   const output = yield* md.stringify(tree);
 *   console.log(output); // "# Hello\n\nWorld\n"
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(MarkdownLive)));
 * ```
 *
 * @see {@link MarkdownServiceShape} for the service interface
 * @see {@link MarkdownLive} for the production layer
 * @see {@link MarkdownServiceBase} for the api-extractor base class
 *
 * @public
 */
export class MarkdownService extends MarkdownServiceBase {}

/**
 * Production layer for {@link MarkdownService}.
 *
 * Wraps the remark-pipeline utility functions (`parseMarkdown` and
 * `stringifyMarkdown`) in `Effect.sync` for use in Effect programs.
 * Both operations are synchronous and infallible.
 *
 * @remarks
 * This layer is composed with {@link GitHubLive} in the
 * `\@savvy-web/changesets/changelog` entry point to form the `MainLayer`
 * that powers the Changesets API integration.
 *
 * @example
 * ```typescript
 * import { Effect, Layer } from "effect";
 * import { MarkdownService, MarkdownLive } from "\@savvy-web/changesets";
 *
 * const program = Effect.gen(function* () {
 *   const md = yield* MarkdownService;
 *   const tree = yield* md.parse("**bold** text");
 *   return yield* md.stringify(tree);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(MarkdownLive)));
 * ```
 *
 * @public
 */
export const MarkdownLive = Layer.succeed(MarkdownService, {
	parse: (content) => Effect.sync(() => parseMarkdown(content)),
	stringify: (tree) => Effect.sync(() => stringifyMarkdown(tree)),
});
