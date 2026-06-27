// packages/tsdown-plugins/__test__/entry/ambient-dts.test.ts
import { describe, expect, it } from "vitest";
import {
	ambientOutName,
	assertNoEntryCollisions,
	classifyDtsExport,
	declarationExt,
	extractAmbientDts,
} from "../../src/entry/ambient-dts.js";

describe("classifyDtsExport", () => {
	it("classifies a bare .d.ts string as ambient", () => {
		expect(classifyDtsExport("./src/virtual.d.ts")).toEqual({ kind: "ambient", source: "./src/virtual.d.ts" });
	});
	it("classifies a { types: '*.d.ts' } object as ambient", () => {
		expect(classifyDtsExport({ types: "./src/a/b.d.cts" })).toEqual({ kind: "ambient", source: "./src/a/b.d.cts" });
	});
	it("classifies types-.d.ts + runtime .ts as mixed", () => {
		expect(classifyDtsExport({ types: "./src/x.d.ts", import: "./src/x.ts" })).toEqual({ kind: "mixed" });
	});
	it("classifies a normal runtime export as none", () => {
		expect(classifyDtsExport("./src/index.ts").kind).toBe("none");
		expect(classifyDtsExport({ types: "./src/index.ts", import: "./src/index.ts" }).kind).toBe("none");
	});
});

describe("ambientOutName / declarationExt", () => {
	it("derives the name from the export key and preserves the declaration extension", () => {
		expect(ambientOutName("./virtual", "./src/long/path/input-file.d.ts")).toBe("virtual.d.ts");
		expect(ambientOutName("./foo", "./src/foo.d.cts")).toBe("foo.d.cts");
		expect(ambientOutName("./css", "./src/css.d.ts", true)).toBe("css/index.d.ts");
	});
	it("declarationExt only matches declaration files", () => {
		expect(declarationExt("./a.d.ts")).toBe(".d.ts");
		expect(declarationExt("./a.ts")).toBeUndefined();
	});
});

describe("extractAmbientDts", () => {
	it("extracts string and { types } forms, ignoring runtime and json exports", () => {
		const r = extractAmbientDts({
			exports: {
				".": "./src/index.ts",
				"./virtual": { types: "./src/long/path/input-file.d.ts" },
				"./globals": "./src/globals.d.ts",
				"./package.json": "./package.json",
			},
		});
		expect(r).toEqual([
			{ exportKey: "./virtual", source: "./src/long/path/input-file.d.ts", outName: "virtual.d.ts" },
			{ exportKey: "./globals", source: "./src/globals.d.ts", outName: "globals.d.ts" },
		]);
	});
	it("throws ConfigValidationError on a mixed export", () => {
		expect(() => extractAmbientDts({ exports: { "./x": { types: "./src/x.d.ts", import: "./src/x.ts" } } })).toThrow(
			/cannot also hand-author its `types`/,
		);
	});
	it("throws when two ambient exports flatten to the same output name", () => {
		expect(() => extractAmbientDts({ exports: { "./a-b": "./src/a-b.d.ts", "./a/b": "./src/a/b.d.ts" } })).toThrow(
			/colliding with export key/,
		);
	});
	it("does not treat a .d.ts-keyed asset re-export as ambient", () => {
		const r = extractAmbientDts({
			exports: {
				".": "./src/index.ts",
				"./rspress-env.d.ts": "./public/rspress-env.d.ts",
				"./virtual": { types: "./src/virtual.d.ts" },
			},
		});
		expect(r).toEqual([{ exportKey: "./virtual", source: "./src/virtual.d.ts", outName: "virtual.d.ts" }]);
	});
});

describe("assertNoEntryCollisions", () => {
	it("throws when an ambient output collides with a JS entry name", () => {
		expect(() =>
			assertNoEntryCollisions(
				["index", "a-b"],
				[{ exportKey: "./a/b", source: "./src/a/b.d.ts", outName: "a-b.d.ts" }],
			),
		).toThrow(/collides with the JS build entry/);
	});
	it("is a no-op when there is no overlap", () => {
		expect(() =>
			assertNoEntryCollisions(["index"], [{ exportKey: "./virtual", source: "./src/v.d.ts", outName: "virtual.d.ts" }]),
		).not.toThrow();
	});
});
