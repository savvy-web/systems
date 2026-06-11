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

	it("threads jsx through to DerivedTsdownOptions when provided", () => {
		const o = deriveTargetGroupOptions({
			...base,
			group: "dev",
			devManifest: "preserve",
			jsx: { runtime: "automatic", importSource: "react" },
		});
		expect(o.jsx).toEqual({ runtime: "automatic", importSource: "react" });
	});

	it("omits jsx from DerivedTsdownOptions when not provided", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.jsx).toBeUndefined();
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
});

describe("deriveDtsPassOptions (dts pass)", () => {
	const base = { cwd: "/abs/pkg", version: "1.2.3", entry: { index: "./src/index.ts" }, tsconfigPath: "/tmp/t.json" };

	it("dts pass: bundled declarations only, no clean, same outDir", () => {
		const o = deriveDtsPassOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/dev/pkg");
		// bundled: rolldown preserveModules off
		expect(o.unbundle).toBe(false);
		// dts-only emission
		expect(o.dts).toEqual({ tsconfig: "/tmp/t.json", emitDtsOnly: true });
		// must NOT wipe the JS pass output
		expect(o.clean).toBe(false);
		// dts maps off
		expect(o.sourcemap).toBe(false);
		expect(o.format).toEqual(["esm"]);
		expect(o.entry).toEqual({ index: "./src/index.ts" });
	});

	it("dts pass uses the same outDir for a prod group", () => {
		const o = deriveDtsPassOptions({ ...base, group: "npm", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/prod/npm/pkg");
	});

	it("dts pass keeps esm+cjs format so both .d.ts and .d.cts emit", () => {
		const o = deriveDtsPassOptions({ ...base, group: "dev", devManifest: "preserve", format: ["esm", "cjs"] });
		expect(o.format).toEqual(["esm", "cjs"]);
	});

	it("dts pass threads jsx into rolldown inputOptions when provided", () => {
		const o = deriveDtsPassOptions({
			...base,
			group: "dev",
			devManifest: "preserve",
			jsx: { runtime: "automatic", importSource: "react" },
		});
		expect(o.jsx).toEqual({ runtime: "automatic", importSource: "react" });
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
