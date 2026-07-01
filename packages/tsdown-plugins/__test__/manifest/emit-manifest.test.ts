// packages/tsdown-plugins/__test__/manifest/emit-manifest.test.ts
import { describe, expect, it } from "vitest";
import { buildEmittedManifest, manifestNeedsCatalogResolution } from "../../src/manifest/emit-manifest.js";

describe("manifestNeedsCatalogResolution", () => {
	// Behavior 2: pure helper detects catalog:/workspace: specifiers across all four dependency fields.
	it("should detect catalog: and workspace: specifiers across all four dependency fields, and return false when none are present", () => {
		expect(manifestNeedsCatalogResolution({ dependencies: { effect: "catalog:silk" } })).toBe(true);
		expect(manifestNeedsCatalogResolution({ devDependencies: { "@x/p": "workspace:*" } })).toBe(true);
		expect(manifestNeedsCatalogResolution({ peerDependencies: { react: "catalog:silkPeers" } })).toBe(true);
		expect(manifestNeedsCatalogResolution({ optionalDependencies: { fsevents: "workspace:*" } })).toBe(true);
		expect(
			manifestNeedsCatalogResolution({
				name: "@x/p",
				version: "1.0.0",
				dependencies: { effect: "^3.0.0" },
				devDependencies: { vitest: "^2.0.0" },
			}),
		).toBe(false);
		expect(manifestNeedsCatalogResolution({ name: "@x/p", version: "1.0.0" })).toBe(false);
	});
});

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
