// packages/tsdown-plugins/__test__/manifest/transform.test.ts
import { describe, expect, it } from "vitest";
import {
	defaultManifestTransform,
	normalizeBinPaths,
	transformBin,
	transformExports,
	transformManifest,
} from "../../src/manifest/transform.js";

describe("defaultManifestTransform", () => {
	it("strips every build/dev-only field from the manifest", () => {
		const out = defaultManifestTransform({
			pkg: {
				name: "@x/p",
				version: "1.0.0",
				dependencies: { effect: "^3" },
				devDependencies: { vitest: "^4" },
				bundleDependencies: ["a"],
				scripts: { build: "x" },
				publishConfig: { access: "public" },
				packageManager: "pnpm@11",
				devEngines: { runtime: { name: "node" } },
			},
		});
		expect(out.devDependencies).toBeUndefined();
		expect(out.bundleDependencies).toBeUndefined();
		expect(out.scripts).toBeUndefined();
		expect(out.publishConfig).toBeUndefined();
		expect(out.packageManager).toBeUndefined();
		expect(out.devEngines).toBeUndefined();
		// Consumer-facing fields are preserved.
		expect(out.name).toBe("@x/p");
		expect(out.dependencies).toEqual({ effect: "^3" });
	});

	it("is a no-op when none of the stripped fields are present", () => {
		const out = defaultManifestTransform({ pkg: { name: "@x/p", version: "1.0.0" } });
		expect(out).toEqual({ name: "@x/p", version: "1.0.0" });
	});

	it("does NOT mutate the supplied pkg (returns a stripped copy)", () => {
		const pkg = { name: "@x/p", version: "1.0.0", scripts: { build: "x" }, devDependencies: { vitest: "^4" } };
		const out = defaultManifestTransform({ pkg });
		// input is untouched
		expect(pkg.scripts).toEqual({ build: "x" });
		expect(pkg.devDependencies).toEqual({ vitest: "^4" });
		// output is the stripped copy
		expect(out).not.toBe(pkg);
		expect(out.scripts).toBeUndefined();
		expect(out.devDependencies).toBeUndefined();
	});
});

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

	it("emits require conditions only for export keys in a dual Set (per-entry dual)", () => {
		const exports = {
			"./changesets/markdownlint": "./src/changesets/markdownlint.ts",
			"./commitlint": "./src/commitlint/index.ts",
		};
		const out = transformExports(exports, new Set(["./changesets/markdownlint"])) as Record<
			string,
			Record<string, string>
		>;
		// markdownlint is in the set -> gets require
		expect(out["./changesets/markdownlint"].require).toBe("./changesets-markdownlint.cjs");
		expect(out["./changesets/markdownlint"].import).toBe("./changesets-markdownlint.js");
		// commitlint is NOT in the set -> import only, no require
		expect(out["./commitlint"].require).toBeUndefined();
		expect(out["./commitlint"].import).toBe("./commitlint.js");
	});

	it("treats dual:true as every TS export dual (back-compat) and dual:false as none", () => {
		const exports = { "./a": "./src/a.ts", "./b": "./src/b.ts" };
		const all = transformExports(exports, true) as Record<string, Record<string, string>>;
		expect(all["./a"].require).toBe("./a.cjs");
		expect(all["./b"].require).toBe("./b.cjs");
		const none = transformExports(exports, false) as Record<string, Record<string, string>>;
		expect(none["./a"].require).toBeUndefined();
		expect(none["./b"].require).toBeUndefined();
	});
});

describe("auto ./package.json export injection", () => {
	it("adds ./package.json to object exports that lack it", () => {
		const out = transformManifest({ name: "@x/p", version: "1.0.0", exports: { ".": "./src/index.ts" } });
		const exports = out.exports as Record<string, unknown>;
		expect(exports["./package.json"]).toBe("./package.json");
		expect(exports["."]).toEqual({ types: "./index.d.ts", import: "./index.js" });
	});

	it("does not duplicate or overwrite an existing ./package.json export", () => {
		const out = transformManifest({
			name: "@x/p",
			version: "1.0.0",
			exports: { ".": "./src/index.ts", "./package.json": "./package.json" },
		});
		const exports = out.exports as Record<string, unknown>;
		expect(exports["./package.json"]).toBe("./package.json");
	});

	it("injects ./package.json for a bare-string (root-only) exports, preserving the root under .", () => {
		const out = transformManifest({ name: "@x/p", version: "1.0.0", exports: "./src/index.ts" });
		const exports = out.exports as Record<string, unknown>;
		expect(exports["."]).toEqual({ types: "./index.d.ts", import: "./index.js" });
		expect(exports["./package.json"]).toBe("./package.json");
	});

	it("does not add an exports field when the manifest has none", () => {
		const out = transformManifest({ name: "@x/p", version: "1.0.0" });
		expect(out.exports).toBeUndefined();
	});
});
