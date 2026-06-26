import { describe, expect, it } from "vitest";

import { API_TARGETS } from "../../lib/scripts/api-targets.js";
import { frontMatterFor, indexFrontMatterFor, renderApiIndexBody } from "../../lib/scripts/generate-api-docs.js";

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

describe("api index page (#179)", () => {
	const items = [
		{ name: "defineBuild", kind: "function" as const, slug: "definebuild", summary: "Define a build config." },
		{ name: "BuildConfig", kind: "interface" as const, slug: "buildconfig", summary: "The build config shape." },
	];

	it("derives an index id at the bare api path that build:catalog will index", () => {
		const fm = indexFrontMatterFor(target, items.length);
		expect(fm.id).toBe("packages/silk-effects/api");
		expect(fm.tier).toBe("packages");
		expect(fm.source).toBe("generated");
		expect(fm.tags).toEqual(["silk-effects", "api"]);
	});

	it("names the package in the title so a package-level query matches", () => {
		const fm = indexFrontMatterFor(target, items.length);
		expect(fm.title).toContain("@savvy-web/silk-effects");
	});

	it("renders one silk:// link per symbol in the index body", () => {
		const body = renderApiIndexBody(target, items);
		expect(body).toContain("silk://packages/silk-effects/api/function/definebuild");
		expect(body).toContain("silk://packages/silk-effects/api/interface/buildconfig");
		expect(body).toContain("defineBuild");
		expect(body).toContain("BuildConfig");
	});
});
