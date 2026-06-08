import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncPublicDir } from "../../src/build/sync-public.js";

let root: string;
let src: string;
let dst: string;

function write(base: string, rel: string, content: string): void {
	const abs = join(base, rel);
	mkdirSync(dirname(abs), { recursive: true });
	writeFileSync(abs, content, "utf-8");
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "sync-public-"));
	src = join(root, "public");
	dst = join(root, "out", "public");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("syncPublicDir", () => {
	it("no-ops when the source does not exist", () => {
		expect(() => syncPublicDir(src, dst)).not.toThrow();
		expect(existsSync(dst)).toBe(false);
	});

	it("copies the source wholesale when the target does not exist", () => {
		write(src, "biome/silk.jsonc", "{}");
		write(src, "content/a.md", "alpha");
		syncPublicDir(src, dst);
		expect(readFileSync(join(dst, "biome/silk.jsonc"), "utf-8")).toBe("{}");
		expect(readFileSync(join(dst, "content/a.md"), "utf-8")).toBe("alpha");
	});

	it("does NOT throw when the target already exists (the EEXIST case)", () => {
		write(src, "a.md", "alpha");
		write(dst, "a.md", "alpha");
		expect(() => syncPublicDir(src, dst)).not.toThrow();
	});

	it("copies new files and updates byte-changed files into an existing target", () => {
		write(src, "keep.md", "same");
		write(src, "changed.md", "v2");
		write(src, "added.md", "new");
		write(dst, "keep.md", "same");
		write(dst, "changed.md", "v1");
		syncPublicDir(src, dst);
		expect(readFileSync(join(dst, "changed.md"), "utf-8")).toBe("v2");
		expect(readFileSync(join(dst, "added.md"), "utf-8")).toBe("new");
	});

	it("leaves unchanged files untouched (no rewrite — preserves mtime)", () => {
		write(src, "keep.md", "same");
		write(dst, "keep.md", "same");
		const past = new Date("2020-01-01T00:00:00Z");
		utimesSync(join(dst, "keep.md"), past, past);
		const before = statSync(join(dst, "keep.md")).mtimeMs;
		syncPublicDir(src, dst);
		expect(statSync(join(dst, "keep.md")).mtimeMs).toBe(before);
		expect(readFileSync(join(dst, "keep.md"), "utf-8")).toBe("same");
	});

	it("deletes target files that no longer exist in the source", () => {
		write(src, "live.md", "live");
		write(dst, "live.md", "live");
		write(dst, "stale.md", "stale");
		write(dst, "old/deep.md", "old");
		syncPublicDir(src, dst);
		expect(existsSync(join(dst, "live.md"))).toBe(true);
		expect(existsSync(join(dst, "stale.md"))).toBe(false);
		expect(existsSync(join(dst, "old/deep.md"))).toBe(false);
	});

	it("prunes directories left empty after deleting stale files", () => {
		write(src, "live.md", "live");
		write(dst, "live.md", "live");
		write(dst, "gone/only.md", "x");
		syncPublicDir(src, dst);
		expect(existsSync(join(dst, "gone"))).toBe(false);
	});
});
