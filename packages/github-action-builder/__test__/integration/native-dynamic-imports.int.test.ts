/**
 * Integration test for the build.nativeDynamicImports option.
 *
 * A package listed in build.nativeDynamicImports performs a fully dynamic,
 * non-literal `import(...)` at runtime (mirroring @changesets/apply-release-plan's
 * changelog-module resolution). Without the fix, rspack compiles that call
 * into an empty context module that throws "Cannot find module" at runtime
 * even though the target file exists on disk. With the option set, the
 * bundle must carry a native `import(` for that call instead, and the built
 * action must actually run and resolve the dynamically-imported module.
 *
 * "fake-dynamic-pkg" is not a real dependency: node_modules is gitignored
 * (`**\/node_modules` in .gitignore), so a fixture package cannot live
 * directly under a committed node_modules/ directory. This test instead
 * materializes it under the fixture's node_modules/ at test time from the
 * committed ../fixtures/native-dynamic-imports/pkg-source sources, so the
 * module is genuinely resolved through node_modules (exercising the same
 * path-matching regex used against real npm packages) without committing a
 * node_modules directory to git.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@rsbuild/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GitHubAction } from "../../src/index.js";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/native-dynamic-imports");
const pkgSourceDir = join(fixtureDir, "pkg-source");
const fakePkgDir = join(fixtureDir, "node_modules", "fake-dynamic-pkg");
const mainJs = join(fixtureDir, "dist", "main.js");

describe("build.nativeDynamicImports option", () => {
	beforeEach(() => {
		rmSync(join(fixtureDir, "dist"), { recursive: true, force: true });
		rmSync(join(fixtureDir, "node_modules"), { recursive: true, force: true });
		cpSync(pkgSourceDir, fakePkgDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(join(fixtureDir, "node_modules"), { recursive: true, force: true });
	});

	it("leaves the listed package's dynamic import() native and runnable", async () => {
		const action = GitHubAction.create({
			cwd: fixtureDir,
			skipValidation: true,
			config: {
				build: { minify: false, nativeDynamicImports: ["fake-dynamic-pkg"] },
				persistLocal: { enabled: false },
			},
		});
		// Silence rsbuild's reporter (build banners + file-size table) so the
		// in-process build leaks no stray output into the test run.
		const previousLogLevel = logger.level;
		logger.level = "silent";
		let result: Awaited<ReturnType<typeof action.build>>;
		try {
			result = await action.build();
		} finally {
			logger.level = previousLogLevel;
		}

		expect(result.success).toBe(true);
		expect(existsSync(mainJs)).toBe(true);

		const bundle = readFileSync(mainJs, "utf8");
		// The loader's injected comment survives into the bundle, proving rspack
		// left the call as a native import() instead of compiling a context
		// module (a context module strips the call site entirely and replaces
		// it with generated require-map lookup code).
		expect(bundle).toContain("webpackIgnore: true");
		expect(bundle).toMatch(/import\(\s*\/\*\s*webpackIgnore: true\s*\*\/\s*\w+\)/);

		// The built action actually runs and resolves the dynamically-imported
		// module from disk at its real runtime path.
		const output = execFileSync("node", [mainJs], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		expect(output.trim()).toBe("value=native-dynamic-import-works");
	}, 120_000);

	it("without the option, the same dynamic import() breaks at runtime", async () => {
		const action = GitHubAction.create({
			cwd: fixtureDir,
			skipValidation: true,
			config: {
				build: { minify: false },
				persistLocal: { enabled: false },
			},
		});
		const previousLogLevel = logger.level;
		logger.level = "silent";
		let result: Awaited<ReturnType<typeof action.build>>;
		try {
			result = await action.build();
		} finally {
			logger.level = previousLogLevel;
		}

		expect(result.success).toBe(true);
		expect(existsSync(mainJs)).toBe(true);

		// Without nativeDynamicImports, rspack compiles the fully dynamic
		// import(expr) into a context module. At runtime it can't resolve the
		// real path and throws, so the action process exits non-zero — this is
		// the bug this feature fixes.
		expect(() =>
			execFileSync("node", [mainJs], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}),
		).toThrow();
	}, 120_000);
});
