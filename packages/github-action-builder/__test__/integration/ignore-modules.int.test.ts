/**
 * Integration test for the build.ignore option (issue #81 design).
 *
 * A module listed in build.ignore must be replaced with a throwing stub, so
 * the build succeeds even when the module is absent from node_modules, the
 * bundle carries the stub (not rspack's own missing-module shim), and a
 * try/catch-guarded require treats the module as unavailable.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { GitHubAction } from "../../src/index.js";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/ignore-modules");
const mainJs = join(fixtureDir, "dist", "main.js");

describe("issue #81: build.ignore option", () => {
	it("replaces ignored modules with a throwing stub", async () => {
		rmSync(join(fixtureDir, "dist"), { recursive: true, force: true });
		const action = GitHubAction.create({
			cwd: fixtureDir,
			skipValidation: true,
			config: {
				build: { minify: false, ignore: ["excluded-native-dep"] },
				persistLocal: { enabled: false },
			},
		});
		const result = await action.build();

		expect(result.success).toBe(true);
		expect(existsSync(mainJs)).toBe(true);

		// build.ignore replaces the module with the builder's throwing stub.
		// Without the feature, rspack instead emits its own missing-module
		// shim — so the stub's message is the discriminating signal.
		const bundle = readFileSync(mainJs, "utf8");
		expect(bundle).toContain("excluded via the build 'ignore' option");

		// At runtime the stubbed require throws; the fixture's try/catch
		// catches it and reports the optional dependency as unavailable.
		const output = execFileSync("node", [mainJs], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		expect(output.trim()).toBe("xmlAvailable=false");
	}, 120_000);
});
