// packages/tsdown-plugins/__test__/build/target-groups.test.ts
import { describe, expect, it } from "vitest";
import { deriveTargetGroupOptions } from "../../src/build/target-groups.js";

describe("deriveTargetGroupOptions", () => {
	const base = { cwd: "/abs/pkg", version: "1.2.3", entry: { index: "./src/index.ts" }, tsconfigPath: "/tmp/t.json" };

	it("dev group -> dist/dev/pkg, sourcemaps on, minify off, not prod", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "dev", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/dev/pkg");
		expect(o.sourcemap).toBe(true);
		expect(o.minify).toBe(false);
		expect(o.format).toEqual(["esm"]);
		expect(o.unbundle).toBe(true);
		expect(o.platform).toBe("node");
		expect(o.define.__PACKAGE_VERSION__).toBe(JSON.stringify("1.2.3"));
	});

	it("npm group -> dist/prod/npm/pkg, sourcemaps off, minify on", () => {
		const o = deriveTargetGroupOptions({ ...base, group: "npm", devManifest: "preserve" });
		expect(o.outDir).toBe("/abs/pkg/dist/prod/npm/pkg");
		expect(o.sourcemap).toBe(false);
		expect(o.minify).toBe(true);
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
});
