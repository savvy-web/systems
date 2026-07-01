import { describe, expect, it } from "vitest";

import type { McpContext } from "../src/context.js";
import { buildServer } from "../src/server.js";

describe("buildServer", () => {
	it("assembles the server, registering the tools without throwing", () => {
		const ctx: McpContext = {
			runtime: null as unknown as McpContext["runtime"],
			cwd: "/tmp",
		};
		const server = buildServer(ctx);
		expect(server).toBeDefined();
	});

	it("registers exactly eight tools including the two changeset deps tools", () => {
		const ctx: McpContext = {
			runtime: null as unknown as McpContext["runtime"],
			cwd: "/tmp",
		};
		const server = buildServer(ctx);
		const registered = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
		const names = Object.keys(registered).sort();
		expect(names).toEqual(
			[
				"biome_check",
				"changeset_deps_detect",
				"changeset_deps_regen",
				"changeset_inspect",
				"changeset_preview",
				"changeset_validate",
				"turbo_inspect",
				"workspace_info",
			].sort(),
		);
		expect(names).toHaveLength(8);
	});
});
