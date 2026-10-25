import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The BUILT artifact, by path. A bare `@savvy-web/pnpm-plugin-silk` import from inside the package
 * would self-reference the SOURCE manifest's exports (`./src/index.ts`), not what ships.
 */
const pkgRoot = resolve(import.meta.dirname, "..", "..", "dist", "dev", "pkg");
const { catalogs } = (await import(pathToFileURL(join(pkgRoot, "index.js")).href)) as {
	catalogs: Map<string, Map<string, string>>;
};

describe("e2e: built @savvy-web/pnpm-plugin-silk artifact", () => {
	/** Every camelCase peer catalog dropped in 0.27.0 — both surfaces must reject all of them. */
	const REMOVED_PEER_CATALOGS = ["buildPeers", "docsPeers", "lintPeers", "silkPeers", "testPeers"];

	// Probes `typescript` rather than `effect`: the silk catalogs no longer carry
	// the Effect closure (that lives in the `effect` catalogs supplied by
	// `@effected/pnpm-plugin-effect`), so `effect` would assert absence, not shape.
	it("main export exposes the silk and silk:peers catalogs", () => {
		expect(catalogs.get("silk")?.get("typescript")).toMatch(/^[~^]?\d/);
		expect(catalogs.get("silk:peers")?.get("typescript")).toMatch(/^[~^]?\d/);
	});

	// The removed `silkPeers` spelling must stay gone, not merely be unreferenced:
	// both names resolved during the transition, so an assertion on the new one
	// alone would still pass if the old catalog were reintroduced.
	it("no longer exposes the removed camelCase peer catalogs", () => {
		for (const name of REMOVED_PEER_CATALOGS) {
			expect(catalogs.get(name)).toBeUndefined();
		}
	});

	it("built pnpmfile updateConfig injects catalogs, overrides, hoist pattern, and security defaults", async () => {
		const mod = await import(pathToFileURL(join(pkgRoot, "pnpmfile.mjs")).href);
		const result = mod.hooks.updateConfig({});
		expect(result.catalogs.silk.typescript).toMatch(/^[~^]?\d/);
		expect(result.catalogs["silk:peers"].typescript).toMatch(/^[~^]?\d/);
		for (const name of REMOVED_PEER_CATALOGS) {
			expect(result.catalogs[name]).toBeUndefined();
		}
		expect(result.publicHoistPattern).toContain("typescript");
		expect(result.strictDepBuilds).toBe(true);
	});
});
