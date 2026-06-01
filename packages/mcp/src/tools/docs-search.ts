/**
 * The `silk_docs_search` MCP tool: a read-only Fuse-backed search over the
 * resource corpus. Takes a plain keyword/phrase query (no operator DSL),
 * returns ranked results with normalized higher-is-better confidence, and
 * never returns empty.
 *
 * @packageDocumentation
 */

import { ParseResult, Schema } from "effect";

import type { DocIndex, SearchResult } from "../resources/doc-index.js";
import type { QueryLogger } from "../resources/query-log.js";
import { formatQueryLogLine } from "../resources/query-log.js";

export const DocsSearchHit = Schema.Struct({
	uri: Schema.String,
	title: Schema.String,
	summary: Schema.String,
	tags: Schema.Array(Schema.String),
	tier: Schema.Literal("standards", "packages", "guides"),
	confidence: Schema.Number,
	confidenceLabel: Schema.Literal("high", "medium", "low"),
	matchedOn: Schema.Array(Schema.String),
	related: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] as ReadonlyArray<string> }),
}).annotations({ identifier: "DocsSearchHit" });

export const DocsSearchResult = Schema.Struct({
	query: Schema.String,
	results: Schema.Array(DocsSearchHit),
}).annotations({
	identifier: "DocsSearchResult",
	title: "silk_docs_search result",
	description: "Ranked Silk documentation matches. Fetch a hit with resources/read <uri>.",
});
export type DocsSearchResultType = Schema.Schema.Type<typeof DocsSearchResult>;

export const formatDocsSearchMarkdown = (data: DocsSearchResultType): string => {
	const lines: string[] = [`# silk_docs_search: ${data.query}`, ""];
	if (data.results.length === 0) {
		lines.push("No results. Read `silk://catalog` and select a doc by reasoning.");
		return lines.join("\n");
	}
	const allLow = data.results.every((r) => r.confidenceLabel === "low");
	if (allLow) lines.push("_No high-confidence match — read `silk://catalog` and pick by reasoning._", "");
	for (const r of data.results) {
		lines.push(`- \`${r.uri}\` (${r.confidenceLabel}) — ${r.title}. ${r.summary}`);
	}
	lines.push("", "Fetch any hit with `resources/read <uri>`.");
	return lines.join("\n");
};

export const DocsSearchResultAsMarkdown = Schema.transformOrFail(DocsSearchResult, Schema.String, {
	strict: true,
	decode: (data) => ParseResult.succeed(formatDocsSearchMarkdown(data)),
	encode: (text, _opts, ast) =>
		ParseResult.fail(new ParseResult.Forbidden(ast, text, "DocsSearchResultAsMarkdown is one-way.")),
});

/** Run a search against the in-memory index (synchronous; no Effect runtime). */
export const runDocsSearch = (
	index: DocIndex,
	query: string,
	opts: { limit?: number; tier?: "standards" | "packages" | "guides" },
	logger?: QueryLogger,
): DocsSearchResultType => {
	const results: SearchResult[] = index.search(query, opts);
	if (logger) logger(formatQueryLogLine(query, results));
	return { query, results };
};
