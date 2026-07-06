import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures/bundle-node-modules");
const OUT = join(FIX, "dist/dev/pkg");

/** True only when the bare specifier survives as a real import/require (not a comment). */
function hasBareReference(js: string, specifier: string): boolean {
	const fromImport = new RegExp(`^\\s*import\\b[^\\n]*from\\s*["']${specifier}["']`);
	const sideEffect = new RegExp(`^\\s*import\\s*["']${specifier}["']`);
	const req = new RegExp(`require\\(\\s*["']${specifier}["']\\s*\\)`);
	return js.split("\n").some((l) => fromImport.test(l) || sideEffect.test(l) || req.test(l));
}

describe("bundleNodeModules: force-bundle node_modules JS deps (deps.skipNodeModulesBundle false)", () => {
	afterAll(() => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
	});

	it("inlines an unlisted node_modules value dep into a SINGLE self-contained entry file when bundleNodeModules is true", async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ devManifest: "preserve", bundleNodeModules: true }), {
			cwd: FIX,
			argv: ["--target", "dev"],
			writeOutput: () => {},
		});
		const js = readFileSync(join(OUT, "index.js"), "utf-8");
		// tinyrainbow is neither an external nor a bundledPackages target. Its runtime code is
		// bundled into the entry itself — there is NO surviving bare `import ... from
		// "tinyrainbow"` left for the consumer to resolve.
		expect(hasBareReference(js, "tinyrainbow")).toBe(false);
		// bundleNodeModules must produce a genuinely SELF-CONTAINED single file, not a
		// per-module chunk tree mirroring node_modules paths: `npm pack` unconditionally strips
		// any directory literally named `node_modules`, so a packed-and-installed consumer of a
		// preserveModules-chunked output throws `Cannot find module` at load time (the packed-
		// tarball defect this test guards against — see the tsdown-plugins `unbundle` TSDoc for
		// the full finding). No node_modules dir may exist in the built package at all.
		expect(existsSync(join(OUT, "node_modules"))).toBe(false);
		// tinyrainbow's recognizable source (a region header sourced from its node_modules path,
		// plus its ANSI color table) is inlined directly into the single entry file.
		expect(js).toMatch(/#region.*node_modules.*\/tinyrainbow\//);
		expect(js).toMatch(/bold:/);
		// Our own entry still exports its surface against the bundled implementation.
		expect(js).toMatch(/export\s*\{[^}]*\blabel\b/);
	}, 120_000);

	it("keeps a declared external as a surviving external import (the flag does not externalize externals)", async () => {
		// effect is an external value dep here. Even with bundleNodeModules on, an
		// external (deps.neverBundle) must stay a real external import, proving the
		// flag bundles only NON-externalized node_modules deps, not everything.
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ devManifest: "preserve", bundleNodeModules: true, externals: ["tinyrainbow"] }), {
			cwd: FIX,
			argv: ["--target", "dev"],
			writeOutput: () => {},
		});
		const js = readFileSync(join(OUT, "index.js"), "utf-8");
		// With tinyrainbow now externalized, the bare import survives and the dep is
		// NOT inlined into the entry — the externals list still wins.
		expect(hasBareReference(js, "tinyrainbow")).toBe(true);
		expect(js).not.toMatch(/#region.*node_modules.*\/tinyrainbow\//);
		expect(existsSync(join(OUT, "node_modules"))).toBe(false);
	}, 120_000);
});
