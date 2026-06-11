import { describe, expect, it } from "vitest";
import { normalizeLooseFiles } from "../../src/build/loose-files.js";
import { ConfigValidationError } from "../../src/errors.js";

describe("normalizeLooseFiles", () => {
	it("infers esm + fixedExtension:true from a .mjs key (bare string value)", () => {
		const out = normalizeLooseFiles({ "pnpmfile.mjs": "./src/pnpmfile.ts" });
		expect(out).toEqual([
			{
				outFile: "pnpmfile.mjs",
				entryName: "pnpmfile",
				source: "./src/pnpmfile.ts",
				format: "esm",
				fixedExtension: true,
			},
		]);
	});

	it("infers cjs + fixedExtension:true from a .cjs key", () => {
		const out = normalizeLooseFiles({ "pnpmfile.cjs": "./src/pnpmfile.ts" });
		expect(out[0]).toMatchObject({ format: "cjs", fixedExtension: true, entryName: "pnpmfile" });
	});

	it("accepts the object form with an explicit format that agrees with the extension", () => {
		const out = normalizeLooseFiles({ "pnpmfile.mjs": { source: "./src/pnpmfile.ts", format: "esm" } });
		expect(out[0]).toMatchObject({ format: "esm", fixedExtension: true });
	});

	it("requires an explicit format for an ambiguous .js key", () => {
		expect(() => normalizeLooseFiles({ "thing.js": "./src/thing.ts" })).toThrow(ConfigValidationError);
	});

	it("uses fixedExtension:false for a .js + esm output", () => {
		const out = normalizeLooseFiles({ "thing.js": { source: "./src/thing.ts", format: "esm" } });
		expect(out[0]).toMatchObject({ outFile: "thing.js", entryName: "thing", format: "esm", fixedExtension: false });
	});

	it("rejects a format that contradicts the extension", () => {
		expect(() => normalizeLooseFiles({ "pnpmfile.mjs": { source: "./s.ts", format: "cjs" } })).toThrow(
			ConfigValidationError,
		);
	});

	it("rejects a .js + cjs combination (deferred — needs a rename)", () => {
		expect(() => normalizeLooseFiles({ "thing.js": { source: "./s.ts", format: "cjs" } })).toThrow(
			ConfigValidationError,
		);
	});

	it("rejects an unsupported extension", () => {
		expect(() => normalizeLooseFiles({ "thing.txt": "./s.ts" })).toThrow(ConfigValidationError);
	});

	it("rejects a key with a path separator (v1 emits root-level files only)", () => {
		expect(() => normalizeLooseFiles({ "nested/thing.mjs": "./s.ts" })).toThrow(ConfigValidationError);
	});
});
