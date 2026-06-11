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
			targetGroup: { id: "dev", name: "@x/p", isProd: false },
			devManifest: "preserve",
		});
		expect(out.dependencies).toEqual({ effect: "catalog:silk" });
		expect(out.exports).toEqual({
			".": { types: "./index.d.ts", import: "./index.js" },
			"./package.json": "./package.json",
		});
	});

	it("applies the targetGroup name to package.json.name before the user transform runs", async () => {
		const seen: Array<string | undefined> = [];
		const out = await buildEmittedManifest({
			pkg: { name: "base", version: "1.0.0" } as never,
			targetGroup: { id: "github", name: "@scope/base", isProd: false },
			devManifest: "preserve",
			transform: ({ pkg }) => {
				seen.push((pkg as { name?: string }).name);
				return pkg;
			},
		});
		expect(seen[0]).toBe("@scope/base");
		expect((out as { name?: string }).name).toBe("@scope/base");
	});
});
