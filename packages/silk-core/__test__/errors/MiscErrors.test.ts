import { describe, expect, it } from "vitest";
import { BiomeSyncError, BiomeSyncErrorCode } from "../../src/errors/BiomeSyncError.js";
import { ConfigNotFoundError } from "../../src/errors/ConfigNotFoundError.js";
import { ReleaseChannelError } from "../../src/errors/ReleaseChannelError.js";
import { WorkspaceAnalysisError } from "../../src/errors/WorkspaceAnalysisError.js";

describe("BiomeSyncError", () => {
	it.each([
		["read-failed", "could not read"],
		["parse-failed", "is not valid JSONC"],
		["edit-failed", "could not update $schema"],
		["write-failed", "could not write"],
	] as const)("derives the %s message from path and code", (code, phrase) => {
		const cause = new Error("underlying detail");
		const err = new BiomeSyncError({ path: "/repo/biome.json", code, cause });
		expect(err._tag).toBe("BiomeSyncError");
		expect(err.cause).toBe(cause);
		expect(err.message).toBe(`Failed to sync biome schema in /repo/biome.json: ${phrase}`);
	});

	it("lists exactly the four failure codes", () => {
		expect(BiomeSyncErrorCode.literals).toEqual(["read-failed", "parse-failed", "edit-failed", "write-failed"]);
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
