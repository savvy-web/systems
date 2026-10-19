import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeApiExtractorTsconfig } from "../../src/meta/api-extractor.js";

const cleanup: string[] = [];
afterEach(() => {
	for (const p of cleanup.splice(0)) rmSync(p, { recursive: true, force: true });
});

function scaffold(baseJson: string): { dir: string; base: string; entry: string } {
	const dir = mkdtempSync(join(tmpdir(), "ae-paths-"));
	cleanup.push(dir);
	const base = join(dir, "tsconfig.json");
	writeFileSync(base, baseJson);
	return { dir, base, entry: join(dir, "index.d.ts") };
}

function read(path: string): { compilerOptions?: { paths?: Record<string, string[]> } } {
	cleanup.push(path);
	return JSON.parse(readFileSync(path, "utf-8")) as { compilerOptions?: { paths?: Record<string, string[]> } };
}

describe("writeApiExtractorTsconfig — self-reference paths (#771)", () => {
	it("emits compilerOptions.paths for the provided specifiers", () => {
		const { dir, base, entry } = scaffold(JSON.stringify({ compilerOptions: { skipLibCheck: true } }));
		const out = writeApiExtractorTsconfig({
			cwd: dir,
			tsconfigPath: base,
			entryDtsPath: entry,
			paths: { "@scope/pkg": ["/decl/index.d.ts"], "@scope/pkg/sub": ["/decl/sub.d.ts"] },
		});
		expect(read(out).compilerOptions?.paths).toEqual({
			"@scope/pkg": ["/decl/index.d.ts"],
			"@scope/pkg/sub": ["/decl/sub.d.ts"],
		});
	});

	it("merges the base tsconfig's own paths, with the provided paths winning", () => {
		const { dir, base, entry } = scaffold(
			JSON.stringify({ compilerOptions: { paths: { "~/*": ["./src/*"], "@scope/pkg": ["./src/index.ts"] } } }),
		);
		const out = writeApiExtractorTsconfig({
			cwd: dir,
			tsconfigPath: base,
			entryDtsPath: entry,
			paths: { "@scope/pkg": ["/decl/index.d.ts"] },
		});
		expect(read(out).compilerOptions?.paths).toEqual({
			"~/*": ["./src/*"],
			"@scope/pkg": ["/decl/index.d.ts"],
		});
	});

	it("tolerates an unparseable base file when merging", () => {
		const { dir, base, entry } = scaffold("{ not json");
		const out = writeApiExtractorTsconfig({
			cwd: dir,
			tsconfigPath: base,
			entryDtsPath: entry,
			paths: { "@scope/pkg": ["/decl/index.d.ts"] },
		});
		expect(read(out).compilerOptions?.paths).toEqual({ "@scope/pkg": ["/decl/index.d.ts"] });
	});

	it("emits no compilerOptions key when paths are omitted or empty", () => {
		const { dir, base, entry } = scaffold(JSON.stringify({ compilerOptions: { paths: { "~/*": ["./src/*"] } } }));
		const omitted = writeApiExtractorTsconfig({ cwd: dir, tsconfigPath: base, entryDtsPath: entry });
		const emptied = writeApiExtractorTsconfig({ cwd: dir, tsconfigPath: base, entryDtsPath: entry, paths: {} });
		expect(read(omitted)).not.toHaveProperty("compilerOptions");
		expect(read(emptied)).not.toHaveProperty("compilerOptions");
	});

	it("derives a different file when the paths differ", () => {
		const { dir, base, entry } = scaffold("{}");
		const a = writeApiExtractorTsconfig({ cwd: dir, tsconfigPath: base, entryDtsPath: entry, paths: { a: ["/a"] } });
		const b = writeApiExtractorTsconfig({ cwd: dir, tsconfigPath: base, entryDtsPath: entry, paths: { b: ["/b"] } });
		cleanup.push(a, b);
		expect(a).not.toBe(b);
	});
});
