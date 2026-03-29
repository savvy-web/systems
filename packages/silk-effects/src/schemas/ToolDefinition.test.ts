import { Equal, Hash } from "effect";
import { describe, expect, it } from "vitest";
import { ToolDefinition } from "./ToolDefinition.js";
import { ResolutionPolicy, SourceRequirement, VersionExtractor } from "./ToolResults.js";

describe("ToolDefinition", () => {
	describe("make", () => {
		it("creates with name and defaults", () => {
			const def = ToolDefinition.make({ name: "biome" });
			expect(def.name).toBe("biome");
			expect(def._tag).toBe("ToolDefinition");
			expect(def.versionExtractor._tag).toBe("Flag");
			expect(def.policy._tag).toBe("Report");
			expect(def.source._tag).toBe("Any");
		});

		it("creates with explicit options", () => {
			const def = ToolDefinition.make({
				name: "biome",
				versionExtractor: VersionExtractor.None(),
				policy: ResolutionPolicy.RequireMatch(),
				source: SourceRequirement.OnlyLocal(),
			});
			expect(def.versionExtractor._tag).toBe("None");
			expect(def.policy._tag).toBe("RequireMatch");
			expect(def.source._tag).toBe("OnlyLocal");
		});

		it("default versionExtractor uses --version flag", () => {
			const def = ToolDefinition.make({ name: "biome" });
			if (def.versionExtractor._tag === "Flag") {
				expect(def.versionExtractor.flag).toBe("--version");
			}
		});
	});

	describe("Equal/Hash", () => {
		it("equal when same name", () => {
			const a = ToolDefinition.make({ name: "biome" });
			const b = ToolDefinition.make({ name: "biome" });
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("not equal when different name", () => {
			const a = ToolDefinition.make({ name: "biome" });
			const b = ToolDefinition.make({ name: "eslint" });
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("equal definitions have same hash", () => {
			const a = ToolDefinition.make({ name: "biome" });
			const b = ToolDefinition.make({ name: "biome" });
			expect(Hash.hash(a)).toBe(Hash.hash(b));
		});

		it("equal even with different options (identity is name only)", () => {
			const a = ToolDefinition.make({ name: "biome", source: SourceRequirement.OnlyLocal() });
			const b = ToolDefinition.make({ name: "biome", source: SourceRequirement.Any() });
			expect(Equal.equals(a, b)).toBe(true);
		});
	});
});
