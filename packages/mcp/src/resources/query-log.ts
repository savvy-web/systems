/**
 * Structured query logging for silk_docs_search. Emits a single JSON line per
 * query to stderr so corpus gaps surface over time. Privacy-clean: only the
 * query, the top result URIs, the top confidence, and the below-threshold flag.
 *
 * @packageDocumentation
 */

import type { SearchResult } from "./doc-index.js";

/** Build the structured stderr line for one search (pure; no I/O). */
export function formatQueryLogLine(query: string, results: ReadonlyArray<SearchResult>): string {
	const top = results.slice(0, 3);
	const belowThreshold = results.length === 0 || results.every((r) => r.confidenceLabel === "low");
	const payload = {
		query,
		topResults: top.map((r) => r.uri),
		topConfidence: results[0]?.confidence ?? 0,
		belowThreshold,
	};
	return `[savvy-mcp] docs-search ${JSON.stringify(payload)}`;
}

/** A sink for query log lines (defaults to stderr in the binary). */
export type QueryLogger = (line: string) => void;

/** Write a query log line to stderr. */
export const stderrQueryLogger: QueryLogger = (line) => {
	process.stderr.write(`${line}\n`);
};
