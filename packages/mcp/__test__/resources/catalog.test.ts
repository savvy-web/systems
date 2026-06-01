import { describe, expect, it } from "vitest";

import { renderCatalogMarkdown } from "../../src/resources/catalog.js";
import type { Manifest } from "../../src/resources/schema.js";

const manifest: Manifest = {
	generatedAt: "2026-05-31T00:00:00Z",
	entries: [
		{
			id: "standards/commit-contract",
			uri: "silk://standards/commit-contract",
			title: "Commit contract",
			summary: "Commit rules.",
			tier: "standards",
			source: "hand",
			status: "stable",
			tags: ["commit"],
			audience: ["assistant"],
			priority: 0.8,
			related: [],
		},
		{
			id: "packages/silk-effects/",
			uri: "silk://packages/silk-effects/",
			title: "silk-effects overview",
			summary: "Service map.",
			tier: "packages",
			source: "generated",
			status: "stable",
			tags: ["silk-effects"],
			audience: ["assistant"],
			priority: 0.5,
			related: [],
		},
	],
};

describe("renderCatalogMarkdown", () => {
	const md = renderCatalogMarkdown(manifest);

	it("groups by tier and lists uris with summaries", () => {
		expect(md).toMatch(/## Standards/);
		expect(md).toMatch(/silk:\/\/standards\/commit-contract.*Commit rules\./);
	});

	it("explains how to fetch a doc", () => {
		expect(md).toMatch(/resources\/read/);
	});

	it("marks generated docs", () => {
		expect(md).toMatch(/silk:\/\/packages\/silk-effects\/.*\(generated\)/);
	});
});
