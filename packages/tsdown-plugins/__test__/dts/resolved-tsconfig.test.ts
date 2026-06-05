// packages/tsdown-plugins/__test__/dts/resolved-tsconfig.test.ts

import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import { buildResolvedTsconfig } from "../../src/dts/resolved-tsconfig.js";

describe("buildResolvedTsconfig", () => {
	it("emits absolute rootDir/include/typeRoots and disables composite/incremental", () => {
		const cfg = buildResolvedTsconfig({ cwd: "/abs/pkg", types: ["node", "vitest"] });
		expect(isAbsolute(cfg.compilerOptions.rootDir as string)).toBe(true);
		expect(cfg.compilerOptions.composite).toBe(false);
		expect(cfg.compilerOptions.incremental).toBe(false);
		expect(cfg.compilerOptions.types).toEqual(["node", "vitest"]);
		expect((cfg.include as string[]).every(isAbsolute)).toBe(true);
		expect((cfg.compilerOptions.typeRoots as string[]).every(isAbsolute)).toBe(true);
	});

	it("defaults types to ['node'] when none forwarded", () => {
		expect(buildResolvedTsconfig({ cwd: "/abs/pkg" }).compilerOptions.types).toEqual(["node"]);
	});
});
