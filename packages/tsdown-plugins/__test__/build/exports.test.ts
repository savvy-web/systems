import { describe, expect, it } from "vitest";
import type { BuildPlatform, CssOptions, EntryOverride } from "../../src/index.js";

describe("tsdown-plugins public exports", () => {
	it("exposes BuildPlatform, CssOptions, and EntryOverride types", () => {
		const p: BuildPlatform = "browser";
		const css: CssOptions = { modules: { localsConvention: "camelCaseOnly" } };
		const ov: EntryOverride = { entry: { x: "./x.tsx" }, platform: p, css };
		expect(ov.platform).toBe("browser");
		expect(ov.css).toEqual({ modules: { localsConvention: "camelCaseOnly" } });
	});
});
