import { describe, expect, it } from "vitest";

import { registerAllResources } from "../../src/resources/index.js";
import type { Manifest } from "../../src/resources/schema.js";

const manifest: Manifest = {
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
	],
};
const bodies = { "silk://standards/commit-contract": "Use the savvy commit contract." };

function fakeServer() {
	const calls: Array<{ name: string; uriOrTemplate: unknown }> = [];
	return {
		calls,
		registerResource: (name: string, uriOrTemplate: unknown) => calls.push({ name, uriOrTemplate }),
	};
}

describe("registerAllResources", () => {
	it("registers the catalog as a fixed resource and exactly one template", () => {
		const server = fakeServer();
		registerAllResources(server as never, { manifest, bodies, contentRoot: "/x" });
		const fixed = server.calls.filter((c) => typeof c.uriOrTemplate === "string");
		const templates = server.calls.filter((c) => typeof c.uriOrTemplate !== "string");
		expect(fixed.map((f) => f.uriOrTemplate)).toEqual(["silk://catalog"]);
		expect(templates).toHaveLength(1);
	});
});
