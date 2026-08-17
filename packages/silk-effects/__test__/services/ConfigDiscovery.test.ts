import { describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, FileSystem, Layer } from "effect";
import { systemError } from "effect/PlatformError";
import type { ConfigLocation } from "../../src/schemas/ConfigDiscoverySchemas.js";
import { ConfigDiscovery } from "../../src/services/ConfigDiscovery.js";

// ---------------------------------------------------------------------------
// Virtual FileSystem
// ---------------------------------------------------------------------------

// A real `FileSystem` over an in-memory volume, not a cast object shape: an
// unseeded path is genuinely absent rather than absent-by-omission, so a typo
// in a candidate path shows up as a failing assertion instead of a stub that
// happily answers `false` for a path the service never even asks about.
//
// `ConfigDiscovery` only ever calls `exists`, so the contents are arbitrary —
// `{}` just keeps the seeded files plausible as config files.
const makeTestFs = (existingPaths: ReadonlyArray<string>) =>
	MemoryFileSystem.layerWith(Object.fromEntries(existingPaths.map((path) => [path, "{}"])));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Per-test provide is REQUIRED here, not an unoptimised leftover: the virtual filesystem is
// built from the per-test `existingPaths`, so the layer genuinely varies test by test and
// cannot be hoisted into a suite-boundary `layer(...)` block. `layerWith` also mints a fresh
// reference per call, so each test gets its own volume rather than a memoized shared one.
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
	// Deliberately NOT a memory volume: this is fault injection, not arrangement.
	// A volume answers `exists` honestly (`false` for an absent path) and has no way
	// to make the call *fail*, so proving `safeExists`' `orElseSucceed` recovery needs
	// a stub. It must fail with a real `PlatformError` — the previous `new Error(...)`
	// was not one, so the test never exercised the channel its name claims.
	it.effect("treats PlatformError from fs.exists as not found", () =>
		Effect.gen(function* () {
			const cwd = "/repo";
			const errorFs = FileSystem.layerNoop({
				exists: () => Effect.fail(systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "exists" })),
			});
			const layer = ConfigDiscovery.layer.pipe(Layer.provide(errorFs));

			const result = yield* Effect.provide(
				ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))),
				layer,
			);

			expect(result).toBeNull();
		}),
	);
});
