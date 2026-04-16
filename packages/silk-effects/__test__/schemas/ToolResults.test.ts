import { describe, expect, it } from "vitest";
import { ResolutionPolicy, SourceRequirement, VersionExtractor } from "../../src/schemas/ToolResults.js";

describe("VersionExtractor", () => {
	it("creates Flag variant with defaults", () => {
		const v = VersionExtractor.Flag({ flag: "--version" });
		expect(v._tag).toBe("Flag");
		expect(v.flag).toBe("--version");
	});

	it("creates Flag variant with custom parse", () => {
		const parse = (s: string) => s.trim();
		const v = VersionExtractor.Flag({ flag: "--version", parse });
		expect(v._tag).toBe("Flag");
		expect(v.parse).toBe(parse);
	});

	it("creates Json variant", () => {
		const v = VersionExtractor.Json({ flag: "version --json", path: "version" });
		expect(v._tag).toBe("Json");
		expect(v.flag).toBe("version --json");
		expect(v.path).toBe("version");
	});

	it("creates None variant", () => {
		const v = VersionExtractor.None();
		expect(v._tag).toBe("None");
	});
});

describe("ResolutionPolicy", () => {
	it("creates Report variant", () => {
		expect(ResolutionPolicy.Report()._tag).toBe("Report");
	});

	it("creates PreferLocal variant", () => {
		expect(ResolutionPolicy.PreferLocal()._tag).toBe("PreferLocal");
	});

	it("creates PreferGlobal variant", () => {
		expect(ResolutionPolicy.PreferGlobal()._tag).toBe("PreferGlobal");
	});

	it("creates RequireMatch variant", () => {
		expect(ResolutionPolicy.RequireMatch()._tag).toBe("RequireMatch");
	});
});

describe("SourceRequirement", () => {
	it("creates Any variant", () => {
		expect(SourceRequirement.Any()._tag).toBe("Any");
	});

	it("creates OnlyLocal variant", () => {
		expect(SourceRequirement.OnlyLocal()._tag).toBe("OnlyLocal");
	});

	it("creates OnlyGlobal variant", () => {
		expect(SourceRequirement.OnlyGlobal()._tag).toBe("OnlyGlobal");
	});

	it("creates Both variant", () => {
		expect(SourceRequirement.Both()._tag).toBe("Both");
	});
});
