import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures", "dual-format");
const OUT = join(FIX, "dist/dev/pkg");

describe("dual-format build (esm + cjs)", () => {
	it("emits esm + cjs outputs and dual export conditions; the cjs output is require-able", async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ format: ["esm", "cjs"] }), {
			cwd: FIX,
			argv: ["--target", "dev"],
			writeOutput: () => {},
		});

		// 1. Both format outputs exist.
		expect(existsSync(join(OUT, "index.js"))).toBe(true);
		expect(existsSync(join(OUT, "index.cjs"))).toBe(true);

		// 2. The emitted package.json carries both conditions.
		const pkg = JSON.parse(readFileSync(join(OUT, "package.json"), "utf-8")) as {
			exports: { ".": { import: string; require: string; types: string } };
		};
		expect(pkg.exports["."].import).toMatch(/index\.js$/);
		expect(pkg.exports["."].require).toMatch(/index\.cjs$/);

		// 3. The cjs output is actually require-able and exposes the named export.
		const require = createRequire(import.meta.url);
		const mod = require(join(OUT, "index.cjs")) as { hello: () => string };
		expect(mod.hello()).toBe("hi");
	}, 60_000);
});
