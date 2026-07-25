import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { GitHubGraphQLTest } from "../../src/layers/GitHubGraphQLTest.js";
import { GitHubGraphQL } from "../../src/services/GitHubGraphQL.js";

describe("GitHubGraphQL", () => {
	describe("query", () => {
		it.effect("returns response for recorded query", () =>
			Effect.gen(function* () {
				const state = {
					queryResponses: new Map([["GetViewer", { viewer: { login: "test" } }]]),
					mutationResponses: new Map(),
					queryCalls: [] as Array<{
						operation: string;
						query: string;
						variables?: Record<string, unknown>;
					}>,
					mutationCalls: [] as Array<{
						operation: string;
						query: string;
						variables?: Record<string, unknown>;
					}>,
				};
				const layer = GitHubGraphQLTest.layer(state);
				const result = yield* GitHubGraphQL.pipe(
					Effect.flatMap((gql) => gql.query("GetViewer", "{ viewer { login } }")),
					Effect.provide(layer),
				);
				expect(result).toEqual({ viewer: { login: "test" } });
			}),
		);

		it.effect("fails for unrecorded query", () =>
			Effect.gen(function* () {
				const { layer } = GitHubGraphQLTest.empty();
				const exit = yield* Effect.exit(
					GitHubGraphQL.pipe(
						Effect.flatMap((gql) => gql.query("Unknown", "{ unknown }")),
						Effect.provide(layer),
					),
				);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);

		it.effect("records query calls", () =>
			Effect.gen(function* () {
				const { state, layer } = GitHubGraphQLTest.empty();
				yield* Effect.exit(
					GitHubGraphQL.pipe(
						Effect.flatMap((gql) =>
							gql.query("GetViewer", "{ viewer { login } }", {
								org: "test",
							}),
						),
						Effect.provide(layer),
					),
				);
				expect(state.queryCalls).toHaveLength(1);
				expect(state.queryCalls[0]).toEqual({
					operation: "GetViewer",
					query: "{ viewer { login } }",
					variables: { org: "test" },
				});
			}),
		);

		it.effect("passes variables through", () =>
			Effect.gen(function* () {
				const state = {
					queryResponses: new Map([["GetRepo", { repository: { name: "test" } }]]),
					mutationResponses: new Map(),
					queryCalls: [] as Array<{
						operation: string;
						query: string;
						variables?: Record<string, unknown>;
					}>,
					mutationCalls: [] as Array<{
						operation: string;
						query: string;
						variables?: Record<string, unknown>;
					}>,
				};
				const layer = GitHubGraphQLTest.layer(state);
				const result = yield* GitHubGraphQL.pipe(
					Effect.flatMap((gql) =>
						gql.query("GetRepo", "query($owner: String!) { repository(owner: $owner) { name } }", {
							owner: "test-owner",
						}),
					),
					Effect.provide(layer),
				);
				expect(result).toEqual({ repository: { name: "test" } });
				expect(state.queryCalls[0]?.variables).toEqual({
					owner: "test-owner",
				});
			}),
		);
	});

	describe("mutation", () => {
		it.effect("returns response for recorded mutation", () =>
			Effect.gen(function* () {
				const state = {
					queryResponses: new Map(),
					mutationResponses: new Map([["EnableAutoMerge", { enableAutoMerge: { id: "123" } }]]),
					queryCalls: [] as Array<{
						operation: string;
						query: string;
						variables?: Record<string, unknown>;
					}>,
					mutationCalls: [] as Array<{
						operation: string;
						query: string;
						variables?: Record<string, unknown>;
					}>,
				};
				const layer = GitHubGraphQLTest.layer(state);
				const result = yield* GitHubGraphQL.pipe(
					Effect.flatMap((gql) => gql.mutation("EnableAutoMerge", "mutation { enableAutoMerge { id } }")),
					Effect.provide(layer),
				);
				expect(result).toEqual({ enableAutoMerge: { id: "123" } });
			}),
		);

		it.effect("fails for unrecorded mutation", () =>
			Effect.gen(function* () {
				const { layer } = GitHubGraphQLTest.empty();
				const exit = yield* Effect.exit(
					GitHubGraphQL.pipe(
						Effect.flatMap((gql) => gql.mutation("Unknown", "mutation { unknown }")),
						Effect.provide(layer),
					),
				);
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);

		it.effect("records mutation calls", () =>
			Effect.gen(function* () {
				const { state, layer } = GitHubGraphQLTest.empty();
				yield* Effect.exit(
					GitHubGraphQL.pipe(
						Effect.flatMap((gql) =>
							gql.mutation("AddLabel", "mutation { addLabel }", {
								labelId: "abc",
							}),
						),
						Effect.provide(layer),
					),
				);
				expect(state.mutationCalls).toHaveLength(1);
				expect(state.mutationCalls[0]).toEqual({
					operation: "AddLabel",
					query: "mutation { addLabel }",
					variables: { labelId: "abc" },
				});
			}),
		);

		it.effect("error includes operation name", () =>
			Effect.gen(function* () {
				const { layer } = GitHubGraphQLTest.empty();
				const result = yield* GitHubGraphQL.pipe(
					Effect.flatMap((gql) => gql.mutation("CreateProject", "mutation { createProject }")),
					Effect.catch((error) => Effect.succeed(error)),
					Effect.provide(layer),
				);
				expect(result).toHaveProperty("operation", "CreateProject");
			}),
		);
	});
});
