import { describe, expect, it } from "vitest";
import { resolveManifest } from "../../src/catalog/resolve-catalogs.js";

describe("resolveManifest (via workspaces-effect CatalogResolver)", () => {
	it("resolves catalog: specifiers to concrete ranges; nothing stays pinned to catalog:/workspace:", async () => {
		// Runs against the real systems workspace — CatalogResolver finds the root from process.cwd()
		// and assembles silk/silkPeers via the config-dependency hook-replay.
		const resolved = await resolveManifest({
			name: "@fixture/consumer",
			version: "1.0.0",
			dependencies: { effect: "catalog:silk" },
			peerDependencies: { effect: "catalog:silkPeers" },
		});
		expect(resolved.dependencies?.effect).toMatch(/^[~^]?\d/); // a concrete range, not "catalog:..."
		expect(resolved.peerDependencies?.effect).toBeTruthy();
		expect(JSON.stringify(resolved)).not.toContain("catalog:");
	});

	it("rejects (CatalogResolutionError) for an unknown catalog", async () => {
		await expect(
			resolveManifest({ name: "@x/p", version: "1.0.0", dependencies: { x: "catalog:does-not-exist" } }),
		).rejects.toThrow();
	});
});
