// packages/tsdown-plugins/__test__/entry/extract.test.ts
import { describe, expect, it } from "vitest";
import { extractEntries } from "../../src/entry/extract.js";

describe("extractEntries", () => {
	it("string exports -> index", () => {
		expect(extractEntries({ exports: "./src/index.ts" })).toEqual({
			entries: { index: "./src/index.ts" },
			exportPaths: { index: "." },
		});
	});

	it("'.' subpath maps to index; nested subpath flattens / -> -", () => {
		const r = extractEntries({ exports: { ".": "./src/index.ts", "./foo/bar": "./src/foo/bar.ts" } });
		expect(r.entries).toEqual({ index: "./src/index.ts", "foo-bar": "./src/foo/bar.ts" });
		expect(r.exportPaths).toEqual({ index: ".", "foo-bar": "./foo/bar" });
	});

	it("resolves import || default || types in that order, ignoring require", () => {
		const r = extractEntries({
			exports: { ".": { types: "./src/index.ts", require: "./src/index.cts", import: "./src/index.ts" } },
		});
		expect(r.entries).toEqual({ index: "./src/index.ts" });
	});

	it("falls back to default then types when import is absent", () => {
		expect(extractEntries({ exports: { ".": { default: "./src/d.ts" } } }).entries).toEqual({ index: "./src/d.ts" });
		expect(extractEntries({ exports: { ".": { types: "./src/t.ts" } } }).entries).toEqual({ index: "./src/t.ts" });
	});

	it("remaps /dist/*.js back to /src/*.ts", () => {
		expect(extractEntries({ exports: { ".": "./dist/index.js" } }).entries).toEqual({ index: "./src/index.ts" });
	});

	it("skips ./package.json and any *.json export and non-TS entries", () => {
		const r = extractEntries({
			exports: { ".": "./src/index.ts", "./package.json": "./package.json", "./data": "./src/data.json" },
		});
		expect(r.entries).toEqual({ index: "./src/index.ts" });
	});

	it("does not treat a .d.ts asset export as a buildable entry", () => {
		const r = extractEntries({
			exports: { ".": "./src/index.ts", "./rspress-env.d.ts": "./public/rspress-env.d.ts" },
		});
		expect(r.entries).toEqual({ index: "./src/index.ts" });
		expect(r.exportPaths).toEqual({ index: "." });
	});

	it("exportsAsIndexes nests under <name>/index instead of flattening", () => {
		const r = extractEntries({ exports: { "./foo/bar": "./src/foo/bar.ts" } }, { exportsAsIndexes: true });
		expect(r.entries).toEqual({ "foo/bar/index": "./src/foo/bar.ts" });
	});

	it("throws when two distinct export keys flatten to the same entry name", () => {
		expect(() => extractEntries({ exports: { "./a-b/c": "./src/a-b/c.ts", "./a/b-c": "./src/a/b-c.ts" } })).toThrow(
			/collides/,
		);
	});

	it("does not throw for distinct export keys that flatten to distinct names", () => {
		const r = extractEntries({ exports: { "./a/b": "./src/a/b.ts", "./a/c": "./src/a/c.ts" } });
		expect(r.entries).toEqual({ "a-b": "./src/a/b.ts", "a-c": "./src/a/c.ts" });
	});

	it("string bin -> bin/cli", () => {
		expect(extractEntries({ bin: "./src/bin/cli.ts" }).entries).toEqual({ "bin/cli": "./src/bin/cli.ts" });
	});

	it("object bin -> bin/<command>, remapping dist->src", () => {
		const r = extractEntries({ bin: { savvy: "./dist/bin/cli.js", other: "./src/bin/other.ts" } });
		expect(r.entries).toEqual({ "bin/savvy": "./src/bin/cli.ts", "bin/other": "./src/bin/other.ts" });
	});

	it("merges exports + bin entries", () => {
		const r = extractEntries({ exports: { ".": "./src/index.ts" }, bin: { savvy: "./src/bin/cli.ts" } });
		expect(r.entries).toEqual({ index: "./src/index.ts", "bin/savvy": "./src/bin/cli.ts" });
	});
});
