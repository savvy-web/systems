// packages/bundler/__test__/integration/savvy-build-import.int.test.ts
import { describe, expect, it } from "vitest";

describe("savvy.build.ts import semantics", () => {
	it("importing the config does not trigger a build (import.meta.main false under vitest)", async () => {
		// Indirected through a variable so TS does not fold the excluded fixture
		// (savvy.build.ts under __test__/fixtures is excluded from the program) into
		// this project's file list (TS6307). Runtime import is unaffected.
		const specifier = "./fixtures/dual-format/savvy.build.js";
		const mod = await import(specifier);
		expect(mod.default.format).toEqual(["esm", "cjs"]);
		expect(mod.default.devManifest).toBe("preserve");
	});
});
