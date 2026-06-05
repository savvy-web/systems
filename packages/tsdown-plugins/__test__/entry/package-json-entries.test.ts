// packages/tsdown-plugins/__test__/entry/package-json-entries.test.ts
import { describe, expect, it } from "vitest";
import { packageJsonEntries } from "../../src/entry/package-json-entries.js";

describe("packageJsonEntries", () => {
	it("returns a tsdown entry record from an in-memory package.json", () => {
		const entry = packageJsonEntries({
			pkg: { exports: { ".": "./src/index.ts" }, bin: { savvy: "./src/bin/cli.ts" } },
		});
		expect(entry).toEqual({ index: "./src/index.ts", "bin/savvy": "./src/bin/cli.ts" });
	});

	it("honors exportsAsIndexes", () => {
		const entry = packageJsonEntries({
			pkg: { exports: { "./a/b": "./src/a/b.ts" } },
			exportsAsIndexes: true,
		});
		expect(entry).toEqual({ "a/b/index": "./src/a/b.ts" });
	});
});
