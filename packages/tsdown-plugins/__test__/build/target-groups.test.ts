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
});
