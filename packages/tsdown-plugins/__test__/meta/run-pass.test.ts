import { describe, expect, it } from "vitest";
import { applySubdirMetaEntries, deriveExportPaths } from "../../src/meta/run-pass.js";

describe("deriveExportPaths", () => {
	it("maps index to '.' and matches exports keys by source path", () => {
		const entries = { index: "./src/index.ts", sub: "./src/sub.ts" };
		const exportsMap = { ".": "./src/index.ts", "./sub": "./src/sub.ts" };
		expect(deriveExportPaths(entries, exportsMap)).toEqual({ index: ".", sub: "./sub" });
	});
	it("falls back to ./<name> when no exports map", () => {
		expect(deriveExportPaths({ index: "./src/index.ts", foo: "./src/foo.ts" }, undefined)).toEqual({
			index: ".",
			foo: "./foo",
		});
	});
});

describe("applySubdirMetaEntries", () => {
	it("remaps the flattened entry's dts basename to <subdir>/index and sets its export path", () => {
		const dtsBasenames = { "changesets-markdownlint": "changesets-markdownlint" };
		const exportPaths: Record<string, string> = {};
		applySubdirMetaEntries(
			[{ entries: ["./changesets/markdownlint"], outSubdir: "changesets/markdownlint" }],
			dtsBasenames,
			exportPaths,
		);
		expect(dtsBasenames["changesets-markdownlint"]).toBe("changesets/markdownlint/index");
		expect(exportPaths["changesets-markdownlint"]).toBe("./changesets/markdownlint");
	});
	it("is a no-op when overrides is undefined", () => {
		const dts = { index: "index" };
		applySubdirMetaEntries(undefined, dts, {});
		expect(dts).toEqual({ index: "index" });
	});
});
