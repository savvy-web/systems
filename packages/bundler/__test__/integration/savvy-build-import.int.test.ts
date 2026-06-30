// packages/bundler/__test__/integration/savvy-build-import.int.test.ts
import { describe, expect, it } from "vitest";

describe("savvy.build.ts import semantics", () => {
	it("importing the config does not trigger a build (import.meta.main false under vitest)", async () => {
		const mod = await import("./fixtures/dual-format/savvy.build.js");
		expect(mod.default.format).toEqual(["esm", "cjs"]);
		expect(mod.default.devManifest).toBe("preserve");
	});
});
