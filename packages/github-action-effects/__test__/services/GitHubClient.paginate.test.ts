import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { GitHubClientTest } from "../../src/layers/GitHubClientTest.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";

const makeLayer = (paginateResponses: Map<string, Array<unknown[]>>) =>
	GitHubClientTest.layer({
		restResponses: new Map(),
		graphqlResponses: new Map(),
		paginateResponses,
		repo: { owner: "test-owner", repo: "test-repo" },
	});

describe("GitHubClient.paginate", () => {
	it.effect("paginates until empty page", () =>
		Effect.gen(function* () {
			const layer = makeLayer(new Map([["listRepos", [[{ id: 1 }, { id: 2 }], [{ id: 3 }]]]]));
			const result = yield* GitHubClient.pipe(
				Effect.flatMap((client) => client.paginate("listRepos", async () => ({ data: [] }))),
				Effect.provide(layer),
			);
			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		}),
	);

	it.effect("returns empty array for zero results", () =>
		Effect.gen(function* () {
			const layer = makeLayer(new Map([["empty", [[]]]]));
			const result = yield* GitHubClient.pipe(
				Effect.flatMap((client) => client.paginate("empty", async () => ({ data: [] }))),
				Effect.provide(layer),
			);
			expect(result).toEqual([]);
		}),
	);

	it.effect("concatenates multiple pages correctly", () =>
		Effect.gen(function* () {
			const layer = makeLayer(
				new Map([
					[
						"items",
						[
							[1, 2, 3],
							[4, 5, 6],
							[7, 8],
						],
					],
				]),
			);
			const result = yield* GitHubClient.pipe(
				Effect.flatMap((client) => client.paginate("items", async () => ({ data: [] }))),
				Effect.provide(layer),
			);
			expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		}),
	);

	it.effect("handles single-page result", () =>
		Effect.gen(function* () {
			const layer = makeLayer(new Map([["single", [[{ name: "only-item" }]]]]));
			const result = yield* GitHubClient.pipe(
				Effect.flatMap((client) => client.paginate("single", async () => ({ data: [] }))),
				Effect.provide(layer),
			);
			expect(result).toEqual([{ name: "only-item" }]);
		}),
	);

	it.effect("fails when no paginate responses recorded", () =>
		Effect.gen(function* () {
			const layer = GitHubClientTest.empty();
			const exit = yield* Effect.exit(
				GitHubClient.pipe(
					Effect.flatMap((client) => client.paginate("unknown", async () => ({ data: [] }))),
					Effect.provide(layer),
				),
			);
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("reports errors with operation context", () =>
		Effect.gen(function* () {
			const layer = GitHubClientTest.empty();
			const result = yield* GitHubClient.pipe(
				Effect.flatMap((client) => client.paginate("listPRs", async () => ({ data: [] }))),
				Effect.catch((error) => Effect.succeed(error)),
				Effect.provide(layer),
			);
			expect(result).toHaveProperty("operation", "listPRs");
			expect(result).toHaveProperty("reason");
			expect((result as { reason: string }).reason).toContain("listPRs");
		}),
	);
});
