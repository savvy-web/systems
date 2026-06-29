import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// tsdown-plugins is upstream of @savvy-web/bundler, so it cannot extend
// @savvy-web/bundler/ecma.json without crossing a package boundary. It keeps a
// local copy that must stay byte-identical to the canonical, shipped bundler
// copy. This guard fails the suite the moment the two drift.
describe("ecma.json sync", () => {
	it("tsdown-plugins/ecma.json is byte-identical to bundler/public/tsconfig/ecma.json", () => {
		const local = readFileSync(join(import.meta.dirname, "../ecma.json"), "utf-8");
		const canonical = readFileSync(join(import.meta.dirname, "../../bundler/public/tsconfig/ecma.json"), "utf-8");
		expect(local).toBe(canonical);
	});
});
