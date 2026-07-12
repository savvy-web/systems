// packages/tsdown-plugins/__test__/build/target-groups.test.ts
import { describe, expect, it } from "vitest";
import { deriveDtsPassOptions, deriveTargetGroupOptions } from "../../src/build/target-groups.js";

describe("deriveTargetGroupOptions (JS pass)", () => {
	const base = { cwd: "/abs/pkg", version: "1.2.3", entry: { index: "./src/index.ts" }, tsconfigPath: "/tmp/t.json" };

	it("dev group -> dist/dev/pkg, sourcemaps on, minify off, not prod", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(o.sourcemap).toBe(true);
		expect(o.minify).toBe(false);
		expect(o.format).toEqual(["esm"]);
		expect(o.platform).toBe("node");
		expect(o.define["process.env.__PACKAGE_VERSION__"]).toBe(JSON.stringify("1.2.3"));
		expect(o.define.__PACKAGE_VERSION__).toBeUndefined();
	});

	it("JS pass emits per-module JS with no dts (unbundle true, dts false, clean true)", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.unbundle).toBe(true);
		expect(o.dts).toBe(false);
		expect(o.clean).toBe(true);
	});

	it("npm group -> dist/prod/npm/pkg, sourcemaps off, minify off by default", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "npm", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/prod/npm/pkg");
		expect(o.sourcemap).toBe(false);
		// Default is unminified: Node libraries favor readable output.
		expect(o.minify).toBe(false);
	});

	it("prod group minifies only when minify:true is passed", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "npm", devManifest: "preserve", minify: true });
		expect(o.minify).toBe(true);
	});

	it("dev group never minifies even with minify:true (prod-only option)", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve", minify: true });
		expect(o.minify).toBe(false);
	});

	it("folders an arbitrary prod group id under dist/prod/<id>/pkg", () => {
		const derived = deriveTargetGroupOptions({
			group: "github",
			cwd: "/abs/pkg",
			version: "1.0.0",
			entry: { index: "src/index.ts" },
			tsconfigPath: "/abs/pkg/tsconfig.json",
			devManifest: "preserve",
		});
		expect(derived.outDir).toBe("/abs/pkg/dist/prod/github/pkg");
		expect(derived.isProd).toBe(true);
	});

	it("forwards an explicit esm+cjs format", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve", format: ["esm", "cjs"] });
		expect(o.format).toEqual(["esm", "cjs"]);
	});

	it("sets fixedExtension false for esm-only (default)", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.fixedExtension).toBe(false);
	});

	it("keeps fixedExtension false for esm+cjs (tsdown derives .js/.cjs for type:module)", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve", format: ["esm", "cjs"] });
		expect(o.fixedExtension).toBe(false);
	});

	it("never carries bundledPackages on the JS pass (dts-only concern)", () => {
		const o = deriveTargetGroupOptions({
			...base,
			group: "dev",
			devManifest: "preserve",
			bundledPackages: ["@commitlint/types"],
		} as never);
		expect((o as unknown as Record<string, unknown>).bundledPackages).toBeUndefined();
	});

	it("turns preserveModules OFF (unbundle:false) when bundleNodeModules is set", () => {
		// bundleNodeModules promises a self-contained artifact; a per-module (preserveModules)
		// JS pass writes every inlined node_modules dependency to its own sibling file, which
		// `npm pack` strips, breaking that promise for the esm output. See the TSDoc on
		// DerivedTsdownOptions.unbundle for the full finding.
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve", bundleNodeModules: true });
		expect(o.unbundle).toBe(false);
	});

	it("keeps preserveModules ON (unbundle:true) when bundleNodeModules is false or absent", () => {
		const withFalse = deriveTargetGroupOptions({
			...base,
			group: "dev",
			devManifest: "preserve",
			bundleNodeModules: false,
		});
		expect(withFalse.unbundle).toBe(true);
		const withAbsent = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(withAbsent.unbundle).toBe(true);
	});

	it("turns preserveModules off for a prod group too when bundleNodeModules is set", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "npm", devManifest: "preserve", bundleNodeModules: true });
		expect(o.unbundle).toBe(false);
		expect(o.isProd).toBe(true);
	});
});

describe("deriveDtsPassOptions (dts pass)", () => {
	const base = { cwd: "/abs/pkg", version: "1.2.3", entry: { index: "./src/index.ts" }, tsconfigPath: "/tmp/t.json" };

	it("dts pass: bundled declarations only, no clean, same outDir", () => {
		const o = deriveDtsPassOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/dev/pkg");
		// bundled: rolldown preserveModules off
		expect(o.unbundle).toBe(false);
		// dts-only emission; generator pinned to "tsc" (rolldown-plugin-dts auto-detect flips to
		// its broken "tsgo" generator when a peer-resolved typescript >= 7 is installed).
		expect(o.dts).toEqual({ tsconfig: "/tmp/t.json", emitDtsOnly: true, generator: "tsc" });
		// must NOT wipe the JS pass output
		expect(o.clean).toBe(false);
		// dts maps off
		expect(o.sourcemap).toBe(false);
		expect(o.format).toEqual(["esm"]);
		expect(o.entry).toEqual({ index: "./src/index.ts" });
	});

	it("dts pass strips bin/ entries (bin executables have no declarations)", () => {
		// A bin entry produces an empty `export {};` .d.ts chunk that triggers a spurious
		// rolldown-plugin-dts:fake-js SOURCEMAP_BROKEN warning. The dts pass excludes them;
		// the JS pass (deriveTargetGroupOptions) still includes bin/cli for the executable.
		const withBin = {
			cwd: "/abs/pkg",
			version: "1.2.3",
			entry: { index: "./src/index.ts", "bin/cli": "./src/bin/cli.ts" },
			tsconfigPath: "/tmp/t.json",
		};
		const dts = deriveDtsPassOptions({ ...withBin, group: "dev", devManifest: "preserve" });
		expect(dts.entry).toEqual({ index: "./src/index.ts" });
		expect(dts.entry).not.toHaveProperty("bin/cli");
		// JS pass must still include bin/cli (it builds the executable).
		const js = deriveTargetGroupOptions({ ...withBin, group: "dev", devManifest: "preserve" });
		expect(js.entry).toEqual({ index: "./src/index.ts", "bin/cli": "./src/bin/cli.ts" });
	});

	it("dts pass uses the same outDir for a prod group", () => {
		const o = deriveDtsPassOptions({ ...base, group: "npm", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/prod/npm/pkg");
	});

	it("dts pass keeps esm+cjs format so both .d.ts and .d.cts emit", () => {
		const o = deriveDtsPassOptions({ ...base, group: "dev", devManifest: "preserve", format: ["esm", "cjs"] });
		expect(o.format).toEqual(["esm", "cjs"]);
	});

	it("threads bundledPackages into the dts pass when provided", () => {
		const o = deriveDtsPassOptions({
			...base,
			group: "dev",
			devManifest: "preserve",
			bundledPackages: ["@commitlint/types"],
		});
		expect(o.bundledPackages).toEqual(["@commitlint/types"]);
	});

	it("omits bundledPackages from the dts pass when not provided", () => {
		const o = deriveDtsPassOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.bundledPackages).toBeUndefined();
	});
});

describe("define merge (auto-version + user define)", () => {
	const base = { cwd: "/abs/pkg", version: "1.2.3", entry: { index: "./src/index.ts" }, tsconfigPath: "/tmp/t.json" };

	it("JS pass injects process.env.__PACKAGE_VERSION__ and not the bare identifier", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.define["process.env.__PACKAGE_VERSION__"]).toBe(JSON.stringify("1.2.3"));
		expect(o.define.__PACKAGE_VERSION__).toBeUndefined();
	});

	it("dts pass injects process.env.__PACKAGE_VERSION__ and not the bare identifier", () => {
		const o = deriveDtsPassOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.define["process.env.__PACKAGE_VERSION__"]).toBe(JSON.stringify("1.2.3"));
		expect(o.define.__PACKAGE_VERSION__).toBeUndefined();
	});

	it("merges a user define alongside the auto-version", () => {
		const o = deriveTargetGroupOptions({
			...base,
			group: "dev",
			devManifest: "preserve",
			define: { "process.env.FLAG": JSON.stringify("on") },
		});
		expect(o.define["process.env.FLAG"]).toBe(JSON.stringify("on"));
		expect(o.define["process.env.__PACKAGE_VERSION__"]).toBe(JSON.stringify("1.2.3"));
	});

	it("lets a user define override the auto-version on key collision", () => {
		const o = deriveTargetGroupOptions({
			...base,
			group: "dev",
			devManifest: "preserve",
			define: { "process.env.__PACKAGE_VERSION__": JSON.stringify("9.9.9") },
		});
		expect(o.define["process.env.__PACKAGE_VERSION__"]).toBe(JSON.stringify("9.9.9"));
	});
});

describe("deriveTargetGroupOptions platform override", () => {
	const base = { cwd: "/abs/pkg", version: "1.2.3", entry: { index: "./src/index.ts" }, tsconfigPath: "/tmp/t.json" };

	it("defaults platform to node", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.platform).toBe("node");
	});

	it("honors an explicit browser platform (JS pass only)", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve", platform: "browser" });
		expect(o.platform).toBe("browser");
	});
});

import { declarationsDirFor, deriveDeclarationsPassOptions } from "../../src/build/target-groups.js";

describe("deriveDeclarationsPassOptions", () => {
	const base = {
		group: "npm",
		cwd: "/repo/pkg",
		version: "1.2.3",
		entry: { index: "/repo/pkg/src/index.ts", "bin/cli": "/repo/pkg/src/bin.ts" },
		tsconfigPath: "/tmp/tsconfig.json",
		devManifest: "preserve" as const,
	};

	it("emits per-module (unbundle) declarations into the prod declarations dir, bin excluded", () => {
		const d = deriveDeclarationsPassOptions(base);
		expect(d.unbundle).toBe(true);
		expect(d.outDir).toBe("/repo/pkg/dist/prod/npm/declarations");
		expect(d.dts).toEqual({ tsconfig: "/tmp/tsconfig.json", emitDtsOnly: true, generator: "tsc" });
		expect(d.format).toEqual(["esm"]);
		expect(d.platform).toBe("node");
		expect(Object.keys(d.entry)).toEqual(["index"]);
		expect(d.define["process.env.__PACKAGE_VERSION__"]).toBe(JSON.stringify("1.2.3"));
	});

	it("forwards bundledPackages when present", () => {
		const d = deriveDeclarationsPassOptions({ ...base, bundledPackages: ["zod"] });
		expect(d.bundledPackages).toEqual(["zod"]);
	});

	it("declarationsDirFor points at the prod declarations sibling of pkg", () => {
		expect(declarationsDirFor("/repo/pkg", "github")).toBe("/repo/pkg/dist/prod/github/declarations");
	});
});
