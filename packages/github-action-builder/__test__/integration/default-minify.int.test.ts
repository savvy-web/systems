/**
 * Integration regression test for the unminified-dist trap found by the
 * silk-update-action dogfood loop (github-split round 2, findings item 8).
 *
 * Via the JS API, rsbuild resolves `mode` from NODE_ENV and falls back to
 * "none" when it is unset — and minification only applies in "production"
 * mode, so a bare local `build:prod` silently emitted a ~7x unminified dist
 * while CI (NODE_ENV=production) minified. The builder now pins
 * `mode: "production"`, making the default `build.minify: true` effective
 * regardless of the caller's environment. This suite builds with the DEFAULT
 * config (no minify override) under a scrubbed NODE_ENV and asserts the
 * output is actually minified; reverting the mode pin turns it red.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@rsbuild/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GitHubAction } from "../../src/index.js";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/default-minify");
const mainJs = join(fixtureDir, "dist", "main.js");

describe("default-config builds minify without NODE_ENV", () => {
	const previousNodeEnv = process.env.NODE_ENV;

	beforeAll(async () => {
		// Vitest sets NODE_ENV=test, which — like an interactive shell with no
		// NODE_ENV — resolves rsbuild's JS-API mode to "none". Scrub it anyway so
		// the reproduction does not depend on the runner's default.
		delete process.env.NODE_ENV;
		rmSync(join(fixtureDir, "dist"), { recursive: true, force: true });
		const action = GitHubAction.create({
			cwd: fixtureDir,
			skipValidation: true,
			config: {
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
		if (!result.success) {
			throw new Error(`fixture build failed: ${result.error ?? "unknown error"}`);
		}
	}, 120_000);

	afterAll(() => {
		if (previousNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = previousNodeEnv;
		}
	});

	it("bundles the fixture action", () => {
		expect(existsSync(mainJs)).toBe(true);
	});

	it("emits a minified bundle under the default config", () => {
		const source = readFileSync(mainJs, "utf8");
		const lines = source.split("\n");
		// An unminified emission of this fixture keeps every statement on its own
		// line (hundreds of lines once rspack's runtime is included); the minified
		// bundle collapses to a few. The threshold is deliberately loose — it
		// discriminates minified-vs-not, not exact output shape.
		expect(lines.length).toBeLessThan(30);
		// Unminified rspack output carries its module-boundary banner comments;
		// the minifier strips them. Their presence is the direct "mode never
		// reached production" signal.
		expect(source).not.toContain("/******/");
	});
});
