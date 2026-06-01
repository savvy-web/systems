import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { DocIndex } from "../../src/resources/doc-index.js";
import type { Manifest } from "../../src/resources/schema.js";
import { DocsSearchResult, formatDocsSearchMarkdown, runDocsSearch } from "../../src/tools/docs-search.js";

const manifest: Manifest = {
	generatedAt: "2026-05-31T00:00:00Z",
	entries: [
		{
			id: "standards/changeset-discipline",
			uri: "silk://standards/changeset-discipline",
			title: "Changeset discipline",
			summary: "When a changeset is required.",
			tier: "standards",
			source: "hand",
			status: "stable",
			tags: ["changeset"],
			audience: ["assistant"],
			priority: 0.8,
			related: [],
		},
	],
};

describe("docs-search tool", () => {
	const index = DocIndex.fromManifest(manifest, { "silk://standards/changeset-discipline": "ship a changeset" });

	it("DocsSearchResult validates the search output shape", () => {
		const results = index.search("changeset");
		const decoded = Schema.decodeUnknownSync(DocsSearchResult)({ query: "changeset", results });
		expect(decoded.results[0].uri).toBe("silk://standards/changeset-discipline");
	});

	it("renders a lean markdown transcript", () => {
		const md = formatDocsSearchMarkdown({ query: "changeset", results: index.search("changeset") });
		expect(md).toMatch(/changeset-discipline/);
		expect(md).toMatch(/high|medium|low/);
	});

	it("runDocsSearch invokes the logger with a formatted line", () => {
		const lines: string[] = [];
		const idx = DocIndex.fromManifest(manifest, { "silk://standards/changeset-discipline": "ship a changeset" });
		runDocsSearch(idx, "changeset", {}, (line) => lines.push(line));
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatch(/docs-search .*"query":"changeset"/);
	});

	it("DocsSearchHit carries the related ids", () => {
		const m: Manifest = {
			generatedAt: "2026-06-01T00:00:00Z",
			entries: [
				{
					id: "standards/a",
					uri: "silk://standards/a",
					title: "A",
					summary: "a.",
					tier: "standards",
					source: "hand",
					status: "stable",
					tags: ["changeset"],
					audience: ["assistant"],
					priority: 0.5,
					related: ["standards/b"],
				},
				{
					id: "standards/b",
					uri: "silk://standards/b",
					title: "B",
					summary: "b.",
					tier: "standards",
					source: "hand",
					status: "stable",
					tags: ["commit"],
					audience: ["assistant"],
					priority: 0.5,
					related: [],
				},
			],
		};
		const idx = DocIndex.fromManifest(m, { "silk://standards/a": "a", "silk://standards/b": "b" });
		const decoded = Schema.decodeUnknownSync(DocsSearchResult)({ query: "a", results: idx.search("a") });
		expect(decoded.results[0].related).toEqual(["standards/b"]);
	});
});
