import { describe, expect, it } from "vitest";

import { API_TARGETS } from "../../scripts/api-targets.js";

describe("API_TARGETS", () => {
	it("lists the in-monorepo packages to generate API docs for", () => {
		const dirs = API_TARGETS.map((t) => t.dir);
		expect(dirs).toContain("silk-effects");
		expect(dirs).toContain("github-action-effects");
	});

	it("every target has a package name, dir, model basename, and tier-safe id prefix", () => {
		for (const t of API_TARGETS) {
			expect(t.packageName.startsWith("@savvy-web/")).toBe(true);
			expect(t.idPrefix).toMatch(/^packages\/[a-z0-9-]+$/);
			expect(t.modelBasename).toMatch(/\.api\.json$/);
		}
	});

	it("excludes the non-library silk and cli, and excludes mcp itself (no self-build cycle)", () => {
		const dirs = API_TARGETS.map((t) => t.dir);
		expect(dirs).not.toContain("silk");
		expect(dirs).not.toContain("cli");
		expect(dirs).not.toContain("mcp");
	});
});
