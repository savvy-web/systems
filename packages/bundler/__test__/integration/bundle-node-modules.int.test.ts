import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures/bundle-node-modules");
const OUT = join(FIX, "dist/dev/pkg");
// Derive tinyrainbow's pnpm virtual-store dirname from the installed version so a
// devDep version bump does not break the path assertions below. The bundler copies
// the dep under OUT using this same `name@version` dirname, so reading it from the
// root store (always present, unlike OUT which only exists after a build) keeps the
// bundled-path assertion in sync with whatever version is installed.
const PNPM_STORE = join(import.meta.dirname, "../../../../node_modules/.pnpm");
const TINYRAINBOW_DIR = readdirSync(PNPM_STORE).find((d) => d.startsWith("tinyrainbow@"));
if (!TINYRAINBOW_DIR) throw new Error("tinyrainbow not found in the pnpm store");
const BUNDLED_DEP = join(OUT, "node_modules/.pnpm", TINYRAINBOW_DIR, "node_modules/tinyrainbow/dist/index.js");

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

	it("bundles an unlisted node_modules value dep into the output when bundleNodeModules is true", async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ devManifest: "preserve", bundleNodeModules: true }), {
			cwd: FIX,
			argv: ["--target", "dev"],
			writeOutput: () => {},
		});
		const js = readFileSync(join(OUT, "index.js"), "utf-8");
		// tinyrainbow is neither an external nor a bundledPackages target. Its
		// runtime code is bundled into the output tree (per-module chunk), and the
		// entry references it by a relative path — there is NO surviving bare
		// `import ... from "tinyrainbow"` left for the consumer to resolve.
		expect(hasBareReference(js, "tinyrainbow")).toBe(false);
		// The dependency's source is physically emitted into dist, so the package
		// is self-contained (rslib bundle-everything-except-externals parity).
		expect(existsSync(BUNDLED_DEP)).toBe(true);
		const dep = readFileSync(BUNDLED_DEP, "utf-8");
		// The bundled chunk carries tinyrainbow's recognizable source: a region
		// header sourced from its node_modules path plus its ANSI color table.
		expect(dep).toMatch(/#region.*node_modules.*\/tinyrainbow\//);
		expect(dep).toMatch(/bold:/);
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
		// NOT copied into the output tree — the externals list still wins.
		expect(hasBareReference(js, "tinyrainbow")).toBe(true);
		expect(existsSync(BUNDLED_DEP)).toBe(false);
	}, 120_000);
});
