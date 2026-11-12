import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The BUILT artifact, by path. A bare `@savvy-web/pnpm-plugin-silk` import from inside the package
 * would self-reference the SOURCE manifest's exports (`./src/index.ts`), not what ships.
 */
const pkgRoot = resolve(import.meta.dirname, "..", "..", "dist", "prod", "npm", "pkg");
const { catalogs } = (await import(pathToFileURL(join(pkgRoot, "index.js")).href)) as {
	catalogs: Map<string, Map<string, string>>;
};

describe("e2e: built @savvy-web/pnpm-plugin-silk artifact", () => {
	/** Every camelCase peer catalog dropped in 0.27.0 — both surfaces must reject all of them. */
	const REMOVED_PEER_CATALOGS = ["buildPeers", "docsPeers", "lintPeers", "silkPeers", "testPeers"];

	/**
	 * Toolchain members the kit's `effected:build` catalog owns. Silk serves none of them: a copy
	 * here drifts from the kit on the first upgrade either side runs alone.
	 */
	const KIT_TOOLCHAIN = [
		"typescript",
		"tsx",
		"@types/node",
		"@types/react",
		"@types/react-dom",
		"react",
		"react-dom",
		"ink",
	];

	// Probes `@types/bun`, the member silk owns: the Effect closure and the build toolchain
	// (ink included) both come from `@effected/pnpm-plugin-effected`, so either would assert
	// absence, not shape.
	it("main export exposes the silk and silk:peers catalogs", () => {
		expect(catalogs.get("silk")?.get("@types/bun")).toMatch(/^[~^]?\d/);
		expect(catalogs.get("silk:peers")?.get("@types/bun")).toMatch(/^[~^]?\d/);
	});

	it("serves none of the kit's effected:build toolchain from any catalog", () => {
		for (const [name, entries] of catalogs) {
			for (const member of KIT_TOOLCHAIN) {
				expect(entries.has(member), `${name} carries ${member}`).toBe(false);
			}
		}
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
		expect(result.catalogs.silk["@types/bun"]).toMatch(/^[~^]?\d/);
		expect(result.catalogs["silk:peers"]["@types/bun"]).toMatch(/^[~^]?\d/);
		for (const name of REMOVED_PEER_CATALOGS) {
			expect(result.catalogs[name]).toBeUndefined();
		}
		expect(result.publicHoistPattern).toContain("turbo");
		for (const member of KIT_TOOLCHAIN) {
			expect(result.publicHoistPattern).not.toContain(member);
		}
		expect(result.strictDepBuilds).toBe(true);
	});
});
