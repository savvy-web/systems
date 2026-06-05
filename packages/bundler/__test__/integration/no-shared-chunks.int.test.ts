import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const MULTI = join(import.meta.dirname, "fixtures/multi");

describe("no shared runtime chunk (unbundle)", () => {
	it("multi-entry build mirrors source files; both entries import successfully", async () => {
		rmSync(join(MULTI, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ formats: ["esm"] }), { cwd: MULTI, argv: ["--target", "npm"] });
		const files = readdirSync(join(MULTI, "dist/prod/npm/pkg"));
		// unbundle => index.js, other.js, shared.js — no synthesized chunk-*.js shared-runtime file
		expect(files).toContain("index.js");
		expect(files).toContain("other.js");
		expect(files.some((f) => /^chunk-/.test(f))).toBe(false);
		// both entries are valid ESM that load without a __webpack_require__-style collision
		const idx = await import(join(MULTI, "dist/prod/npm/pkg/index.js"));
		const oth = await import(join(MULTI, "dist/prod/npm/pkg/other.js"));
		expect(idx.a()).toBe(2);
		expect(oth.b()).toBe(4);
	});
});
