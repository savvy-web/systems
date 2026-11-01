import { describe, expect, it } from "vitest";
import { extractSpecifiers, forbiddenSpecifiers, isForbiddenSpecifier, readsProcess } from "./utils/boundaries.js";

describe("extractSpecifiers", () => {
	it("finds every import/export/require form", () => {
		const src = [
			'import { a } from "one";',
			'import type { B } from "two";',
			'import "three";',
			'export { c } from "four";',
			'export * as ns from "five";',
			'export type { D } from "six";',
			'const seven = await import("seven");',
			'const eight = require("eight");',
			"import {\n\tmulti,\n} from 'nine';",
		].join("\n");
		expect([...extractSpecifiers(src)].sort()).toEqual([
			"eight",
			"five",
			"four",
			"nine",
			"one",
			"seven",
			"six",
			"three",
			"two",
		]);
	});
	it("ignores a specifier inside a comment, template or regex", () => {
		expect(extractSpecifiers('// import x from "node:fs"\n/* require("fs") */')).toEqual([]);
		expect(extractSpecifiers('const hint = `import x from "node:fs"`;')).toEqual([]);
		expect(extractSpecifiers('const r = /import x from "node:fs"/;')).toEqual([]);
	});
	it("reports a specifier named twice once", () => {
		expect(extractSpecifiers('import "a";\nimport "a";')).toEqual(["a"]);
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
