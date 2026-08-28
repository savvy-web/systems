import { describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, FileSystem, Layer } from "effect";
import { BiomeSyncError } from "../../src/errors/BiomeSyncError.js";
import { BiomeSchemaSync, buildSchemaUrl, extractSemver } from "../../src/services/BiomeSchemaSync.js";

// ---------------------------------------------------------------------------
// Virtual FileSystem
// ---------------------------------------------------------------------------

// A real `FileSystem` over an in-memory volume, replacing a hand-rolled stub
// that stored writes in the same mutable record it read from. Two gains: an
// unseeded read now fails typed `NotFound` instead of a bare
// `new Error("ENOENT: …")` the real filesystem never produces, and a
// write-then-read round-trip goes through the filesystem contract rather than
// through the stub's own bookkeeping.
const makeTestFs = (files: Record<string, string>) => MemoryFileSystem.layerWith(files);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CWD = "/project";

// Per-test provide is REQUIRED here, not an unoptimised leftover: the volume is seeded from
// the per-test `files` record, so the layer genuinely varies test by test and cannot be
// hoisted into a suite-boundary `layer(...)` block.
function runWith(files: Record<string, string>, effect: Effect.Effect<unknown, unknown, BiomeSchemaSync>) {
	const testFs = makeTestFs(files);
	const layer = BiomeSchemaSync.layer.pipe(Layer.provide(testFs));
	return Effect.provide(effect, layer);
}

// For the tests that assert on file CONTENT after the run. Writes now land in the volume
// instead of back in the caller's `files` record, so the read-back must see the SAME volume
// as the write.
//
// That requires ONE `Effect.provide`, not one layer value. Binding `layerWith(seed)` to a
// const is NOT sufficient: layer memoization is per-build, so two separate `Effect.provide`
// calls against the same const build two independent volumes, each re-seeded — the read-back
// silently returns the seed and an assertion written against the seed passes vacuously.
// `provideMerge` exposes `BiomeSchemaSync` and `FileSystem` from a single build, so the whole
// test body runs against one volume.
function runOnVolume<A, E>(
	files: Record<string, string>,
	body: Effect.Effect<A, E, BiomeSchemaSync | FileSystem.FileSystem>,
): Effect.Effect<A, E> {
	return Effect.provide(body, Layer.provideMerge(BiomeSchemaSync.layer, makeTestFs(files)));
}

/** Read a file back from the volume the surrounding `runOnVolume` body is running against. */
const readBack = (path: string) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(path));

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
			const after = yield* runOnVolume(
				{ [`${CWD}/biome.json`]: originalContent },
				Effect.gen(function* () {
					yield* BiomeSchemaSync.pipe(Effect.andThen((s) => s.check("^2.4.9", { cwd: CWD })));
					return yield* readBack(`${CWD}/biome.json`);
				}),
			);
			// File content should be unchanged
			expect(after).toBe(originalContent);
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

	it.effect("reports biome.json as skipped when $schema only contains biomejs.dev in path", () =>
		Effect.gen(function* () {
			const files = {
				[`${CWD}/biome.json`]: JSON.stringify({
					$schema: "https://evil.example/biomejs.dev/schemas/2.4.0/schema.json",
				}),
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
			const { result, written } = yield* runOnVolume(
				{ [`${CWD}/biome.json`]: originalContent },
				Effect.gen(function* () {
					const result = yield* BiomeSchemaSync.pipe(Effect.andThen((s) => s.sync("^2.4.9", { cwd: CWD })));
					return { result, written: yield* readBack(`${CWD}/biome.json`) };
				}),
			);
			expect(result).toMatchObject({
				updated: [`${CWD}/biome.json`],
				current: [],
				skipped: [],
			});
			// File should be updated
			expect(written).toContain("https://biomejs.dev/schemas/2.4.9/schema.json");
			expect(written).not.toContain("2.4.0");
		}),
	);

	it.effect("rewrites only $schema when the same URL appears in another field", () =>
		Effect.gen(function* () {
			const staleSchema = "https://biomejs.dev/schemas/2.4.0/schema.json";
			const expectedSchema = "https://biomejs.dev/schemas/2.4.9/schema.json";
			const originalContent = `{
  "$schema": "${staleSchema}",
  "note": "${staleSchema}",
  "formatter": { "enabled": true }
}
`;

			const { result, written } = yield* runOnVolume(
				{ [`${CWD}/biome.json`]: originalContent },
				Effect.gen(function* () {
					const result = yield* BiomeSchemaSync.pipe(Effect.andThen((s) => s.sync("^2.4.9", { cwd: CWD })));
					return { result, written: yield* readBack(`${CWD}/biome.json`) };
				}),
			);

			expect(result).toMatchObject({
				updated: [`${CWD}/biome.json`],
				current: [],
				skipped: [],
			});

			expect(written).toBe(`{
  "$schema": "${expectedSchema}",
  "note": "${staleSchema}",
  "formatter": { "enabled": true }
}
`);
		}),
	);

	it.effect("does not write when schema is already current", () =>
		Effect.gen(function* () {
			const originalContent = JSON.stringify({ $schema: "https://biomejs.dev/schemas/2.4.9/schema.json" });
			const after = yield* runOnVolume(
				{ [`${CWD}/biome.json`]: originalContent },
				Effect.gen(function* () {
					yield* BiomeSchemaSync.pipe(Effect.andThen((s) => s.sync("2.4.9", { cwd: CWD })));
					return yield* readBack(`${CWD}/biome.json`);
				}),
			);
			expect(after).toBe(originalContent);
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
