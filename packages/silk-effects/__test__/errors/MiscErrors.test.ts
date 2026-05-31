import { describe, expect, it } from "vitest";
import { ConfigNotFoundError } from "../../src/errors/ConfigNotFoundError.js";
import { TagFormatError } from "../../src/errors/TagFormatError.js";
import { WorkspaceAnalysisError } from "../../src/errors/WorkspaceAnalysisError.js";

describe("TagFormatError", () => {
	it("has correct tag", () => {
		const err = new TagFormatError({ name: "@scope/pkg", version: "", reason: "empty version" });
		expect(err._tag).toBe("TagFormatError");
	});

	it("has human-readable message", () => {
		const err = new TagFormatError({ name: "@scope/pkg", version: "1.0.0", reason: "invariant violated" });
		expect(err.message).toBe("Failed to format tag for @scope/pkg@1.0.0: invariant violated");
	});
});

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
