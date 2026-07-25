import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { GitHubGraphQLTest } from "../../src/layers/GitHubGraphQLTest.js";
import { AutoMerge } from "../../src/utils/AutoMerge.js";

describe("AutoMerge", () => {
	it.effect("enables auto-merge with default SQUASH method", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubGraphQLTest.empty();
			state.mutationResponses.set("enableAutoMerge", { clientMutationId: null });

			yield* AutoMerge.enable("PR_node123").pipe(Effect.provide(layer));

			expect(state.mutationCalls).toHaveLength(1);
			expect(state.mutationCalls[0]?.operation).toBe("enableAutoMerge");
			expect(state.mutationCalls[0]?.variables?.mergeMethod).toBe("SQUASH");
		}),
	);

	it.effect("enables auto-merge with specified merge method", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubGraphQLTest.empty();
			state.mutationResponses.set("enableAutoMerge", { clientMutationId: null });

			yield* AutoMerge.enable("PR_node123", "REBASE").pipe(Effect.provide(layer));

			expect(state.mutationCalls[0]?.variables?.mergeMethod).toBe("REBASE");
		}),
	);

	it.effect("disables auto-merge", () =>
		Effect.gen(function* () {
			const { state, layer } = GitHubGraphQLTest.empty();
			state.mutationResponses.set("disableAutoMerge", { clientMutationId: null });

			yield* AutoMerge.disable("PR_node456").pipe(Effect.provide(layer));

			expect(state.mutationCalls).toHaveLength(1);
			expect(state.mutationCalls[0]?.operation).toBe("disableAutoMerge");
		}),
	);
});
