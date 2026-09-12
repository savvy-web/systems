import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(import.meta.dirname, "..", "src");

/**
 * The scanner is silk-core's (`packages/silk-core/__test__/utils/boundaries.ts`),
 * imported rather than copied so the two gates cannot drift. It is loaded by a
 * computed path because a static specifier outside this package trips tsc's
 * `rootDir` check (TS6059) under the shared base config; the manual signature
 * below is the one line that must follow the scanner if it changes.
 */
const SCANNER_PATH = join(import.meta.dirname, "..", "..", "silk-core", "__test__", "utils", "boundaries.ts");
const { readsProcess } = (await import(pathToFileURL(SCANNER_PATH).href)) as {
	readonly readsProcess: (source: string) => boolean;
};

/**
 * Host adapters: entry points invoked by foreign host processes (lint-staged,
 * markdownlint-cli2, commitlint) that supply no context of their own, so they
 * must read `process` themselves. Skipped BY DIRECTORY NAME at the src root
 * only; there is no per-file allowlist. See CLAUDE.md.
 */
const HOST_ADAPTER_DIRS: ReadonlyArray<string> = ["lint", "commitlint"];

const walkShared = (dir: string): ReadonlyArray<string> =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (dir === SRC_ROOT && entry.isDirectory() && HOST_ADAPTER_DIRS.includes(entry.name)) return [];
		const full = join(dir, entry.name);
		if (entry.isDirectory()) return walkShared(full);
		return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
	});

const sources = (): ReadonlyArray<{ readonly path: string; readonly text: string }> =>
	walkShared(SRC_ROOT).map((f) => ({ path: relative(SRC_ROOT, f), text: readFileSync(f, "utf8") }));

describe("@savvy-web/silk-effects engine boundary", () => {
	it("control: shared src/ was found and is not empty", () => {
		// An empty walk would green the gate below vacuously.
		expect(sources().length).toBeGreaterThan(10);
	});

	it("control: the host-adapter carve-out is exactly lint/ and commitlint/, and both exist", () => {
		const topLevel = readdirSync(SRC_ROOT, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name);
		for (const dir of HOST_ADAPTER_DIRS) expect(topLevel).toContain(dir);
		expect(sources().some((s) => s.path.startsWith("lint/") || s.path.startsWith("commitlint/"))).toBe(false);
	});

	it("no shared-program file under src/ reads `process` — there is no file allowlist", () => {
		const offenders = sources()
			.filter((s) => readsProcess(s.text))
			.map((s) => s.path);
		expect(offenders).toEqual([]);
	});

	describe("the gate can fail (positive controls)", () => {
		it.each([
			"const x = process.env.X;",
			'const x = process["env"];',
			"const { env } = process;",
			"const cwd = globalThis.process.cwd();",
			["const s = `$", "{process.cwd()}`;"].join(""),
		])("catches a process read: %j", (src) => {
			expect(readsProcess(src)).toBe(true);
		});
	});

	describe("the gate does not fire on mentions that are not code (negative controls)", () => {
		it.each([
			"// defaults to process.cwd()",
			"/** Reads `process.env.CI` upstream. */",
			'const hint = "set process.env.X first";',
		])("ignores %j", (src) => {
			expect(readsProcess(src)).toBe(false);
		});
	});
});
