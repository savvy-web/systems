import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const REPO = join(import.meta.dirname, "..", "..", "..", "..");
const CLI = join(REPO, "packages/cli");

describe("SP1 exit gate: @savvy-web/cli parity", () => {
	it("builds cli (bin + catalog:silk) producing a resolvable prod manifest", async () => {
		rmSync(join(CLI, "dist/prod"), { recursive: true, force: true });
		await runBuild(
			defineBuild({
				formats: ["esm"],
				externals: ["effect", "@effect/cli", "@effect/platform", "@effect/platform-node"],
				meta: false,
			}),
			{ cwd: CLI, argv: ["--target", "prod"] },
		);
		const pkgDir = join(CLI, "dist/prod/npm/pkg");
		// bin compiled and shebang-preserved
		expect(existsSync(join(pkgDir, "bin/savvy.js"))).toBe(true);
		expect(readFileSync(join(pkgDir, "bin/savvy.js"), "utf-8").startsWith("#!")).toBe(true);
		const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));
		// bin path has no leading ./
		expect(manifest.bin.savvy).toBe("bin/savvy.js");
		// types + exports resolve to built files
		expect(manifest.exports["."]).toEqual({ types: "./index.d.ts", import: "./index.js" });
		expect(existsSync(join(pkgDir, "index.d.ts"))).toBe(true);
		// catalog:silk resolved (no catalog: specifiers survive)
		expect(JSON.stringify(manifest)).not.toContain("catalog:");
		expect(manifest.dependencies.effect).toMatch(/^\^?\d/);
		// workspace:* (silk-effects) resolved to a concrete spec
		expect(manifest.dependencies["@savvy-web/silk-effects"]).not.toContain("workspace:");
	});
});
