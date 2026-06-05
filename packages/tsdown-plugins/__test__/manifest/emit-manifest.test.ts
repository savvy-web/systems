// packages/tsdown-plugins/__test__/manifest/emit-manifest.test.ts
import { describe, expect, it } from "vitest";
import { buildEmittedManifest } from "../../src/manifest/emit-manifest.js";

describe("buildEmittedManifest", () => {
	it("dev group with devManifest=preserve keeps catalog: specifiers and stays private", async () => {
		const out = await buildEmittedManifest({
			pkg: {
				name: "@x/p",
				version: "1.0.0",
				exports: { ".": "./src/index.ts" },
				dependencies: { effect: "catalog:silk" },
			},
			targetGroup: { id: "dev", isProd: false },
			devManifest: "preserve",
		});
		expect(out.dependencies).toEqual({ effect: "catalog:silk" });
		expect(out.exports).toEqual({ ".": { types: "./index.d.ts", import: "./index.js" } });
	});
});
