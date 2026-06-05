import { describe, expect, it } from "vitest";
import { BuildFailed, EntryDetectionError, ManifestEmitError, MetaGenerationError } from "../src/errors.js";

describe("typed errors", () => {
	it("EntryDetectionError and ManifestEmitError are tagged", () => {
		expect(new EntryDetectionError({ reason: "no exports" })._tag).toBe("EntryDetectionError");
		expect(new ManifestEmitError({ reason: "write failed" })._tag).toBe("ManifestEmitError");
	});

	it("BuildFailed carries the TargetGroup and reason", () => {
		const e = new BuildFailed({ targetGroup: "npm", reason: "tsdown threw" });
		expect(e._tag).toBe("BuildFailed");
		expect(e.message).toContain("npm");
	});

	it("MetaGenerationError carries the entry and reason", () => {
		const e = new MetaGenerationError({ entry: "index", reason: "extractor failed" });
		expect(e._tag).toBe("MetaGenerationError");
		expect(e.message).toContain("index");
	});
});
