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
		expect(transformExports({ ".": "./src/index.ts" }, false)).toEqual({
			".": { types: "./index.d.ts", import: "./index.js" },
		});
	});

	it("derives a nested subpath export's output from the flat entry name (not the source path)", () => {
		expect(transformExports({ "./commitlint": "./src/commitlint/index.ts" }, false)).toEqual({
			"./commitlint": { types: "./commitlint.d.ts", import: "./commitlint.js" },
		});
	});

	it("derives a deeper nested subpath export's output as a dash-joined flat basename", () => {
		expect(transformExports({ "./changesets/markdownlint": "./src/changesets/markdownlint/index.ts" }, false)).toEqual({
			"./changesets/markdownlint": {
				types: "./changesets-markdownlint.d.ts",
				import: "./changesets-markdownlint.js",
			},
		});
	});

	it("emits import-only conditions for a TS export when not dual-format", () => {
		expect(transformExports({ "./changesets": "./src/changesets/index.ts" }, false)).toEqual({
			"./changesets": { types: "./changesets.d.ts", import: "./changesets.js" },
		});
	});

	it("emits both import and require conditions for a nested TS export when dual-format", () => {
		expect(transformExports({ "./commitlint": "./src/commitlint/index.ts" }, true)).toEqual({
			"./commitlint": {
				types: "./commitlint.d.ts",
				import: "./commitlint.js",
				require: "./commitlint.cjs",
			},
		});
	});

	it("keeps a flat/root export byte-identical to the emitted index file in dual-format", () => {
		expect(transformExports({ ".": "./src/index.ts" }, true)).toEqual({
			".": { types: "./index.d.ts", import: "./index.js", require: "./index.cjs" },
		});
	});

	it("leaves a non-TS (e.g. .jsonc/.json) export untouched in both modes", () => {
		expect(transformExports({ "./asset": "./src/asset.jsonc" }, true)).toEqual({ "./asset": "./src/asset.jsonc" });
		expect(transformExports({ "./biome": "./public/biome/silk.jsonc" }, true)).toEqual({
			"./biome": "./public/biome/silk.jsonc",
		});
	});

	it("preserves a representative flat leaf export map byte-identically (regression)", () => {
		expect(transformExports({ ".": "./src/index.ts", "./asset": "./public/ecma.json" }, false)).toEqual({
			".": { types: "./index.d.ts", import: "./index.js" },
			"./asset": "./public/ecma.json",
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
