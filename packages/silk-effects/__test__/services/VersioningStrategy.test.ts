import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { ChangesetConfigFile } from "../../src/schemas/VersioningSchemas.js";
import { ChangesetConfigReader } from "../../src/services/ChangesetConfigReader.js";
import { VersioningStrategy, VersioningStrategyLive } from "../../src/services/VersioningStrategy.js";

// ---------------------------------------------------------------------------
// Mock ChangesetConfigReader
// ---------------------------------------------------------------------------

function makeConfigLayer(config: ChangesetConfigFile) {
	return Layer.succeed(ChangesetConfigReader, {
		read: (_root: string) => Effect.succeed(config),
	});
}

function makeLayer(config: ChangesetConfigFile) {
	return VersioningStrategyLive.pipe(Layer.provide(makeConfigLayer(config)));
}

// Per-test provide is REQUIRED here, not an unoptimised leftover: `makeLayer` bakes the
// per-test `config` into the mocked ChangesetConfigReader, so the layer genuinely varies
// test by test and cannot be hoisted into a suite-boundary `layer(...)` block.
function runWith<A, E>(
	config: ChangesetConfigFile,
	effect: Effect.Effect<A, E, VersioningStrategy>,
): Effect.Effect<A, E> {
	return Effect.provide(effect, makeLayer(config));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VersioningStrategy", () => {
	describe("single strategy", () => {
		it.effect("returns single for 0 publishable packages", () =>
			Effect.gen(function* () {
				const result = yield* runWith(
					{ fixed: [], baseBranch: "main" },
					VersioningStrategy.pipe(Effect.andThen((s) => s.detect([], "/project"))),
				);

				expect(result.type).toBe("single");
			}),
		);

		it.effect("returns single for 1 publishable package", () =>
			Effect.gen(function* () {
				const result = yield* runWith(
					{ fixed: [], baseBranch: "main" },
					VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a"], "/project"))),
				);

				expect(result.type).toBe("single");
				expect(result.publishablePackages).toEqual(["@scope/pkg-a"]);
			}),
		);
	});

	describe("fixed-group strategy", () => {
		it.effect("returns fixed-group when all publishable packages are in one fixed group", () =>
			Effect.gen(function* () {
				const result = yield* runWith(
					{
						fixed: [["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c"]],
						baseBranch: "main",
					},
					VersioningStrategy.pipe(
						Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c"], "/project")),
					),
				);

				expect(result.type).toBe("fixed-group");
			}),
		);

		it.effect("returns fixed-group when publishable packages are a subset of a fixed group", () =>
			Effect.gen(function* () {
				const result = yield* runWith(
					{
						fixed: [["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c", "@scope/pkg-d"]],
						baseBranch: "main",
					},
					VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b"], "/project"))),
				);

				expect(result.type).toBe("fixed-group");
			}),
		);
	});

	describe("independent strategy", () => {
		it.effect("returns independent when packages are not in any fixed group", () =>
			Effect.gen(function* () {
				const result = yield* runWith(
					{ fixed: [], baseBranch: "main" },
					VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b"], "/project"))),
				);

				expect(result.type).toBe("independent");
			}),
		);

		it.effect("returns independent when packages span multiple fixed groups", () =>
			Effect.gen(function* () {
				const result = yield* runWith(
					{
						fixed: [
							["@scope/pkg-a", "@scope/pkg-b"],
							["@scope/pkg-c", "@scope/pkg-d"],
						],
						baseBranch: "main",
					},
					VersioningStrategy.pipe(
						Effect.andThen((s) =>
							s.detect(["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c", "@scope/pkg-d"], "/project"),
						),
					),
				);

				expect(result.type).toBe("independent");
			}),
		);

		it.effect("returns independent when only some packages are in a fixed group", () =>
			Effect.gen(function* () {
				const result = yield* runWith(
					{
						fixed: [["@scope/pkg-a", "@scope/pkg-b"]],
						baseBranch: "main",
					},
					VersioningStrategy.pipe(
						Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c"], "/project")),
					),
				);

				expect(result.type).toBe("independent");
			}),
		);
	});

	describe("result shape", () => {
		it.effect("includes fixedGroups from config in the result", () =>
			Effect.gen(function* () {
				const fixedGroups = [["@scope/pkg-a", "@scope/pkg-b"]];
				const result = yield* runWith(
					{ fixed: fixedGroups, baseBranch: "main" },
					VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b"], "/project"))),
				);

				expect(result.fixedGroups).toEqual(fixedGroups);
			}),
		);

		it.effect("includes publishablePackages in the result", () =>
			Effect.gen(function* () {
				const packages = ["@scope/pkg-a", "@scope/pkg-b"];
				const result = yield* runWith(
					{ fixed: [], baseBranch: "main" },
					VersioningStrategy.pipe(Effect.andThen((s) => s.detect(packages, "/project"))),
				);

				expect(result.publishablePackages).toEqual(packages);
			}),
		);
	});
});
