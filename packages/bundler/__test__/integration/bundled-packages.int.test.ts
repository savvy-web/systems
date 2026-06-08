import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures/bundled-packages");
const OUT = join(FIX, "dist/dev/pkg");

describe("bundledPackages: selective dts inlining (deps.dts.alwaysBundle)", () => {
	beforeAll(async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ devManifest: "preserve", externals: ["effect"], bundledPackages: ["rolldown"] }), {
			cwd: FIX,
			argv: ["--target", "dev"],
			writeOutput: () => {},
		});
	}, 120_000);

	afterAll(() => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
	});

	it("inlines the bundledPackages target (rolldown) into the entry dts", () => {
		expect(existsSync(join(OUT, "index.d.ts"))).toBe(true);
		const dts = readFileSync(join(OUT, "index.d.ts"), "utf-8");
		// Match only REAL line-start import statements, not the `import ... from 'rolldown'`
		// strings that appear inside rolldown's own JSDoc @example blocks.
		const importLines = dts.split("\n").filter((l) => /^\s*import\b/.test(l));
		// rolldown is the bundledPackages target (deps.dts onlyBundle): its Plugin type is
		// rolled into the entry .d.ts, so there is NO surviving `from "rolldown"` import.
		expect(importLines.some((l) => /from ["']rolldown["']/.test(l))).toBe(false);
		// Proof the type actually inlined: rolldown source regions appear in the rollup.
		expect(dts).toMatch(/^\/\/#region.*node_modules.*\/rolldown\//m);
	});

	it("keeps an unlisted external (effect) as an external import reference", () => {
		const dts = readFileSync(join(OUT, "index.d.ts"), "utf-8");
		// effect is in externals (deps.neverBundle): it stays a real external import
		// statement at the top of the file, NOT inlined as source regions.
		const importLines = dts.split("\n").filter((l) => /^\s*import\b/.test(l));
		expect(importLines.some((l) => /from ["']effect["']/.test(l))).toBe(true);
		// And effect's declarations are NOT rolled into the rollup (no region sourced
		// from the effect package's node_modules path).
		expect(dts).not.toMatch(/^\/\/#region.*node_modules.*\/effect\//m);
	});
});
