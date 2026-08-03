import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import { BiomeSyncError } from "../../src/errors/BiomeSyncError.js";
import { BiomeSchemaSync, buildSchemaUrl, extractSemver } from "../../src/services/BiomeSchemaSync.js";

// ---------------------------------------------------------------------------
// Mock FileSystem
// ---------------------------------------------------------------------------

const makeTestFs = (files: Record<string, string>) =>
	Layer.succeed(FileSystem.FileSystem, {
		exists: (path: string) => Effect.succeed(path in files),
		readFileString: (path: string) =>
			path in files ? Effect.succeed(files[path]) : Effect.fail(new Error(`ENOENT: ${path}`)),
		writeFileString: (path: string, content: string) =>
			Effect.sync(() => {
				files[path] = content;
			}),
	} as unknown as FileSystem.FileSystem);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CWD = "/project";

// Per-test provide is REQUIRED here, not an unoptimised leftover: the mocked filesystem is
// built from — and mutated through — the per-test `files` record, so the layer genuinely
// varies test by test and cannot be hoisted into a suite-boundary `layer(...)` block.
function runWith(files: Record<string, string>, effect: Effect.Effect<unknown, unknown, BiomeSchemaSync>) {
	const testFs = makeTestFs(files);
	const layer = BiomeSchemaSync.layer.pipe(Layer.provide(testFs));
	return Effect.provide(effect, layer);
}

// ---------------------------------------------------------------------------
// extractSemver
// ---------------------------------------------------------------------------

describe("extractSemver", () => {
	it("strips caret", () => {
		expect(extractSemver("^2.4.9")).toBe("2.4.9");
	});

	it("strips tilde", () => {
		expect(extractSemver("~2.4.9")).toBe("2.4.9");
	});

	it("strips >= prefix", () => {
		expect(extractSemver(">=2.4.9")).toBe("2.4.9");
	});

	it("strips > prefix", () => {
		expect(extractSemver(">2.4.9")).toBe("2.4.9");
	});

	it("strips v prefix", () => {
		expect(extractSemver("v2.4.9")).toBe("2.4.9");
	});

	it("returns bare semver unchanged", () => {
		expect(extractSemver("2.4.9")).toBe("2.4.9");
	});
});

// ---------------------------------------------------------------------------
// buildSchemaUrl
// ---------------------------------------------------------------------------

describe("buildSchemaUrl", () => {
	it("builds expected URL", () => {
		expect(buildSchemaUrl("2.4.9")).toBe("https://biomejs.dev/schemas/2.4.9/schema.json");
	});
});

// ---------------------------------------------------------------------------
// BiomeSchemaSync.check
// ---------------------------------------------------------------------------

describe("BiomeSchemaSync.check", () => {
	it.effect("reports biome.json as current when schema URL matches", () =>
		Effect.gen(function* () {
			const files = {
				[`${CWD}/biome.json`]: JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.9/schema.json" }),
			};
			const result = yield* runWith(
				files,
				BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("^2.4.9", { cwd: CWD }))),
			);
			expect(result).toMatchObject({
				current: [`${CWD}/biome.json`],
				updated: [],
				skipped: [],
			});
		}),
	);

	it.effect("reports biome.json as needing update when schema URL has wrong version", () =>
		Effect.gen(function* () {
			const files = {
				[`${CWD}/biome.json`]: JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.0/schema.json" }),
			};
			const result = yield* runWith(
				files,
				BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("^2.4.9", { cwd: CWD }))),
			);
			expect(result).toMatchObject({
				updated: [`${CWD}/biome.json`],
				current: [],
				skipped: [],
			});
		}),
	);

	it.effect("does NOT write files even when update is needed", () =>
		Effect.gen(function* () {
			const originalContent = JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.0/schema.json" });
			const files = {
				[`${CWD}/biome.json`]: originalContent,
			};
			yield* runWith(files, BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("^2.4.9", { cwd: CWD }))));
			// File content should be unchanged
			expect(files[`${CWD}/biome.json`]).toBe(originalContent);
		}),
	);

	it.effect("reports biome.json as skipped when no $schema field", () =>
		Effect.gen(function* () {
			const files = {
				[`${CWD}/biome.json`]: JSON.stringify({ formatter: { enabled: true } }),
			};
			const result = yield* runWith(
				files,
				BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("^2.4.9", { cwd: CWD }))),
			);
			expect(result).toMatchObject({
				skipped: [`${CWD}/biome.json`],
				updated: [],
				current: [],
			});
		}),
	);

	it.effect("reports biome.json as skipped when $schema is not a biomejs.dev URL", () =>
		Effect.gen(function* () {
			const files = {
				[`${CWD}/biome.json`]: JSON.stringify({ $schema: "https://example.com/schema.json" }),
			};
			const result = yield* runWith(
				files,
				BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("^2.4.9", { cwd: CWD }))),
			);
			expect(result).toMatchObject({
				skipped: [`${CWD}/biome.json`],
				updated: [],
				current: [],
			});
		}),
	);

	it.effect("handles biome.jsonc as well as biome.json", () =>
		Effect.gen(function* () {
			const files = {
				[`${CWD}/biome.jsonc`]: JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.9/schema.json" }),
			};
			const result = yield* runWith(files, BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("2.4.9", { cwd: CWD }))));
			expect(result).toMatchObject({
				current: [`${CWD}/biome.jsonc`],
				updated: [],
				skipped: [],
			});
		}),
	);

	it.effect("handles both biome.json and biome.jsonc together", () =>
		Effect.gen(function* () {
			const files = {
				[`${CWD}/biome.json`]: JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.9/schema.json" }),
				[`${CWD}/biome.jsonc`]: JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.0/schema.json" }),
			};
			const result = yield* runWith(files, BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("2.4.9", { cwd: CWD }))));
			expect(result).toMatchObject({
				current: [`${CWD}/biome.json`],
				updated: [`${CWD}/biome.jsonc`],
				skipped: [],
			});
		}),
	);
});

// ---------------------------------------------------------------------------
// BiomeSchemaSync.sync
// ---------------------------------------------------------------------------

describe("BiomeSchemaSync.sync", () => {
	it.effect("writes updated content when schema URL has wrong version", () =>
		Effect.gen(function* () {
			const originalContent = JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.0/schema.json" });
			const files = {
				[`${CWD}/biome.json`]: originalContent,
			};
			const result = yield* runWith(files, BiomeSchemaSync.pipe(Effect.andThen((s) => s.sync("^2.4.9", { cwd: CWD }))));
			expect(result).toMatchObject({
				updated: [`${CWD}/biome.json`],
				current: [],
				skipped: [],
			});
			// File should be updated
			expect(files[`${CWD}/biome.json`]).toContain("https://biomejs.dev/schemas/2.4.9/schema.json");
			expect(files[`${CWD}/biome.json`]).not.toContain("2.4.0");
		}),
	);

	it.effect("does not write when schema is already current", () =>
		Effect.gen(function* () {
			const originalContent = JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.9/schema.json" });
			const files = {
				[`${CWD}/biome.json`]: originalContent,
			};
			yield* runWith(files, BiomeSchemaSync.pipe(Effect.andThen((s) => s.sync("2.4.9", { cwd: CWD }))));
			expect(files[`${CWD}/biome.json`]).toBe(originalContent);
		}),
	);

	it.effect("reports empty result when no biome configs found", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const result = yield* runWith(files, BiomeSchemaSync.pipe(Effect.andThen((s) => s.sync("2.4.9", { cwd: CWD }))));
			expect(result).toMatchObject({ updated: [], skipped: [], current: [] });
		}),
	);
});

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

describe("BiomeSyncError", () => {
	it("has correct tag", () => {
		const err = new BiomeSyncError({ path: "/biome.json", reason: "disk full" });
		expect(err._tag).toBe("BiomeSyncError");
	});

	it("has human-readable message", () => {
		const err = new BiomeSyncError({ path: "/biome.json", reason: "disk full" });
		expect(err.message).toContain("/biome.json");
		expect(err.message).toContain("disk full");
	});
});
