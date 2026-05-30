/**
 * Integration regression test for issue #81.
 *
 * The builder must honor user-configured string `externals` in addition to
 * externalizing `node:` builtins. 0.6.4 regressed this: leading the externals
 * array with a function caused rspack to stop consulting the trailing string
 * entries, so configured externals were bundled (and hard-failed to resolve)
 * instead of externalized.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { GitHubAction } from "../../src/index.js";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/string-externals");
const mainJs = join(fixtureDir, "dist", "main.js");

describe("issue #81: string externals regression", () => {
	it("externalizes node: builtins and configured string externals", async () => {
		rmSync(join(fixtureDir, "dist"), { recursive: true, force: true });
		const action = GitHubAction.create({
			cwd: fixtureDir,
			skipValidation: true,
			config: {
				build: { minify: false, externals: ["uninstalled-peer-dep"] },
				persistLocal: { enabled: false },
			},
		});
		const result = await action.build();

		// Build must succeed even though "uninstalled-peer-dep" is not installed —
		// it resolves only if the configured string external is honored.
		expect(result.success).toBe(true);
		expect(existsSync(mainJs)).toBe(true);

		const bundle = readFileSync(mainJs, "utf8");
		// Configured string external is left as a runtime import, not bundled.
		expect(bundle).toMatch(/uninstalled-peer-dep/);
		// node: builtins still externalize (guards the issue #79 fix).
		expect(bundle).toMatch(/node:crypto/);
	}, 120_000);
});
