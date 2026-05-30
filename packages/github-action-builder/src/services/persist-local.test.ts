/**
 * Tests for PersistLocalService.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppLayer } from "../layers/app.js";
import { defineConfig } from "../schemas/config.js";
import { PersistLocalService } from "./persist-local.js";

describe("PersistLocalService", () => {
	const testDir = resolve(process.cwd(), ".test-fixtures-persist-local");

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

	it("copies action.yml and dist/ to output directory", async () => {
		const config = defineConfig({});

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.success).toBe(true);
		expect(result.filesCopied).toBeGreaterThan(0);

		const outputPath = resolve(testDir, ".github/actions/local");
		expect(existsSync(resolve(outputPath, "action.yml"))).toBe(true);
		expect(existsSync(resolve(outputPath, "dist/main/index.js"))).toBe(true);
	});

	it("skips unchanged files on second run", async () => {
		const config = defineConfig({});

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		// First run
		const result1 = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(result1.filesCopied).toBeGreaterThan(0);

		// Second run — files unchanged
		const result2 = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(result2.filesCopied).toBe(0);
		expect(result2.filesSkipped).toBeGreaterThan(0);
	});

	it("copies changed files on subsequent run", async () => {
		const config = defineConfig({});

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		// First run
		await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		// Modify a file
		writeFileSync(resolve(testDir, "dist/main/index.js"), 'console.log("updated");');

		// Second run — should detect change
		const result2 = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(result2.filesCopied).toBeGreaterThan(0);
	});

	it("returns early when disabled", async () => {
		const config = defineConfig({ persistLocal: { enabled: false } });

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.success).toBe(true);
		expect(result.filesCopied).toBe(0);
		expect(result.filesSkipped).toBe(0);
		expect(result.actTemplateGenerated).toBe(false);
	});

	it("generates act template files", async () => {
		const config = defineConfig({ persistLocal: { actTemplate: true } });

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.actTemplateGenerated).toBe(true);
		expect(existsSync(resolve(testDir, ".actrc"))).toBe(true);
		expect(existsSync(resolve(testDir, ".github/workflows/act-test.yml"))).toBe(true);

		const actrc = readFileSync(resolve(testDir, ".actrc"), "utf8");
		expect(actrc).toContain("--container-architecture linux/amd64");
	});

	it("does not overwrite existing act template files", async () => {
		const config = defineConfig({ persistLocal: { actTemplate: true } });

		// Create existing .actrc
		writeFileSync(resolve(testDir, ".actrc"), "custom content");
		mkdirSync(resolve(testDir, ".github/workflows"), { recursive: true });
		writeFileSync(resolve(testDir, ".github/workflows/act-test.yml"), "custom workflow");

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.actTemplateGenerated).toBe(false);
		expect(readFileSync(resolve(testDir, ".actrc"), "utf8")).toBe("custom content");
	});

	it("skips act template when actTemplate is false", async () => {
		const config = defineConfig({ persistLocal: { actTemplate: false } });

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.actTemplateGenerated).toBe(false);
		expect(existsSync(resolve(testDir, ".actrc"))).toBe(false);
	});

	it("uses custom output path", async () => {
		const config = defineConfig({ persistLocal: { path: ".github/actions/custom" } });

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.success).toBe(true);
		expect(result.outputPath).toBe(resolve(testDir, ".github/actions/custom"));
		expect(existsSync(resolve(testDir, ".github/actions/custom/action.yml"))).toBe(true);
	});

	it("removes stale files from destination", async () => {
		const config = defineConfig({});
		const outputPath = resolve(testDir, ".github/actions/local");

		// Create a stale file in the dest dist/
		mkdirSync(resolve(outputPath, "dist/old"), { recursive: true });
		writeFileSync(resolve(outputPath, "dist/old/stale.js"), "stale");

		// Also copy the current dist so it exists
		mkdirSync(resolve(outputPath, "dist/main"), { recursive: true });
		copyFileSync(resolve(testDir, "dist/main/index.js"), resolve(outputPath, "dist/main/index.js"));

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		// Stale file should be removed
		expect(existsSync(resolve(outputPath, "dist/old/stale.js"))).toBe(false);
	});

	it("fails with ActionYmlPathError when runs paths don't resolve", async () => {
		const config = defineConfig({});

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

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		}).pipe(Effect.either);

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("ActionYmlPathError");
		}
	});

	it("formats result correctly", async () => {
		const config = defineConfig({});

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			const result = yield* service.persist(config, { cwd: testDir });
			return service.formatResult(result);
		});

		const formatted = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(formatted).toContain("Persist Local Summary");
		expect(formatted).toContain("Files copied");
	});

	it("formats failure result correctly", async () => {
		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return service.formatResult({
				success: false,
				filesCopied: 0,
				filesSkipped: 0,
				actTemplateGenerated: false,
				outputPath: "/tmp/test",
				error: "something went wrong",
			});
		});

		const formatted = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(formatted).toContain("Persist Local Failed");
		expect(formatted).toContain("something went wrong");
	});

	it("handles missing action.yml gracefully", async () => {
		const config = defineConfig({});

		// Remove action.yml
		rmSync(resolve(testDir, "action.yml"));

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		// Should succeed even without action.yml
		expect(result.success).toBe(true);
		expect(existsSync(resolve(testDir, ".github/actions/local/action.yml"))).toBe(false);
	});

	it("removes stale destination action.yml when source is deleted", async () => {
		const config = defineConfig({});
		const outputPath = resolve(testDir, ".github/actions/local");

		// First run — copies action.yml
		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});
		await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(existsSync(resolve(outputPath, "action.yml"))).toBe(true);

		// Delete source action.yml
		rmSync(resolve(testDir, "action.yml"));

		// Second run — should remove stale dest action.yml
		await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(existsSync(resolve(outputPath, "action.yml"))).toBe(false);
	});

	it("handles action.yml without runs section", async () => {
		const config = defineConfig({});

		writeFileSync(
			resolve(testDir, "action.yml"),
			`name: "Test"
description: "No runs section"
`,
		);

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.success).toBe(true);
	});

	it("handles missing dist directory gracefully", async () => {
		const config = defineConfig({});

		// Remove dist
		rmSync(resolve(testDir, "dist"), { recursive: true, force: true });

		// Omit runs section so path validation has nothing to check
		writeFileSync(
			resolve(testDir, "action.yml"),
			`name: "Test"
description: "No dist"
`,
		);

		const program = Effect.gen(function* () {
			const service = yield* PersistLocalService;
			return yield* service.persist(config, { cwd: testDir });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

		expect(result.success).toBe(true);
		// Only action.yml was copied, no dist files
		expect(result.filesCopied).toBe(1);
	});
});
