import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitHubAction } from "./github-action.js";

describe("GitHubAction", () => {
	const testDir = resolve(process.cwd(), ".test-fixtures-github-action");

	beforeEach(() => {
		// Create test directory with valid structure
		mkdirSync(resolve(testDir, "src"), { recursive: true });
		writeFileSync(
			resolve(testDir, "src/main.ts"),
			`
import * as core from "@actions/core";
core.info("Hello from main");
`,
		);
		writeFileSync(
			resolve(testDir, "action.yml"),
			`
name: "Test Action"
description: "A test action"
runs:
  using: "node24"
  main: "dist/main/index.js"
`,
		);
	});

	afterEach(() => {
		// Clean up test directory
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("create", () => {
		it("creates instance with default options", () => {
			const action = GitHubAction.create();
			expect(action).toBeInstanceOf(GitHubAction);
		});

		it("creates instance with custom cwd", () => {
			const action = GitHubAction.create({ cwd: testDir });
			expect(action).toBeInstanceOf(GitHubAction);
		});

		it("creates instance with config object", () => {
			const action = GitHubAction.create({
				config: {
					build: { minify: false },
				},
			});
			expect(action).toBeInstanceOf(GitHubAction);
		});
	});

	describe("loadConfig", () => {
		it("loads config from cwd", async () => {
			const action = GitHubAction.create({ cwd: testDir });
			const config = await action.loadConfig();

			expect(config.entries.main).toBe("src/main.ts");
		});

		it("uses provided config object", async () => {
			const action = GitHubAction.create({
				config: {
					entries: { main: "custom/main.ts" },
				},
			});
			const config = await action.loadConfig();

			expect(config.entries.main).toBe("custom/main.ts");
		});
	});

	describe("build error reporting", () => {
		it("returns structured validation result without cause on expected failure", async () => {
			rmSync(resolve(testDir, "src/main.ts"));
			const action = GitHubAction.create({ cwd: testDir });
			const result = await action.build();

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.validation).toBeDefined();
			// cause is only populated for unexpected thrown errors, not structured failures
			expect(result.cause).toBeUndefined();
		});
	});

	describe("validate", () => {
		it("validates successfully with valid setup", async () => {
			const action = GitHubAction.create({ cwd: testDir });
			// Explicitly disable strict mode for predictable test behavior
			const result = await action.validate({ strict: false });

			expect(result.valid).toBe(true);
		});

		it("returns errors for invalid setup", async () => {
			// Remove action.yml
			rmSync(resolve(testDir, "action.yml"));

			const action = GitHubAction.create({ cwd: testDir });
			// Explicitly disable strict mode for predictable test behavior
			const result = await action.validate({ strict: false });

			// Should have warning about missing action.yml
			expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
		});
	});
});
