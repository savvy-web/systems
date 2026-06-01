import { describe, expect, it } from "vitest";

import type { McpContext } from "../src/context.js";
import { DocIndex } from "../src/resources/doc-index.js";
import type { Manifest } from "../src/resources/schema.js";
import { buildServer } from "../src/server.js";

describe("buildServer", () => {
	it("assembles the server, registering the tools and resources without throwing", () => {
		const manifest: Manifest = { generatedAt: "2026-05-31T00:00:00Z", entries: [] };
		const ctx: McpContext = {
			runtime: null as unknown as McpContext["runtime"],
			cwd: "/tmp",
			docIndex: DocIndex.fromManifest(manifest, {}),
			manifest,
			contentRoot: "/tmp",
		};
		const server = buildServer(ctx);
		expect(server).toBeDefined();
	});
});
