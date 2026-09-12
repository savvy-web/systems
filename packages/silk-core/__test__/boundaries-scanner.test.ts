import { describe, expect, it } from "vitest";
import {
	extractSpecifiers,
	forbiddenSpecifiers,
	isForbiddenSpecifier,
	readsProcess,
	stripComments,
	stripNonCode,
	tokenize,
} from "./utils/boundaries.js";

describe("tokenize", () => {
	it("separates comments, strings, templates and regexes from code", () => {
		const kinds = tokenize(`a // c\n/* b */ "s" 'q' \`t\` /r/g b`).map((t) => t.kind);
		expect(kinds).toEqual([
			"code",
			"comment",
			"code",
			"comment",
			"code",
			"string",
			"code",
			"string",
			"code",
			"template",
			"code",
			"regex",
			"code",
		]);
	});
	it("keeps template interpolations as code and their text as template", () => {
		const tokens = tokenize(["`a $", "{x + `$", "{y}`} b`"].join(""));
		expect(tokens.filter((t) => t.kind === "code").map((t) => t.text.trim())).toEqual(["x +", "y"]);
		expect(tokens.filter((t) => t.kind === "template").map((t) => t.text)).toEqual(["a ", "", "", " b"]);
	});
	it("treats a slash after a value as division, not a regex", () => {
		const tokens = tokenize("const half = total / 2; const r = /x/;");
		expect(tokens.filter((t) => t.kind === "regex").map((t) => t.text)).toEqual(["/x/"]);
	});
	it("does not treat an escaped quote as a string terminator", () => {
		expect(tokenize(`"a\\"b" c`).map((t) => t.kind)).toEqual(["string", "code"]);
	});
});

describe("stripComments / stripNonCode", () => {
	const src = [
		'// process.cwd()\nconst a = "process.env"; /* process */ const b = `x $',
		"{process.pid}`; const r = /process/;",
	].join("");
	it("stripComments keeps literals and drops comments", () => {
		const out = stripComments(src);
		expect(out).toContain('"process.env"');
		expect(out).not.toContain("cwd()");
		expect(out).not.toContain("/* process */");
	});
	it("stripNonCode drops comments and literal bodies but keeps interpolation code", () => {
		const out = stripNonCode(src);
		expect(out).not.toContain("process.env");
		expect(out).not.toContain("cwd()");
		expect(out).not.toContain("/process/");
		expect(out).toContain("process.pid");
	});
});

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
		"effect/unstable/process",
		"effect/unstable/process/Command",
	])("flags %s", (spec) => {
		expect(isForbiddenSpecifier(spec)).toBe(true);
	});
	it.each([
		"effect",
		"effect/unstable/cli",
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
		"const processor = 1;",
		"const preprocess = 2;",
	])("does not flag %j", (src) => {
		expect(readsProcess(src)).toBe(false);
	});
});
