import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

import { registerAllResources } from "../../src/resources/index.js";
import type { Manifest } from "../../src/resources/schema.js";

type ReadCallback = (uri: URL, variables: Record<string, unknown>) => Promise<unknown>;

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
	const calls: Array<{ name: string; uriOrTemplate: unknown; read?: ReadCallback | undefined }> = [];
	return {
		calls,
		registerResource: (name: string, uriOrTemplate: unknown, _config: unknown, read?: ReadCallback) =>
			calls.push({ name, uriOrTemplate, read }),
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

	it("maps a missing resource to a clean not-found error without leaking the host path (#178)", async () => {
		const server = fakeServer();
		// No `bodies` injection → the read goes through the filesystem and misses.
		registerAllResources(server as never, { manifest, contentRoot: "/nonexistent/content/root" });
		const read = server.calls.find((c) => c.name === "silk_doc")?.read;
		expect(read).toBeDefined();

		const uri = new URL("silk://packages/bundler/api");
		await expect(read?.(uri, { path: "packages/bundler/api" })).rejects.toThrow(McpError);
		await expect(read?.(uri, { path: "packages/bundler/api" })).rejects.toMatchObject({
			message: expect.stringContaining("silk://packages/bundler/api"),
		});
		const err = await read?.(uri, { path: "packages/bundler/api" }).catch((e: unknown) => e);
		expect(String((err as Error).message)).not.toContain("/nonexistent/content/root");
	});
});
