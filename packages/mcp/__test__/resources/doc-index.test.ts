import { describe, expect, it } from "vitest";

import { DocIndex } from "../../src/resources/doc-index.js";
import type { Manifest } from "../../src/resources/schema.js";

const manifest: Manifest = {
	generatedAt: "2026-05-31T00:00:00Z",
	entries: [
		{
			id: "standards/changeset-discipline",
			uri: "silk://standards/changeset-discipline",
			title: "Changeset discipline",
			summary: "When and why a changeset is required.",
			tier: "standards",
			source: "hand",
			status: "stable",
			tags: ["changeset", "release"],
			audience: ["assistant"],
			priority: 0.8,
			related: [],
		},
		{
			id: "standards/commit-contract",
			uri: "silk://standards/commit-contract",
			title: "Commit contract",
			summary: "The conventional-commit type enum, tdd scope, DCO signoff.",
			tier: "standards",
			source: "hand",
			status: "stable",
			tags: ["commit", "dco", "tdd"],
			audience: ["assistant"],
			priority: 0.5,
			related: [],
		},
	],
};
const bodies = {
	"silk://standards/changeset-discipline": "Every user-facing change ships a changeset.",
	"silk://standards/commit-contract": "Use the savvy commit contract.",
};

describe("DocIndex", () => {
	const index = DocIndex.fromManifest(manifest, bodies);

	it("returns the relevant doc first for a keyword query", () => {
		const results = index.search("changeset");
		expect(results[0].uri).toBe("silk://standards/changeset-discipline");
		expect(results[0].confidence).toBeGreaterThan(0.5);
		expect(results[0].confidenceLabel).toBe("high");
	});

	it("never returns empty: a no-match query yields top-N below threshold", () => {
		const results = index.search("zzzznomatch");
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((r) => r.confidenceLabel === "low")).toBe(true);
	});

	it("breaks ties by priority", () => {
		const results = index.search("the");
		expect(results[0].uri).toBe("silk://standards/changeset-discipline");
	});

	it("scopes by tier when requested", () => {
		const results = index.search("commit", { tier: "standards" });
		expect(results.every((r) => r.tier === "standards")).toBe(true);
	});

	it("surfaces a doc when the query term appears only in its body", () => {
		const m: Manifest = {
			generatedAt: "2026-06-01T00:00:00Z",
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
					priority: 0.5,
					related: [],
				},
			],
		};
		const idx = DocIndex.fromManifest(m, {
			"silk://standards/commit-contract": "Bodies mention quadrupedalism as a unique token.",
		});
		const results = idx.search("quadrupedalism");
		expect(results[0]?.uri).toBe("silk://standards/commit-contract");
		expect(results[0]?.matchedOn).toContain("body");
	});

	it("excludes deprecated docs from the index", () => {
		const withDeprecated: Manifest = {
			generatedAt: manifest.generatedAt,
			entries: [
				...manifest.entries,
				{
					id: "standards/legacy-policy",
					uri: "silk://standards/legacy-policy",
					title: "Legacy changeset policy",
					summary: "The retired changeset policy.",
					tier: "standards",
					source: "hand",
					status: "deprecated",
					tags: ["changeset"],
					audience: ["assistant"],
					priority: 0.9,
					related: [],
				},
			],
		};
		const idx = DocIndex.fromManifest(withDeprecated, {
			...bodies,
			"silk://standards/legacy-policy": "Old policy.",
		});
		const uris = idx.search("changeset").map((r) => r.uri);
		expect(uris).not.toContain("silk://standards/legacy-policy");
	});
});
