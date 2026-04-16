import { describe, expect, it } from "vitest";
import { CheckResult, SectionDiff, SyncResult } from "../../src/schemas/SectionResults.js";

describe("SectionDiff", () => {
	it("creates Unchanged variant", () => {
		const d = SectionDiff.Unchanged();
		expect(d._tag).toBe("Unchanged");
	});

	it("creates Changed variant with added/removed lines", () => {
		const d = SectionDiff.Changed({ added: ["line1"], removed: ["line2"] });
		expect(d._tag).toBe("Changed");
		expect(d.added).toEqual(["line1"]);
		expect(d.removed).toEqual(["line2"]);
	});
});

describe("SyncResult", () => {
	it("creates Created variant", () => {
		const r = SyncResult.Created();
		expect(r._tag).toBe("Created");
	});

	it("creates Updated variant with diff", () => {
		const diff = SectionDiff.Changed({ added: ["new"], removed: ["old"] });
		const r = SyncResult.Updated({ diff });
		expect(r._tag).toBe("Updated");
		expect(r.diff._tag).toBe("Changed");
	});

	it("creates Unchanged variant", () => {
		const r = SyncResult.Unchanged();
		expect(r._tag).toBe("Unchanged");
	});
});

describe("CheckResult", () => {
	it("creates NotFound variant", () => {
		const r = CheckResult.NotFound();
		expect(r._tag).toBe("NotFound");
	});

	it("creates Found variant", () => {
		const diff = SectionDiff.Unchanged();
		const r = CheckResult.Found({ isUpToDate: true, diff });
		expect(r._tag).toBe("Found");
		expect(r.isUpToDate).toBe(true);
	});
});
