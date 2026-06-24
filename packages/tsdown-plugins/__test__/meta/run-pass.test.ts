import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BuildCollector, runMetaPass } from "../../src/index.js";
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

describe("runMetaPass", () => {
	it("calls generateMeta once per group with derived exportPaths and bin/ excluded", async () => {
		const cwd = "/pkg";
		const calls: Array<{
			outMetaDir: string;
			entries: Record<string, string>;
			exportPaths: Record<string, string>;
			dtsDir: string;
			aeInputDir: string | undefined;
		}> = [];
		const collector = new BuildCollector();
		await runMetaPass({
			cwd,
			packageName: "@scope/pkg",
			tsconfigPath: "/pkg/tsconfig.json",
			groups: [{ id: "npm", name: "@scope/pkg" }],
			entries: { index: "./src/index.ts", "bin/cli": "./src/bin/cli.ts" },
			exportsMap: { ".": "./src/index.ts" },
			meta: {},
			collector,
			ci: false,
			generateMeta: async (opts) => {
				calls.push({
					outMetaDir: opts.outMetaDir,
					entries: opts.entries,
					exportPaths: opts.exportPaths,
					dtsDir: opts.dtsDir,
					aeInputDir: opts.aeInputDir,
				});
				return { apiJsonPath: "/x", apiJsonFilename: "pkg.api.json" };
			},
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]?.entries).toEqual({ index: "index" }); // bin/cli excluded
		expect(calls[0]?.exportPaths).toEqual({ index: "." });
		expect(calls[0]?.outMetaDir).toContain("/pkg/dist/prod/npm/meta");
		expect(calls[0]?.dtsDir).toBe(join(cwd, "dist", "prod", "npm", "pkg"));
		expect(calls[0]?.aeInputDir).toBe(join(cwd, "dist", "prod", "npm", "declarations"));
	});
});
