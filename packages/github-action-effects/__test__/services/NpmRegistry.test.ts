import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { NpmRegistryTest } from "../../src/layers/NpmRegistryTest.js";
import { NpmRegistry } from "../../src/services/NpmRegistry.js";

const testState = {
	packages: new Map([
		[
			"effect",
			{
				versions: ["3.0.0", "3.1.0", "3.2.0"],
				latest: "3.2.0",
				distTags: { latest: "3.2.0", next: "4.0.0-alpha.1" },
				integrity: "sha512-abc123",
				tarball: "https://registry.npmjs.org/effect/-/effect-3.2.0.tgz",
			},
		],
	]),
};

describe("NpmRegistry", () => {
	it.effect("getLatestVersion returns latest version", () =>
		Effect.gen(function* () {
			const layer = NpmRegistryTest.layer(testState);
			const result = yield* NpmRegistry.pipe(
				Effect.flatMap((reg) => reg.getLatestVersion("effect")),
				Effect.provide(layer),
			);
			expect(result).toBe("3.2.0");
		}),
	);

	it.effect("getDistTags returns all dist tags", () =>
		Effect.gen(function* () {
			const layer = NpmRegistryTest.layer(testState);
			const result = yield* NpmRegistry.pipe(
				Effect.flatMap((reg) => reg.getDistTags("effect")),
				Effect.provide(layer),
			);
			expect(result).toEqual({ latest: "3.2.0", next: "4.0.0-alpha.1" });
		}),
	);

	it.effect("getPackageInfo returns package metadata", () =>
		Effect.gen(function* () {
			const layer = NpmRegistryTest.layer(testState);
			const result = yield* NpmRegistry.pipe(
				Effect.flatMap((reg) => reg.getPackageInfo("effect")),
				Effect.provide(layer),
			);
			expect(result.name).toBe("effect");
			expect(result.version).toBe("3.2.0");
			expect(result.integrity).toBe("sha512-abc123");
		}),
	);

	it.effect("getVersions returns all versions", () =>
		Effect.gen(function* () {
			const layer = NpmRegistryTest.layer(testState);
			const result = yield* NpmRegistry.pipe(
				Effect.flatMap((reg) => reg.getVersions("effect")),
				Effect.provide(layer),
			);
			expect(result).toEqual(["3.0.0", "3.1.0", "3.2.0"]);
		}),
	);

	it.effect("fails for unknown package", () =>
		Effect.gen(function* () {
			const layer = NpmRegistryTest.empty();
			const exit = yield* Effect.exit(
				NpmRegistry.pipe(
					Effect.flatMap((reg) => reg.getLatestVersion("nonexistent")),
					Effect.provide(layer),
				),
			);
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("error includes package name", () =>
		Effect.gen(function* () {
			const layer = NpmRegistryTest.empty();
			const result = yield* NpmRegistry.pipe(
				Effect.flatMap((reg) => reg.getLatestVersion("missing-pkg")),
				Effect.catch((error) => Effect.succeed(error)),
				Effect.provide(layer),
			);
			expect(result).toHaveProperty("pkg", "missing-pkg");
		}),
	);
});
