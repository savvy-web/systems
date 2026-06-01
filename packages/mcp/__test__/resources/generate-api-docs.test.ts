import { describe, expect, it } from "vitest";

import { API_TARGETS } from "../../scripts/api-targets.js";
import { frontMatterFor } from "../../scripts/generate-api-docs.js";

const target = API_TARGETS.find((t) => t.dir === "silk-effects");
if (!target) throw new Error("silk-effects target missing");
const meta = { name: "ManagedSection", kind: "class" as const, slug: "managedsection", summary: "Tool-owned regions." };

describe("frontMatterFor", () => {
	const fm = frontMatterFor(target, meta);

	it("derives a tier-prefixed id under the package api namespace", () => {
		expect(fm.id).toBe("packages/silk-effects/api/class/managedsection");
		expect(fm.tier).toBe("packages");
	});

	it("marks the doc generated with empty related and the api + package tags", () => {
		expect(fm.source).toBe("generated");
		expect(fm.related).toEqual([]);
		expect(fm.tags).toEqual(["silk-effects", "api"]);
	});

	it("falls back to a synthesized summary when the item has none", () => {
		const fm2 = frontMatterFor(target, { ...meta, summary: "" });
		expect(fm2.summary.length).toBeGreaterThan(0);
		expect(fm2.summary.length).toBeLessThanOrEqual(160);
	});
});
