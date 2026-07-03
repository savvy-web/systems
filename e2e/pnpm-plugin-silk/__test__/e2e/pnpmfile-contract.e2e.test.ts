import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { catalogs } from "@savvy-web/pnpm-plugin-silk";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const pkgRoot = dirname(require.resolve("@savvy-web/pnpm-plugin-silk/package.json"));

describe("e2e: built @savvy-web/pnpm-plugin-silk artifact", () => {
	it("main export exposes the silk and silkPeers catalogs", () => {
		expect(catalogs.get("silk")?.get("effect")).toMatch(/^[~^]?\d/);
		expect(catalogs.get("silkPeers")?.get("effect")).toMatch(/^[~^]?\d/);
	});

	it("built pnpmfile updateConfig injects catalogs, overrides, hoist pattern, and security defaults", async () => {
		const mod = await import(pathToFileURL(join(pkgRoot, "pnpmfile.mjs")).href);
		const result = mod.hooks.updateConfig({});
		expect(result.catalogs.silk.effect).toMatch(/^[~^]?\d/);
		expect(result.catalogs.silkPeers.effect).toMatch(/^[~^]?\d/);
		expect(result.publicHoistPattern).toContain("typescript");
		expect(result.strictDepBuilds).toBe(true);
	});
});
