import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import type { ChangesetConfig } from "../../src/schemas/VersioningSchemas.js";
import { ChangesetConfigReader } from "../../src/services/ChangesetConfigReader.js";
import { VersioningStrategy, VersioningStrategyLive } from "../../src/services/VersioningStrategy.js";

// ---------------------------------------------------------------------------
// Mock ChangesetConfigReader
// ---------------------------------------------------------------------------

function makeConfigLayer(config: ChangesetConfig) {
	return Layer.succeed(ChangesetConfigReader, {
		read: (_root: string) => Effect.succeed(config),
	});
}

function makeLayer(config: ChangesetConfig) {
	return VersioningStrategyLive.pipe(Layer.provide(makeConfigLayer(config)));
}

function runWith<A, E>(config: ChangesetConfig, effect: Effect.Effect<A, E, VersioningStrategy>): Promise<A> {
	return Effect.runPromise(Effect.provide(effect, makeLayer(config)));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VersioningStrategy", () => {
	describe("single strategy", () => {
		it("returns single for 0 publishable packages", async () => {
			const result = await runWith(
				{ fixed: [], baseBranch: "main" },
				VersioningStrategy.pipe(Effect.andThen((s) => s.detect([], "/project"))),
			);

			expect(result.type).toBe("single");
		});

		it("returns single for 1 publishable package", async () => {
			const result = await runWith(
				{ fixed: [], baseBranch: "main" },
				VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a"], "/project"))),
			);

			expect(result.type).toBe("single");
			expect(result.publishablePackages).toEqual(["@scope/pkg-a"]);
		});
	});

	describe("fixed-group strategy", () => {
		it("returns fixed-group when all publishable packages are in one fixed group", async () => {
			const result = await runWith(
				{
					fixed: [["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c"]],
					baseBranch: "main",
				},
				VersioningStrategy.pipe(
					Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c"], "/project")),
				),
			);

			expect(result.type).toBe("fixed-group");
		});

		it("returns fixed-group when publishable packages are a subset of a fixed group", async () => {
			const result = await runWith(
				{
					fixed: [["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c", "@scope/pkg-d"]],
					baseBranch: "main",
				},
				VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b"], "/project"))),
			);

			expect(result.type).toBe("fixed-group");
		});
	});

	describe("independent strategy", () => {
		it("returns independent when packages are not in any fixed group", async () => {
			const result = await runWith(
				{ fixed: [], baseBranch: "main" },
				VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b"], "/project"))),
			);

			expect(result.type).toBe("independent");
		});

		it("returns independent when packages span multiple fixed groups", async () => {
			const result = await runWith(
				{
					fixed: [
						["@scope/pkg-a", "@scope/pkg-b"],
						["@scope/pkg-c", "@scope/pkg-d"],
					],
					baseBranch: "main",
				},
				VersioningStrategy.pipe(
					Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c", "@scope/pkg-d"], "/project")),
				),
			);

			expect(result.type).toBe("independent");
		});

		it("returns independent when only some packages are in a fixed group", async () => {
			const result = await runWith(
				{
					fixed: [["@scope/pkg-a", "@scope/pkg-b"]],
					baseBranch: "main",
				},
				VersioningStrategy.pipe(
					Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c"], "/project")),
				),
			);

			expect(result.type).toBe("independent");
		});
	});

	describe("result shape", () => {
		it("includes fixedGroups from config in the result", async () => {
			const fixedGroups = [["@scope/pkg-a", "@scope/pkg-b"]];
			const result = await runWith(
				{ fixed: fixedGroups, baseBranch: "main" },
				VersioningStrategy.pipe(Effect.andThen((s) => s.detect(["@scope/pkg-a", "@scope/pkg-b"], "/project"))),
			);

			expect(result.fixedGroups).toEqual(fixedGroups);
		});

		it("includes publishablePackages in the result", async () => {
			const packages = ["@scope/pkg-a", "@scope/pkg-b"];
			const result = await runWith(
				{ fixed: [], baseBranch: "main" },
				VersioningStrategy.pipe(Effect.andThen((s) => s.detect(packages, "/project"))),
			);

			expect(result.publishablePackages).toEqual(packages);
		});
	});
});
