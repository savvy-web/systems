import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../src/resources/doc-index.js";

import { formatQueryLogLine } from "../../src/resources/query-log.js";

const hit = (uri: string, label: SearchResult["confidenceLabel"], confidence: number): SearchResult => ({
	uri,
	title: uri,
	summary: "",
	tags: [],
	tier: "standards",
	confidence,
	confidenceLabel: label,
	matchedOn: [],
	related: [],
});

describe("formatQueryLogLine", () => {
	it("emits a single JSON line tagged for docs-search", () => {
		const line = formatQueryLogLine("changeset bump", [hit("silk://standards/changeset-discipline", "high", 0.82)]);
		const parsed = JSON.parse(line.replace(/^\[savvy-mcp\] docs-search /, ""));
		expect(parsed.query).toBe("changeset bump");
		expect(parsed.belowThreshold).toBe(false);
		expect(parsed.topResults).toEqual(["silk://standards/changeset-discipline"]);
		expect(parsed.topConfidence).toBe(0.82);
	});

	it("flags a below-threshold (all-low) result set", () => {
		const line = formatQueryLogLine("zzz", [hit("silk://standards/x", "low", 0)]);
		const parsed = JSON.parse(line.replace(/^\[savvy-mcp\] docs-search /, ""));
		expect(parsed.belowThreshold).toBe(true);
	});

	it("returns an empty-result marker when there are no hits", () => {
		const line = formatQueryLogLine("zzz", []);
		const parsed = JSON.parse(line.replace(/^\[savvy-mcp\] docs-search /, ""));
		expect(parsed.belowThreshold).toBe(true);
		expect(parsed.topResults).toEqual([]);
	});
});
