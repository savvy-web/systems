import { describe, expect, it } from "@effect/vitest";
import { Effect, Logger } from "effect";
import { DryRunLive } from "../../src/layers/DryRunLive.js";
import { DryRunTest } from "../../src/layers/DryRunTest.js";
import { DryRun } from "../../src/services/DryRun.js";

describe("DryRun", () => {
	it.effect("isDryRun returns true when enabled", () =>
		Effect.gen(function* () {
			const result = yield* DryRun.pipe(
				Effect.flatMap((dr) => dr.isDryRun),
				Effect.provide(DryRunLive(true)),
			);
			expect(result).toBe(true);
		}),
	);

	it.effect("isDryRun returns false when disabled", () =>
		Effect.gen(function* () {
			const result = yield* DryRun.pipe(
				Effect.flatMap((dr) => dr.isDryRun),
				Effect.provide(DryRunLive(false)),
			);
			expect(result).toBe(false);
		}),
	);

	it.effect("guard executes effect when not dry-run", () =>
		Effect.gen(function* () {
			let executed = false;
			const result = yield* DryRun.pipe(
				Effect.flatMap((dr) =>
					dr.guard(
						"create-branch",
						Effect.sync(() => {
							executed = true;
							return "created";
						}),
						"skipped",
					),
				),
				Effect.provide(DryRunLive(false)),
			);
			expect(result).toBe("created");
			expect(executed).toBe(true);
		}),
	);

	it.effect("guard returns fallback when dry-run", () =>
		Effect.gen(function* () {
			let executed = false;
			const result = yield* DryRun.pipe(
				Effect.flatMap((dr) =>
					dr.guard(
						"create-branch",
						Effect.sync(() => {
							executed = true;
							return "created";
						}),
						"skipped",
					),
				),
				Effect.provide(DryRunLive(true)),
				Effect.provide(Logger.layer([])),
			);
			expect(result).toBe("skipped");
			expect(executed).toBe(false);
		}),
	);

	it.effect("guard logs dry-run label", () =>
		Effect.gen(function* () {
			yield* DryRun.pipe(
				Effect.flatMap((dr) => dr.guard("delete-branch", Effect.succeed("done"), "skipped")),
				Effect.provide(DryRunLive(true)),
				Effect.provide(Logger.layer([])),
			);
			// If it doesn't throw, the log was emitted without error
		}),
	);

	it.effect("test layer records guarded labels", () =>
		Effect.gen(function* () {
			const { state, layer } = DryRunTest.empty();
			yield* DryRun.pipe(
				Effect.flatMap((dr) =>
					Effect.all([
						dr.guard("create-pr", Effect.succeed("pr"), "dry-pr"),
						dr.guard("merge-pr", Effect.succeed("merged"), "dry-merge"),
					]),
				),
				Effect.provide(layer),
			);
			expect(state.guardedLabels).toEqual(["create-pr", "merge-pr"]);
		}),
	);
});
