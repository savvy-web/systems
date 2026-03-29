import { FileSystem } from "@effect/platform";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ConfigDiscovery, ConfigDiscoveryLive } from "../../src/config/ConfigDiscovery.js";
import type { ConfigLocation } from "../../src/config/schemas.js";

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

function runWith(existingPaths: ReadonlyArray<string>, effect: Effect.Effect<unknown, unknown, ConfigDiscovery>) {
	const testFs = makeTestFs(existingPaths);
	const layer = ConfigDiscoveryLive.pipe(Layer.provide(testFs));
	return Effect.runPromise(Effect.provide(effect, layer));
}

// ---------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------

describe("ConfigDiscovery.find", () => {
	it("finds config in lib/configs/ first when both exist", async () => {
		const cwd = "/repo";
		const result = (await runWith(
			[`${cwd}/lib/configs/biome.json`, `${cwd}/biome.json`],
			ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))),
		)) as ConfigLocation;

		expect(result).not.toBeNull();
		expect(result.source).toBe("lib");
		expect(result.path).toBe(`${cwd}/lib/configs/biome.json`);
	});

	it("falls back to repo root when lib/configs/ does not have it", async () => {
		const cwd = "/repo";
		const result = (await runWith(
			[`${cwd}/biome.json`],
			ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))),
		)) as ConfigLocation;

		expect(result).not.toBeNull();
		expect(result.source).toBe("root");
		expect(result.path).toBe(`${cwd}/biome.json`);
	});

	it("returns null when not found anywhere", async () => {
		const cwd = "/repo";
		const result = await runWith([], ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))));

		expect(result).toBeNull();
	});

	it("works with different cwd values", async () => {
		const cwd = "/other/workspace";
		const result = (await runWith(
			[`${cwd}/lib/configs/tsconfig.json`],
			ConfigDiscovery.pipe(Effect.andThen((s) => s.find("tsconfig.json", { cwd }))),
		)) as ConfigLocation;

		expect(result).not.toBeNull();
		expect(result.source).toBe("lib");
		expect(result.path).toBe(`${cwd}/lib/configs/tsconfig.json`);
	});
});

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe("ConfigDiscovery.findAll", () => {
	it("returns all matches with priority order (lib first, then root)", async () => {
		const cwd = "/repo";
		const results = (await runWith(
			[`${cwd}/lib/configs/biome.json`, `${cwd}/biome.json`],
			ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
		)) as ReadonlyArray<ConfigLocation>;

		expect(results).toHaveLength(2);
		expect(results[0].source).toBe("lib");
		expect(results[0].path).toBe(`${cwd}/lib/configs/biome.json`);
		expect(results[1].source).toBe("root");
		expect(results[1].path).toBe(`${cwd}/biome.json`);
	});

	it("returns only lib match when only lib/configs/ has it", async () => {
		const cwd = "/repo";
		const results = (await runWith(
			[`${cwd}/lib/configs/biome.json`],
			ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
		)) as ReadonlyArray<ConfigLocation>;

		expect(results).toHaveLength(1);
		expect(results[0].source).toBe("lib");
	});

	it("returns only root match when only root has it", async () => {
		const cwd = "/repo";
		const results = (await runWith(
			[`${cwd}/biome.json`],
			ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
		)) as ReadonlyArray<ConfigLocation>;

		expect(results).toHaveLength(1);
		expect(results[0].source).toBe("root");
	});

	it("returns empty array when nothing found", async () => {
		const cwd = "/repo";
		const results = (await runWith(
			[],
			ConfigDiscovery.pipe(Effect.andThen((s) => s.findAll("biome.json", { cwd }))),
		)) as ReadonlyArray<ConfigLocation>;

		expect(results).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// PlatformError resilience
// ---------------------------------------------------------------------------

describe("ConfigDiscovery error handling", () => {
	it("treats PlatformError from fs.exists as not found", async () => {
		const cwd = "/repo";
		// Mock that throws an error for exists
		const errorFs = Layer.succeed(FileSystem.FileSystem, {
			exists: (_path: string) => Effect.fail(new Error("permission denied")),
		} as unknown as FileSystem.FileSystem);
		const layer = ConfigDiscoveryLive.pipe(Layer.provide(errorFs));

		const result = await Effect.runPromise(
			Effect.provide(ConfigDiscovery.pipe(Effect.andThen((s) => s.find("biome.json", { cwd }))), layer),
		);

		expect(result).toBeNull();
	});
});
