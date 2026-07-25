import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { PackageManagerAdapterTest } from "../../src/layers/PackageManagerAdapterTest.js";
import { PackageManagerAdapter } from "../../src/services/PackageManagerAdapter.js";

const provide = <A, E>(
	state: ReturnType<typeof PackageManagerAdapterTest.empty>,
	effect: Effect.Effect<A, E, PackageManagerAdapter>,
) => Effect.provide(effect, PackageManagerAdapterTest.layer(state));

const run = <A, E>(
	state: ReturnType<typeof PackageManagerAdapterTest.empty>,
	effect: Effect.Effect<A, E, PackageManagerAdapter>,
) => provide(state, effect);

describe("PackageManagerAdapter", () => {
	describe("detect", () => {
		it.effect("returns configured info", () =>
			Effect.gen(function* () {
				const state = PackageManagerAdapterTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result).toEqual({ name: "pnpm", version: "9.0.0", lockfile: "pnpm-lock.yaml" });
			}),
		);

		it.effect("returns custom info when configured", () =>
			Effect.gen(function* () {
				const state: ReturnType<typeof PackageManagerAdapterTest.empty> = {
					info: { name: "yarn", version: "4.0.0", lockfile: "yarn.lock" },
					execCalls: [],
					cachePaths: ["/mock/yarn-cache"],
				};

				const result = yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("yarn");
				expect(result.version).toBe("4.0.0");
			}),
		);
	});

	describe("install", () => {
		it.effect("completes without error", () =>
			Effect.gen(function* () {
				const state = PackageManagerAdapterTest.empty();

				yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install()),
				);
			}),
		);
	});

	describe("getCachePaths", () => {
		it.effect("returns configured paths", () =>
			Effect.gen(function* () {
				const state = PackageManagerAdapterTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(result).toEqual(["/mock/cache"]);
			}),
		);
	});

	describe("getLockfilePaths", () => {
		it.effect("returns correct lockfiles for pnpm", () =>
			Effect.gen(function* () {
				const state = PackageManagerAdapterTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["pnpm-lock.yaml"]);
			}),
		);

		it.effect("returns correct lockfiles for npm", () =>
			Effect.gen(function* () {
				const state: ReturnType<typeof PackageManagerAdapterTest.empty> = {
					info: { name: "npm", version: "10.0.0", lockfile: "package-lock.json" },
					execCalls: [],
					cachePaths: [],
				};

				const result = yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["package-lock.json"]);
			}),
		);

		it.effect("returns correct lockfiles for bun", () =>
			Effect.gen(function* () {
				const state: ReturnType<typeof PackageManagerAdapterTest.empty> = {
					info: { name: "bun", version: "1.0.0", lockfile: "bun.lockb" },
					execCalls: [],
					cachePaths: [],
				};

				const result = yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["bun.lockb", "bun.lock"]);
			}),
		);
	});

	describe("exec", () => {
		it.effect("records the call and returns output", () =>
			Effect.gen(function* () {
				const state = PackageManagerAdapterTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.exec(["run", "build"])),
				);
				expect(result.exitCode).toBe(0);
				expect(state.execCalls).toHaveLength(1);
				expect(state.execCalls[0].args).toEqual(["run", "build"]);
			}),
		);

		it.effect("records options when provided", () =>
			Effect.gen(function* () {
				const state = PackageManagerAdapterTest.empty();

				yield* run(
					state,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.exec(["test"], { cwd: "/app" })),
				);
				expect(state.execCalls[0].options).toEqual({ cwd: "/app" });
			}),
		);
	});
});
