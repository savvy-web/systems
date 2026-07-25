/**
 * Tests for PersistLocalService.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, layer } from "@effect/vitest";
import { Effect } from "effect";
// `vi` always comes from "vitest", never from the "@effect/vitest" re-export:
// vitest hoists `vi.mock(...)` above all imports, so a re-exported binding is
// not yet initialized and the file dies at load with an error naming neither
// `vi` nor `@effect/vitest`. Only `vi.spyOn` is used here today, but the
// convention is uniform so adding a `vi.mock` later cannot break this file.
import { vi } from "vitest";
import { AppLayer } from "../../src/layers/app.js";
import { defineConfig } from "../../src/schemas/config.js";
import { PersistLocalService } from "../../src/services/persist-local.js";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

const testDir = resolve(process.cwd(), ".test-fixtures-persist-local");

/** Runs the service against the fixture dir; the layer supplies PersistLocalService. */
const persist = (config: ReturnType<typeof defineConfig>) =>
	Effect.flatMap(PersistLocalService, (service) => service.persist(config, { cwd: testDir }));

layer(AppLayer)("PersistLocalService", (it) => {
	beforeEach(() => {
		mkdirSync(resolve(testDir, "src"), { recursive: true });
		mkdirSync(resolve(testDir, "dist/main"), { recursive: true });

		writeFileSync(resolve(testDir, "src/main.ts"), 'console.log("hello");');
		writeFileSync(resolve(testDir, "dist/main/index.js"), 'console.log("built");');
		writeFileSync(resolve(testDir, "dist/package.json"), '{ "type": "module" }');
		writeFileSync(
			resolve(testDir, "action.yml"),
			`name: "Test Action"
description: "A test action"
runs:
  using: "node24"
  main: "dist/main/index.js"
`,
		);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it.effect("copies action.yml and dist/ to output directory", () =>
		Effect.gen(function* () {
			const result = yield* persist(defineConfig({}));

			expect(result.success).toBe(true);
			expect(result.filesCopied).toBeGreaterThan(0);

			const outputPath = resolve(testDir, ".github/actions/local");
			expect(existsSync(resolve(outputPath, "action.yml"))).toBe(true);
			expect(existsSync(resolve(outputPath, "dist/main/index.js"))).toBe(true);
		}),
	);

	it.effect("skips unchanged files on second run", () =>
		Effect.gen(function* () {
			const config = defineConfig({});

			// First run
			const result1 = yield* persist(config);
			expect(result1.filesCopied).toBeGreaterThan(0);

			// Second run — files unchanged
			const result2 = yield* persist(config);
			expect(result2.filesCopied).toBe(0);
			expect(result2.filesSkipped).toBeGreaterThan(0);
		}),
	);

	it.effect("copies changed files on subsequent run", () =>
		Effect.gen(function* () {
			const config = defineConfig({});

			// First run
			yield* persist(config);

			// Modify a file
			writeFileSync(resolve(testDir, "dist/main/index.js"), 'console.log("updated");');

			// Second run — should detect change
			const result2 = yield* persist(config);
			expect(result2.filesCopied).toBeGreaterThan(0);
		}),
	);

	it.effect("returns early when disabled", () =>
		Effect.gen(function* () {
			const result = yield* persist(defineConfig({ persistLocal: { enabled: false } }));

			expect(result.success).toBe(true);
			expect(result.filesCopied).toBe(0);
			expect(result.filesSkipped).toBe(0);
			expect(result.actTemplateGenerated).toBe(false);
		}),
	);

	it.effect("generates act template files", () =>
		Effect.gen(function* () {
			const result = yield* persist(defineConfig({ persistLocal: { actTemplate: true } }));

			expect(result.actTemplateGenerated).toBe(true);
			expect(existsSync(resolve(testDir, ".actrc"))).toBe(true);
			expect(existsSync(resolve(testDir, ".github/workflows/act-test.yml"))).toBe(true);

			const actrc = readFileSync(resolve(testDir, ".actrc"), "utf8");
			expect(actrc).toContain("--container-architecture linux/amd64");
		}),
	);

	it.effect("does not overwrite existing act template files", () =>
		Effect.gen(function* () {
			// Create existing .actrc
			writeFileSync(resolve(testDir, ".actrc"), "custom content");
			mkdirSync(resolve(testDir, ".github/workflows"), { recursive: true });
			writeFileSync(resolve(testDir, ".github/workflows/act-test.yml"), "custom workflow");

			const result = yield* persist(defineConfig({ persistLocal: { actTemplate: true } }));

			expect(result.actTemplateGenerated).toBe(false);
			expect(readFileSync(resolve(testDir, ".actrc"), "utf8")).toBe("custom content");
		}),
	);

	it.effect("skips act template when actTemplate is false", () =>
		Effect.gen(function* () {
			const result = yield* persist(defineConfig({ persistLocal: { actTemplate: false } }));

			expect(result.actTemplateGenerated).toBe(false);
			expect(existsSync(resolve(testDir, ".actrc"))).toBe(false);
		}),
	);

	it.effect("uses custom output path", () =>
		Effect.gen(function* () {
			const result = yield* persist(defineConfig({ persistLocal: { path: ".github/actions/custom" } }));

			expect(result.success).toBe(true);
			expect(result.outputPath).toBe(resolve(testDir, ".github/actions/custom"));
			expect(existsSync(resolve(testDir, ".github/actions/custom/action.yml"))).toBe(true);
		}),
	);

	it.effect("removes stale files from destination", () =>
		Effect.gen(function* () {
			const outputPath = resolve(testDir, ".github/actions/local");

			// Create a stale file in the dest dist/
			mkdirSync(resolve(outputPath, "dist/old"), { recursive: true });
			writeFileSync(resolve(outputPath, "dist/old/stale.js"), "stale");

			// Also copy the current dist so it exists
			mkdirSync(resolve(outputPath, "dist/main"), { recursive: true });
			copyFileSync(resolve(testDir, "dist/main/index.js"), resolve(outputPath, "dist/main/index.js"));

			yield* persist(defineConfig({}));

			// Stale file should be removed
			expect(existsSync(resolve(outputPath, "dist/old/stale.js"))).toBe(false);
		}),
	);

	it.effect("fails with ActionYmlPathError when runs paths don't resolve", () =>
		Effect.gen(function* () {
			// Write action.yml pointing to a non-existent file
			writeFileSync(
				resolve(testDir, "action.yml"),
				`name: "Test"
description: "Test"
runs:
  using: "node24"
  main: "dist/nonexistent/index.js"
`,
			);

			const error = yield* Effect.flip(persist(defineConfig({})));

			expect(error._tag).toBe("ActionYmlPathError");
		}),
	);

	it.effect("formats result correctly", () =>
		Effect.gen(function* () {
			const service = yield* PersistLocalService;
			const result = yield* service.persist(defineConfig({}), { cwd: testDir });
			const formatted = service.formatResult(result);

			expect(formatted).toContain("Persist Local Summary");
			expect(formatted).toContain("Files copied");
		}),
	);

	it.effect("formats failure result correctly", () =>
		Effect.gen(function* () {
			const service = yield* PersistLocalService;
			const formatted = service.formatResult({
				success: false,
				filesCopied: 0,
				filesSkipped: 0,
				actTemplateGenerated: false,
				outputPath: "/tmp/test",
				error: "something went wrong",
			});

			expect(formatted).toContain("Persist Local Failed");
			expect(formatted).toContain("something went wrong");
		}),
	);

	it.effect("handles missing action.yml gracefully", () =>
		Effect.gen(function* () {
			// Remove action.yml
			rmSync(resolve(testDir, "action.yml"));

			const result = yield* persist(defineConfig({}));

			// Should succeed even without action.yml
			expect(result.success).toBe(true);
			expect(existsSync(resolve(testDir, ".github/actions/local/action.yml"))).toBe(false);
		}),
	);

	it.effect("removes stale destination action.yml when source is deleted", () =>
		Effect.gen(function* () {
			const config = defineConfig({});
			const outputPath = resolve(testDir, ".github/actions/local");

			// First run — copies action.yml
			yield* persist(config);
			expect(existsSync(resolve(outputPath, "action.yml"))).toBe(true);

			// Delete source action.yml
			rmSync(resolve(testDir, "action.yml"));

			// Second run — should remove stale dest action.yml
			yield* persist(config);
			expect(existsSync(resolve(outputPath, "action.yml"))).toBe(false);
		}),
	);

	it.effect("handles action.yml without runs section", () =>
		Effect.gen(function* () {
			writeFileSync(
				resolve(testDir, "action.yml"),
				`name: "Test"
description: "No runs section"
`,
			);

			const result = yield* persist(defineConfig({}));

			expect(result.success).toBe(true);
		}),
	);

	it.effect("handles missing dist directory gracefully", () =>
		Effect.gen(function* () {
			// Remove dist
			rmSync(resolve(testDir, "dist"), { recursive: true, force: true });

			// Omit runs section so path validation has nothing to check
			writeFileSync(
				resolve(testDir, "action.yml"),
				`name: "Test"
description: "No dist"
`,
			);

			const result = yield* persist(defineConfig({}));

			expect(result.success).toBe(true);
			// Only action.yml was copied, no dist files
			expect(result.filesCopied).toBe(1);
		}),
	);
});
