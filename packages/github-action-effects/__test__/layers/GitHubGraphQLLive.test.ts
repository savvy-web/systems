import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import { GitHubGraphQLLive } from "../../src/layers/GitHubGraphQLLive.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";
import { GitHubGraphQL } from "../../src/services/GitHubGraphQL.js";

const makeMockGitHubClient = (
	graphqlFn: (query: string, variables?: Record<string, unknown>) => Effect.Effect<unknown, GitHubClientError>,
) =>
	Layer.succeed(GitHubClient, {
		rest: () => Effect.die("not used"),
		paginate: () => Effect.die("not used"),
		paginateStream: () => Stream.die("not used"),
		graphql: graphqlFn as (typeof GitHubClient.Service)["graphql"],
		repo: Effect.die("not used"),
	});

describe("GitHubGraphQLLive", () => {
	it.effect("delegates query to GitHubClient.graphql", () =>
		Effect.gen(function* () {
			const mockClient = makeMockGitHubClient(() => Effect.succeed({ viewer: { login: "test" } }));
			const layer = GitHubGraphQLLive.pipe(Layer.provide(mockClient));
			const result = yield* GitHubGraphQL.pipe(
				Effect.flatMap((gql) => gql.query("GetViewer", "{ viewer { login } }")),
				Effect.provide(layer),
			);
			expect(result).toEqual({ viewer: { login: "test" } });
		}),
	);

	it.effect("delegates mutation to GitHubClient.graphql", () =>
		Effect.gen(function* () {
			const mockClient = makeMockGitHubClient(() => Effect.succeed({ enableAutoMerge: { id: "1" } }));
			const layer = GitHubGraphQLLive.pipe(Layer.provide(mockClient));
			const result = yield* GitHubGraphQL.pipe(
				Effect.flatMap((gql) => gql.mutation("EnableAutoMerge", "mutation { enableAutoMerge { id } }")),
				Effect.provide(layer),
			);
			expect(result).toEqual({ enableAutoMerge: { id: "1" } });
		}),
	);

	it.effect("maps GitHubClientError to GitHubGraphQLError", () =>
		Effect.gen(function* () {
			const mockClient = makeMockGitHubClient(() =>
				Effect.fail(
					new GitHubClientError({
						operation: "graphql",
						status: 401,
						reason: "Bad credentials",
						retryable: false,
						retryAfterMs: undefined,
					}),
				),
			);
			const layer = GitHubGraphQLLive.pipe(Layer.provide(mockClient));
			const result = yield* GitHubGraphQL.pipe(
				Effect.flatMap((gql) => gql.query("GetViewer", "{ viewer { login } }")),
				Effect.catch((error) => Effect.succeed(error)),
				Effect.provide(layer),
			);
			expect(result).toHaveProperty("_tag", "GitHubGraphQLError");
			expect(result).toHaveProperty("operation", "GetViewer");
			expect(result).toHaveProperty("reason", "Bad credentials");
		}),
	);

	it.effect("maps GitHubClientError to GitHubGraphQLError on mutation failure", () =>
		Effect.gen(function* () {
			const mockClient = makeMockGitHubClient(() =>
				Effect.fail(
					new GitHubClientError({
						operation: "graphql",
						status: 403,
						reason: "Forbidden",
						retryable: false,
						retryAfterMs: undefined,
					}),
				),
			);
			const layer = GitHubGraphQLLive.pipe(Layer.provide(mockClient));
			const result = yield* GitHubGraphQL.pipe(
				Effect.flatMap((gql) => gql.mutation("EnableAutoMerge", "mutation { enableAutoMerge { id } }")),
				Effect.catch((error) => Effect.succeed(error)),
				Effect.provide(layer),
			);
			expect(result).toHaveProperty("_tag", "GitHubGraphQLError");
			expect(result).toHaveProperty("operation", "EnableAutoMerge");
			expect(result).toHaveProperty("reason", "Forbidden");
		}),
	);

	it.effect("extracts GraphQL errors from JSON error reason", () =>
		Effect.gen(function* () {
			const errorJson = JSON.stringify({
				errors: [{ message: "Field not found", type: "FIELD_ERROR" }],
			});
			const mockClient = makeMockGitHubClient(() =>
				Effect.fail(
					new GitHubClientError({
						operation: "graphql",
						status: 200,
						reason: errorJson,
						retryable: false,
						retryAfterMs: undefined,
					}),
				),
			);
			const layer = GitHubGraphQLLive.pipe(Layer.provide(mockClient));
			const result = yield* GitHubGraphQL.pipe(
				Effect.flatMap((gql) => gql.query("GetRepo", "{ repository { name } }")),
				Effect.catch((error) => Effect.succeed(error)),
				Effect.provide(layer),
			);
			expect(result).toHaveProperty("errors");
			const errors = (
				result as {
					errors: Array<{ message: string; type?: string }>;
				}
			).errors;
			expect(errors).toHaveLength(1);
			expect(errors[0]).toEqual({
				message: "Field not found",
				type: "FIELD_ERROR",
			});
		}),
	);
});
