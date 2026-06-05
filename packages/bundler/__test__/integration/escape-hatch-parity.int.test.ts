import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { InlineConfig } from "tsdown";
import { build } from "tsdown";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const LEAF = join(import.meta.dirname, "fixtures/leaf");
// Use a dedicated escape-hatch outDir so this test does not compete for
// dist/prod/npm/pkg with leaf-build.int.test.ts when both run concurrently.
const ESCAPE_OUT = join(LEAF, "dist/escape/pkg");
const FRONT_DOOR_OUT = join(LEAF, "dist/prod/npm/pkg");

describe("escape-hatch parity", () => {
	it("raw tsdown.config.ts + plugins produces a pkg/ that diffs equal to the front door", async () => {
		// front door build into dist/prod/npm/pkg (its own scoped cleanup)
		rmSync(FRONT_DOOR_OUT, { recursive: true, force: true });
		await runBuild(defineBuild({ formats: ["esm"] }), { cwd: LEAF, argv: ["--target", "npm"] });
		const frontManifest = readFileSync(join(FRONT_DOOR_OUT, "package.json"), "utf-8");

		// escape hatch build into dist/escape/pkg (its own scoped cleanup)
		rmSync(ESCAPE_OUT, { recursive: true, force: true });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const configModule = await import(`${LEAF}/tsdown.config.ts`);
		// The imported config is a single UserConfig object; cast to InlineConfig to pass config:false.
		const escapeConfig = configModule.default as InlineConfig;
		await build({ ...escapeConfig, config: false });

		const hatchManifest = readFileSync(join(ESCAPE_OUT, "package.json"), "utf-8");

		// Parity: the emitted package.json must be identical regardless of outDir
		expect(hatchManifest).toBe(frontManifest);
		expect(existsSync(join(ESCAPE_OUT, "index.js"))).toBe(true);
	});
});
