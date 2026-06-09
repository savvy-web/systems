// packages/tsdown-plugins/__test__/build/strip-maps.test.ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeDeclarationMaps } from "../../src/build/strip-maps.js";

describe("removeDeclarationMaps", () => {
	it("removes .d.ts.map and .d.cts.map (recursively) but keeps .d.ts/.d.cts/.js", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strip-"));
		writeFileSync(join(dir, "index.d.ts"), "export {};");
		writeFileSync(join(dir, "index.d.ts.map"), "{}");
		writeFileSync(join(dir, "index.d.cts"), "export {};");
		writeFileSync(join(dir, "index.d.cts.map"), "{}");
		writeFileSync(join(dir, "index.js"), "");
		mkdirSync(join(dir, "sub"));
		writeFileSync(join(dir, "sub", "a.d.ts.map"), "{}");

		const removed = removeDeclarationMaps(dir);

		expect(removed.sort()).toEqual(
			[join(dir, "index.d.cts.map"), join(dir, "index.d.ts.map"), join(dir, "sub", "a.d.ts.map")].sort(),
		);
		// maps gone
		expect(existsSync(join(dir, "index.d.ts.map"))).toBe(false);
		expect(existsSync(join(dir, "index.d.cts.map"))).toBe(false);
		expect(existsSync(join(dir, "sub", "a.d.ts.map"))).toBe(false);
		// declarations + js preserved
		expect(existsSync(join(dir, "index.d.ts"))).toBe(true);
		expect(existsSync(join(dir, "index.d.cts"))).toBe(true);
		expect(existsSync(join(dir, "index.js"))).toBe(true);
	});

	it("skips node_modules and returns [] for a missing directory", async () => {
		const dir = await mkdtemp(join(tmpdir(), "strip-"));
		mkdirSync(join(dir, "node_modules"));
		writeFileSync(join(dir, "node_modules", "dep.d.ts.map"), "{}");

		expect(removeDeclarationMaps(dir)).toEqual([]);
		expect(existsSync(join(dir, "node_modules", "dep.d.ts.map"))).toBe(true); // untouched
		expect(removeDeclarationMaps(join(dir, "does-not-exist"))).toEqual([]);
	});
});
