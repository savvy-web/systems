import { describe, expect, it } from "vitest";

import type { McpContext } from "../src/context.js";
import { buildServer } from "../src/server.js";

describe("buildServer", () => {
	it("assembles the server, registering the tool and resources without throwing", () => {
		const ctx: McpContext = { runtime: null as unknown as McpContext["runtime"], cwd: "/tmp" };
		const server = buildServer(ctx);
		expect(server).toBeDefined();
	});
});
