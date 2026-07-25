import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { ChangesetAnalyzerTest } from "../../src/layers/ChangesetAnalyzerTest.js";
import type { Changeset } from "../../src/schemas/Changeset.js";
import { ChangesetAnalyzer } from "../../src/services/ChangesetAnalyzer.js";

const provide = <A, E>(
	state: ReturnType<typeof ChangesetAnalyzerTest.empty>,
	effect: Effect.Effect<A, E, ChangesetAnalyzer>,
) => Effect.provide(effect, ChangesetAnalyzerTest.layer(state));

const run = <A, E>(
	state: ReturnType<typeof ChangesetAnalyzerTest.empty>,
	effect: Effect.Effect<A, E, ChangesetAnalyzer>,
) => provide(state, effect);

const sampleChangeset: Changeset = {
	id: "brave-cloud-42",
	packages: [{ name: "@scope/pkg-a", bump: "minor" }],
	summary: "Add new feature",
};

describe("ChangesetAnalyzer", () => {
	describe("parseAll", () => {
		it.effect("returns changesets from state", () =>
			Effect.gen(function* () {
				const state = ChangesetAnalyzerTest.empty();
				state.changesets.push(sampleChangeset);

				const result = yield* run(
					state,
					Effect.flatMap(ChangesetAnalyzer, (svc) => svc.parseAll()),
				);
				expect(result).toHaveLength(1);
				expect(result[0]).toMatchObject({
					id: "brave-cloud-42",
					packages: [{ name: "@scope/pkg-a", bump: "minor" }],
					summary: "Add new feature",
				});
			}),
		);
	});

	describe("hasChangesets", () => {
		it.effect("returns true when changesets exist", () =>
			Effect.gen(function* () {
				const state = ChangesetAnalyzerTest.empty();
				state.changesets.push(sampleChangeset);

				const result = yield* run(
					state,
					Effect.flatMap(ChangesetAnalyzer, (svc) => svc.hasChangesets()),
				);
				expect(result).toBe(true);
			}),
		);

		it.effect("returns false when empty", () =>
			Effect.gen(function* () {
				const state = ChangesetAnalyzerTest.empty();
				const result = yield* run(
					state,
					Effect.flatMap(ChangesetAnalyzer, (svc) => svc.hasChangesets()),
				);
				expect(result).toBe(false);
			}),
		);
	});

	describe("generate", () => {
		it.effect("creates file with correct format", () =>
			Effect.gen(function* () {
				const state = ChangesetAnalyzerTest.empty();
				const result = yield* run(
					state,
					Effect.flatMap(ChangesetAnalyzer, (svc) =>
						svc.generate([{ name: "@scope/pkg-a", bump: "minor" }], "Add new feature"),
					),
				);

				expect(result.content).toContain('"@scope/pkg-a": minor');
				expect(result.content).toContain("Add new feature");
				expect(result.path).toMatch(/\.changeset\/.+\.md$/);
			}),
		);

		it.effect("records to state", () =>
			Effect.gen(function* () {
				const state = ChangesetAnalyzerTest.empty();
				yield* run(
					state,
					Effect.flatMap(ChangesetAnalyzer, (svc) =>
						svc.generate([{ name: "@scope/pkg-b", bump: "patch" }], "Fix bug"),
					),
				);

				expect(state.generated).toHaveLength(1);
				expect(state.generated[0].content).toContain('"@scope/pkg-b": patch');
			}),
		);
	});
});
