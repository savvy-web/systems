import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIXTURE = join(import.meta.dirname, "fixtures/meta-prod");

describe("meta build (real API Extractor, prod-sourced, optimistic rewrite)", () => {
	beforeAll(() => {
		rmSync(join(FIXTURE, "dist"), { recursive: true, force: true });
		rmSync(join(FIXTURE, "models"), { recursive: true, force: true });
	});

	it("--target prod writes a resolved, optimistic meta package.json into localPaths and emits the api model", async () => {
		// Inject a fixed resolveNextVersions seam so the optimistic rewrite is deterministic.
		// The real CatalogResolver (rooted at the systems workspace) resolves workspace:*
		// for @savvy-web/tsdown-plugins to its current concrete version; the rewrite then
		// bumps both the fixture package itself and that sibling dep to 2.0.0.
		await runBuild(
			defineBuild({
				meta: {
					localPaths: ["models"],
					optimistic: true,
				},
			}),
			{
				cwd: FIXTURE,
				argv: ["--target", "prod"],
				writeOutput: () => {},
				resolveNextVersions: async () => ({
					root: FIXTURE,
					versions: new Map([
						["@fixture/meta-prod", "2.0.0"],
						["@savvy-web/tsdown-plugins", "2.0.0"],
					]),
				}),
			},
		);

		// The localPaths copy must exist.
		const modelsDir = join(FIXTURE, "models");
		expect(existsSync(modelsDir)).toBe(true);

		// The api model must exist (proves the real API Extractor ran).
		const apiJsonPath = join(modelsDir, "meta-prod.api.json");
		expect(existsSync(apiJsonPath)).toBe(true);

		// The meta package.json must be fully resolved (no workspace: or catalog: specifiers).
		const metaPkg = JSON.parse(readFileSync(join(modelsDir, "package.json"), "utf-8")) as Record<string, unknown>;
		const serialized = JSON.stringify(metaPkg);
		expect(serialized).not.toMatch(/workspace:/);
		expect(serialized).not.toMatch(/catalog:/);

		// The optimistic rewrite must have applied: own version and the workspace sibling dep version
		// both reflect the next-release versions injected via the resolveNextVersions seam.
		expect(metaPkg.version).toBe("2.0.0");
		const deps = metaPkg.dependencies as Record<string, string>;
		expect(deps["@savvy-web/tsdown-plugins"]).toBe("2.0.0");
	}, 120_000);
});
