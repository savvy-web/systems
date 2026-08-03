import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import type { ConfigLocation } from "../../src/schemas/ConfigDiscoverySchemas.js";
import { ConfigDiscovery } from "../../src/services/ConfigDiscovery.js";

// ---------------------------------------------------------------------------
// Mock FileSystem
// ---------------------------------------------------------------------------

const makeTestFs = (existingPaths: ReadonlyArray<string>) =>
	Layer.succeed(FileSystem.FileSystem, {
		exists: (path: string) => Effect.succeed(existingPaths.includes(path)),
	} as unknown as FileSystem.FileSystem);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Per-test provide is REQUIRED here, not an unoptimised leftover: the mocked filesystem is
// built from the per-test `existingPaths`, so the layer genuinely varies test by test and
// cannot be hoisted into a suite-boundary `layer(...)` block.
function runWith(existingPaths: ReadonlyArray<string>, effect: Effect.Effect<unknown, unknown, ConfigDiscovery>) {
	const testFs = makeTestFs(existingPaths);
	const layer = ConfigDiscovery.layer.pipe(Layer.provide(testFs));
	return Effect.provide(effect, layer);
}

// ---------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------

describe("ConfigDiscovery.find", () => {
	it.effect("finds config in lib/configs/ first when both exist", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const result = (yield* runWith(
				[`${cwd}/lib/configs/biome.json`, `${cwd}/biome.json`],
				ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))),
			)) as ConfigLocation;

			expect(result).not.toBeNull();
			expect(result.source).toBe("lib");
			expect(result.path).toBe(`${cwd}/lib/configs/biome.json`);
		}),
	);

	it.effect("falls back to repo root when lib/configs/ does not have it", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const result = (yield* runWith(
				[`${cwd}/biome.json`],
				ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))),
			)) as ConfigLocation;

			expect(result).not.toBeNull();
			expect(result.source).toBe("root");
			expect(result.path).toBe(`${cwd}/biome.json`);
		}),
	);

	it.effect("returns null when not found anywhere", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const result = yield* runWith([], ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))));

			expect(result).toBeNull();
		}),
	);

	it.effect("works with different cwd values", () =>
		Effect.gen(function* () {
			const cwd = "/other/workspace";
			const result = (yield* runWith(
				[`${cwd}/lib/configs/tsconfig.json`],
				ConfigDiscovery.pipe(Effect.andThen((s) => s.find("tsconfig.json", { cwd }))),
			)) as ConfigLocation;

			expect(result).not.toBeNull();
			expect(result.source).toBe("lib");
			expect(result.path).toBe(`${cwd}/lib/configs/tsconfig.json`);
		}),
	);
});

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe("ConfigDiscovery.findAll", () => {
	it.effect("returns all matches with priority order (lib first, then root)", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const results = (yield* runWith(
				[`${cwd}/lib/configs/biome.json`, `${cwd}/biome.json`],
				ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
			)) as ReadonlyArray<ConfigLocation>;

			expect(results).toHaveLength(2);
			expect(results[0].source).toBe("lib");
			expect(results[0].path).toBe(`${cwd}/lib/configs/biome.json`);
			expect(results[1].source).toBe("root");
			expect(results[1].path).toBe(`${cwd}/biome.json`);
		}),
	);

	it.effect("returns only lib match when only lib/configs/ has it", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const results = (yield* runWith(
				[`${cwd}/lib/configs/biome.json`],
				ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
			)) as ReadonlyArray<ConfigLocation>;

			expect(results).toHaveLength(1);
			expect(results[0].source).toBe("lib");
		}),
	);

	it.effect("returns only root match when only root has it", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const results = (yield* runWith(
				[`${cwd}/biome.json`],
				ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
			)) as ReadonlyArray<ConfigLocation>;

			expect(results).toHaveLength(1);
			expect(results[0].source).toBe("root");
		}),
	);

	it.effect("returns empty array when nothing found", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const results = (yield* runWith(
				[],
				ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
			)) as ReadonlyArray<ConfigLocation>;

			expect(results).toHaveLength(0);
		}),
	);
});

// ---------------------------------------------------------------------------
// PlatformError resilience
// ---------------------------------------------------------------------------

describe("ConfigDiscovery error handling", () => {
	it.effect("treats PlatformError from fs.exists as not found", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			// Mock that throws an error for exists
			const errorFs = Layer.succeed(FileSystem.FileSystem, {
				exists: (_path: string) => Effect.fail(new Error("permission denied")),
			} as unknown as FileSystem.FileSystem);
			const layer = ConfigDiscovery.layer.pipe(Layer.provide(errorFs));

			const result = yield* Effect.provide(
				ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))),
				layer,
			);

			expect(result).toBeNull();
		}),
	);
});
