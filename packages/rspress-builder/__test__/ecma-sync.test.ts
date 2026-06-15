import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// rspress-builder ships a local ecma.json copy so the consumer tsconfig preset
// extends it relatively (./ecma.json) rather than reaching into
// @savvy-web/bundler, which may be transitive and not directly resolvable from
// the consumer's project root. This guard fails the moment the two drift.
describe("ecma.json sync", () => {
	it("rspress-builder/public/ecma.json is byte-identical to bundler/public/ecma.json", () => {
		const local = readFileSync(join(import.meta.dirname, "../public/ecma.json"), "utf-8");
		const canonical = readFileSync(join(import.meta.dirname, "../../bundler/public/ecma.json"), "utf-8");
		expect(local).toBe(canonical);
	});
});
