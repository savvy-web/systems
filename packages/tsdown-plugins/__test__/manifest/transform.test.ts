// packages/tsdown-plugins/__test__/manifest/transform.test.ts
import { describe, expect, it } from "vitest";
import { normalizeBinPaths, transformBin, transformExports, transformManifest } from "../../src/manifest/transform.js";

describe("manifest transform", () => {
	it("strips publishConfig + scripts and sets private from publishConfig.access", () => {
		const out = transformManifest({
			name: "@x/p",
			version: "1.0.0",
			scripts: { build: "x" },
			publishConfig: { access: "public", directory: "dist/dev" },
		});
		expect(out.scripts).toBeUndefined();
		expect(out.publishConfig).toBeUndefined();
		expect(out.private).toBe(false);
	});

	it("keeps private=true when access is not public", () => {
		expect(transformManifest({ name: "@x/p", version: "1.0.0" }).private).toBe(true);
		expect(transformManifest({ name: "@x/p", version: "1.0.0", publishConfig: { access: "restricted" } }).private).toBe(
			true,
		);
	});

	it("rewrites a TS string export to a types+import conditions object", () => {
		expect(transformExports({ ".": "./src/index.ts" })).toEqual({
			".": { types: "./index.d.ts", import: "./index.js" },
		});
	});

	it("rewrites TS bins to bin/<name>.js and strips leading ./", () => {
		expect(transformBin({ savvy: "./src/bin/cli.ts" })).toEqual({ savvy: "bin/savvy.js" });
		expect(transformBin("./src/bin/cli.ts")).toBe("bin/cli.js");
	});

	it("normalizeBinPaths strips leading ./ as the final guard", () => {
		expect(normalizeBinPaths({ savvy: "./bin/savvy.js" })).toEqual({ savvy: "bin/savvy.js" });
		expect(normalizeBinPaths("./bin/cli.js")).toBe("bin/cli.js");
	});

	it("runs sort-package-json (name before version before exports)", () => {
		const out = transformManifest({ exports: { ".": "./src/index.ts" }, version: "1.0.0", name: "@x/p" });
		expect(Object.keys(out).slice(0, 2)).toEqual(["name", "version"]);
	});
});
