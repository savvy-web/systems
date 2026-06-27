// packages/tsdown-plugins/__test__/build/ambient-dts-copy.test.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyAmbientDts } from "../../src/build/sync-public.js";

function fixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "ambient-"));
	mkdirSync(join(dir, "src/long/path"), { recursive: true });
	writeFileSync(
		join(dir, "src/long/path/input-file.d.ts"),
		`declare module "pkg/virtual/x" {\n  export const y: number;\n}\n`,
	);
	mkdirSync(join(dir, "out"), { recursive: true });
	return dir;
}

describe("copyAmbientDts", () => {
	it("copies the source verbatim to outDir/<outName>", () => {
		const dir = fixture();
		copyAmbientDts({
			ambient: [{ exportKey: "./virtual", source: "./src/long/path/input-file.d.ts", outName: "virtual.d.ts" }],
			srcCwd: dir,
			outDir: join(dir, "out"),
		});
		const dst = join(dir, "out/virtual.d.ts");
		expect(existsSync(dst)).toBe(true);
		expect(readFileSync(dst, "utf-8")).toContain(`declare module "pkg/virtual/x"`);
	});

	it("creates the subdir for an exportsAsIndexes outName", () => {
		const dir = fixture();
		copyAmbientDts({
			ambient: [{ exportKey: "./css", source: "./src/long/path/input-file.d.ts", outName: "css/index.d.ts" }],
			srcCwd: dir,
			outDir: join(dir, "out"),
		});
		expect(existsSync(join(dir, "out/css/index.d.ts"))).toBe(true);
	});

	it("is byte-stable: an unchanged file is not rewritten", () => {
		const dir = fixture();
		const opts = {
			ambient: [{ exportKey: "./virtual", source: "./src/long/path/input-file.d.ts", outName: "virtual.d.ts" }],
			srcCwd: dir,
			outDir: join(dir, "out"),
		};
		copyAmbientDts(opts);
		const dst = join(dir, "out/virtual.d.ts");
		const mtime1 = statSync(dst).mtimeMs;
		copyAmbientDts(opts);
		expect(statSync(dst).mtimeMs).toBe(mtime1);
	});

	it("throws ConfigValidationError when the source is missing", () => {
		const dir = fixture();
		expect(() =>
			copyAmbientDts({
				ambient: [{ exportKey: "./gone", source: "./src/missing.d.ts", outName: "gone.d.ts" }],
				srcCwd: dir,
				outDir: join(dir, "out"),
			}),
		).toThrow(/ambient .d.ts source not found/);
	});

	it("throws ConfigValidationError when the source has a relative import", () => {
		const dir = fixture();
		const rel = join(dir, "src/rel.d.ts");
		mkdirSync(dirname(rel), { recursive: true });
		writeFileSync(rel, `import type { A } from "./neighbor.js";\nexport type B = A;\n`);
		expect(() =>
			copyAmbientDts({
				ambient: [{ exportKey: "./rel", source: "./src/rel.d.ts", outName: "rel.d.ts" }],
				srcCwd: dir,
				outDir: join(dir, "out"),
			}),
		).toThrow(/relative import/);
	});
});
