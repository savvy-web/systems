import { describe, expect, it } from "vitest";
import { ConfigNotFoundError } from "../../src/errors/ConfigNotFoundError.js";
import { ReleaseChannelError } from "../../src/errors/ReleaseChannelError.js";
import { WorkspaceAnalysisError } from "../../src/errors/WorkspaceAnalysisError.js";

describe("WorkspaceAnalysisError", () => {
	it("has correct tag", () => {
		const err = new WorkspaceAnalysisError({ root: "/repo", reason: "discovery failed" });
		expect(err._tag).toBe("WorkspaceAnalysisError");
	});

	it("has human-readable message", () => {
		const err = new WorkspaceAnalysisError({ root: "/repo", reason: "no package.json" });
		expect(err.message).toBe("Workspace analysis failed at /repo: no package.json");
	});
});

describe("ConfigNotFoundError", () => {
	it("has correct tag", () => {
		const err = new ConfigNotFoundError({ name: "biome.json", searchedPaths: ["/root", "/root/lib"] });
		expect(err._tag).toBe("ConfigNotFoundError");
	});

	it("has human-readable message", () => {
		const err = new ConfigNotFoundError({ name: "biome.json", searchedPaths: ["/root/biome.json", "/lib/biome.json"] });
		expect(err.message).toBe("Config 'biome.json' not found. Searched: /root/biome.json, /lib/biome.json");
	});
});

describe("ReleaseChannelError", () => {
	it("has correct tag", () => {
		const err = new ReleaseChannelError({ pkg: "@scope/a", id: "npm", value: '"final"' });
		expect(err._tag).toBe("ReleaseChannelError");
	});

	it("has human-readable message", () => {
		const err = new ReleaseChannelError({ pkg: "@scope/a", id: "npm", value: '"final"' });
		expect(err.message).toBe(
			'Package @scope/a target "npm" declares releases "final", which is not one of "all", "stable" or "prerelease".',
		);
	});
});
