import { describe, expect, it } from "vitest";
import { forbiddenSpecifiers, isForbiddenSpecifier, readsProcess } from "./utils/boundaries.js";

describe("forbiddenSpecifiers forms", () => {
	it("finds every import/export/require form", () => {
		const src = [
			'import { a } from "node:one";',
			'import type { B } from "node:two";',
			'import "node:three";',
			'export { c } from "node:four";',
			'export * as ns from "node:five";',
			'export type { D } from "node:six";',
			'const seven = await import("node:seven");',
			'const eight = require("node:eight");',
			"import {\n\tmulti,\n} from 'node:nine';",
		].join("\n");
		expect([...forbiddenSpecifiers(src)].sort()).toEqual([
			"node:eight",
			"node:five",
			"node:four",
			"node:nine",
			"node:one",
			"node:seven",
			"node:six",
			"node:three",
			"node:two",
		]);
	});
	it("ignores a specifier inside a comment, template or regex", () => {
		expect(forbiddenSpecifiers('// import x from "node:fs"\n/* require("fs") */')).toEqual([]);
		expect(forbiddenSpecifiers('const hint = `import x from "node:fs"`;')).toEqual([]);
		expect(forbiddenSpecifiers('const r = /import x from "node:fs"/;')).toEqual([]);
	});
	it("reports a specifier named twice at each occurrence", () => {
		expect(forbiddenSpecifiers('import "node:a";\nimport "node:a";')).toEqual(["node:a", "node:a"]);
	});
});

describe("isForbiddenSpecifier", () => {
	it.each([
		"node:fs",
		"node:path",
		"fs",
		"fs/promises",
		"path",
		"process",
		"@effect/platform",
		"@effect/platform-node",
		"effect/process",
		"effect/process/Command",
	])("flags %s", (spec) => {
		expect(isForbiddenSpecifier(spec)).toBe(true);
	});
	it.each([
		"effect",
		"effect/cli",
		"@effected/templates",
		"@effected/workspaces",
		"./region.js",
		"../utils/TrailingSlash.js",
		"processor",
		"fsx",
	])("allows %s", (spec) => {
		expect(isForbiddenSpecifier(spec)).toBe(false);
	});
	it("forbiddenSpecifiers reports only the offenders", () => {
		expect(forbiddenSpecifiers('import { Schema } from "effect";\nimport { readFileSync } from "node:fs";')).toEqual([
			"node:fs",
		]);
	});
});

describe("readsProcess", () => {
	it.each([
		"const x = process.env.X;",
		'const x = process["env"];',
		"const { env } = process;",
		"const p = process;",
		"fn(process);",
		["const s = `$", "{process.pid}`;"].join(""),
		"process\n\t.exit(1);",
		"const cwd = globalThis.process.cwd();",
		"const env = global.process.env;",
	])("flags %j", (src) => {
		expect(readsProcess(src)).toBe(true);
	});
	it.each([
		"// defaults to process.cwd()",
		"/* process.env */",
		'const s = "process.env.X";',
		"const s = `process.env.X`;",
		"const r = /process\\./;",
		"const x = foo.process;",
		"const x = myGlobal.process;",
		"const processor = 1;",
		"const preprocess = 2;",
	])("does not flag %j", (src) => {
		expect(readsProcess(src)).toBe(false);
	});
});
