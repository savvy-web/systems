import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { BiomeSyncOptions, BiomeSyncResult } from "../../src/schemas/BiomeConfig.js";
import {
	ConfigDiscoveryOptions,
	ConfigLocation,
	ConfigSource,
} from "../../src/schemas/ConfigDiscoverySchemas.js";

describe("BiomeSyncResult", () => {
	it("decodes a valid result object", () => {
		const decoded = Schema.decodeUnknownSync(BiomeSyncResult)({
			updated: ["biome.json"],
			skipped: [],
			current: ["other/biome.json"],
		});
		expect(decoded.updated).toEqual(["biome.json"]);
		expect(decoded.skipped).toEqual([]);
		expect(decoded.current).toEqual(["other/biome.json"]);
	});
});

describe("BiomeSyncOptions", () => {
	it("decodes with no fields (all optional)", () => {
		const decoded = Schema.decodeUnknownSync(BiomeSyncOptions)({});
		expect(decoded.gitignore).toBe(true);
	});

	it("decodes with explicit cwd", () => {
		const decoded = Schema.decodeUnknownSync(BiomeSyncOptions)({ cwd: "/project" });
		expect(decoded.cwd).toBe("/project");
	});
});

describe("ConfigSource", () => {
	it("accepts valid literals", () => {
		expect(Schema.decodeUnknownSync(ConfigSource)("lib")).toBe("lib");
		expect(Schema.decodeUnknownSync(ConfigSource)("root")).toBe("root");
		expect(Schema.decodeUnknownSync(ConfigSource)("cosmiconfig")).toBe("cosmiconfig");
	});
});

describe("ConfigLocation", () => {
	it("decodes a valid location", () => {
		const decoded = Schema.decodeUnknownSync(ConfigLocation)({ path: "/repo/lib/configs/biome.json", source: "lib" });
		expect(decoded.path).toBe("/repo/lib/configs/biome.json");
		expect(decoded.source).toBe("lib");
	});
});

describe("ConfigDiscoveryOptions", () => {
	it("decodes an empty object", () => {
		const decoded = Schema.decodeUnknownSync(ConfigDiscoveryOptions)({});
		expect(decoded.cwd).toBeUndefined();
		expect(decoded.tool).toBeUndefined();
	});

	it("decodes with cwd and tool", () => {
		const decoded = Schema.decodeUnknownSync(ConfigDiscoveryOptions)({ cwd: "/project", tool: "biome" });
		expect(decoded.cwd).toBe("/project");
		expect(decoded.tool).toBe("biome");
	});
});
