import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { forbiddenSpecifiers, isForbiddenSpecifier, readsProcess } from "./utils/boundaries.js";

const SRC_ROOT = join(import.meta.dirname, "..", "src");

const walk = (dir: string): ReadonlyArray<string> =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) return walk(full);
		return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
	});

const sources = (): ReadonlyArray<{ readonly path: string; readonly text: string }> =>
	walk(SRC_ROOT).map((f) => ({ path: relative(SRC_ROOT, f), text: readFileSync(f, "utf8") }));

describe("@savvy-web/silk-core boundaries", () => {
	it("control: src/ was found and is not empty", () => {
		// An empty walk would green both gates below vacuously.
		expect(sources().length).toBeGreaterThan(10);
	});

	it("no file under src/ reads `process` — there is no allowlist here", () => {
		const offenders = sources()
			.filter((s) => readsProcess(s.text))
			.map((s) => s.path);
		expect(offenders).toEqual([]);
	});

	it("no file under src/ names a platform module in any import/export/require form — there is no allowlist here", () => {
		const offenders = sources().flatMap((s) => forbiddenSpecifiers(s.text).map((spec) => `${s.path} -> ${spec}`));
		expect(offenders).toEqual([]);
	});

	describe("the gate can fail (positive controls)", () => {
		it.each([
			"const x = process.env.X;",
			'const x = process["env"];',
			"const { env } = process;",
			["const s = `$", "{process.cwd()}`;"].join(""),
		])("catches a process read: %j", (src) => {
			expect(readsProcess(src)).toBe(true);
		});

		it.each([
			'import { readFileSync } from "node:fs";',
			'import type { FileSystem } from "@effect/platform";',
			'import { ChildProcess } from "effect/unstable/process";',
			'import "node:process";',
			'import * as fs from "fs";',
			'import { readFile } from "fs/promises";',
			'import process from "process";',
			'export { join } from "node:path";',
			'export * as os from "node:os";',
			'const fs = await import("node:fs");',
			'const path = require("path");',
		])("catches a platform specifier: %j", (src) => {
			expect(forbiddenSpecifiers(src).length).toBeGreaterThan(0);
		});

		it("names the specifier it caught", () => {
			expect(forbiddenSpecifiers('import { Schema } from "effect";\nimport { join } from "node:path";')).toEqual([
				"node:path",
			]);
			expect(isForbiddenSpecifier("effect")).toBe(false);
		});
	});

	describe("the gate does not fire on mentions that are not code (negative controls)", () => {
		it.each([
			"// defaults to process.cwd()",
			"/** Reads `process.env.CI` upstream. */",
			'const hint = "set process.env.X first";',
			'const hint = `import { x } from "node:fs"`;',
			'/* import { readFileSync } from "node:fs"; */',
		])("ignores %j", (src) => {
			expect(readsProcess(src)).toBe(false);
			expect(forbiddenSpecifiers(src)).toEqual([]);
		});
	});
});
