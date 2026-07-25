import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import type { GitHubClientTestState } from "../../src/layers/GitHubClientTest.js";
import { GitHubClientTest } from "../../src/layers/GitHubClientTest.js";
import type { GitHubClient as GitHubClientService, GitHubOctokit } from "../../src/services/GitHubClient.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";

// -- Shared provide helper --

const provide = <A, E>(state: GitHubClientTestState, effect: Effect.Effect<A, E, GitHubClientService>) =>
	Effect.provide(effect, GitHubClientTest.layer(state));

const provideEmpty = <A, E>(effect: Effect.Effect<A, E, GitHubClientService>) =>
	Effect.provide(effect, GitHubClientTest.empty());

const run = <A, E>(state: GitHubClientTestState, effect: Effect.Effect<A, E, GitHubClientService>) =>
	provide(state, effect);

const runEmpty = <A, E>(effect: Effect.Effect<A, E, GitHubClientService>) => provideEmpty(effect);

const runExitEmpty = <A, E>(effect: Effect.Effect<A, E, GitHubClientService>) => Effect.exit(provideEmpty(effect));

// -- Service method shorthands --

const rest = <T>(operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
	Effect.flatMap(GitHubClient, (svc) => svc.rest(operation, fn));

const graphql = <T>(query: string, variables?: Record<string, unknown>) =>
	Effect.flatMap(GitHubClient, (svc) => svc.graphql<T>(query, variables));

const repo = Effect.flatMap(GitHubClient, (svc) => svc.repo);

describe("GitHubClient", () => {
	describe("rest", () => {
		it.effect("returns data from recorded response", () =>
			Effect.gen(function* () {
				const state: GitHubClientTestState = {
					restResponses: new Map([["repos.get", { data: { full_name: "owner/repo" } }]]),
					graphqlResponses: new Map(),
					paginateResponses: new Map(),
					repo: { owner: "test-owner", repo: "test-repo" },
				};

				const result = yield* run(
					state,
					rest("repos.get", async () => ({ data: { full_name: "ignored" } })),
				);
				expect(result).toEqual({ full_name: "owner/repo" });
			}),
		);

		it.effect("fails on unrecorded operation", () =>
			Effect.gen(function* () {
				const exit = yield* runExitEmpty(rest("repos.get", async () => ({ data: {} })));
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					const error = exit.cause;
					expect(String(error)).toContain("GitHubClientError");
				}
			}),
		);

		// Regression contract for issue #361: the callback parameter must accept
		// a `GitHubOctokit` annotation (previously rejected by the `unknown`
		// typing's contravariance) while `unknown`-annotated legacy callbacks
		// keep compiling. The annotations below ARE the assertion — this file
		// failing types:check is the regression signal.
		it.effect("accepts a GitHubOctokit-annotated callback (#361)", () =>
			Effect.gen(function* () {
				const state: GitHubClientTestState = {
					restResponses: new Map([["repos.get", { data: { default_branch: "main" } }]]),
					graphqlResponses: new Map(),
					paginateResponses: new Map(),
					repo: { owner: "test-owner", repo: "test-repo" },
				};

				const result = yield* run(
					state,
					Effect.flatMap(GitHubClient, (svc) =>
						svc.rest("repos.get", (octokit: GitHubOctokit) =>
							octokit.rest.repos.get({ owner: "test-owner", repo: "test-repo" }).then((r) => ({
								data: { default_branch: r.data.default_branch },
							})),
						),
					),
				);
				expect(result).toEqual({ default_branch: "main" });
			}),
		);

		it.effect("still accepts an unknown-annotated callback", () =>
			Effect.gen(function* () {
				const state: GitHubClientTestState = {
					restResponses: new Map([["repos.get", { data: { full_name: "owner/repo" } }]]),
					graphqlResponses: new Map(),
					paginateResponses: new Map(),
					repo: { owner: "test-owner", repo: "test-repo" },
				};

				const result = yield* run(
					state,
					Effect.flatMap(GitHubClient, (svc) =>
						svc.rest("repos.get", async (_octokit: unknown) => ({ data: { full_name: "ignored" } })),
					),
				);
				expect(result).toEqual({ full_name: "owner/repo" });
			}),
		);
	});

	describe("graphql", () => {
		it.effect("returns data from recorded response", () =>
			Effect.gen(function* () {
				const query = "query { viewer { login } }";
				const state: GitHubClientTestState = {
					restResponses: new Map(),
					graphqlResponses: new Map([[query, { viewer: { login: "test-user" } }]]),
					paginateResponses: new Map(),
					repo: { owner: "test-owner", repo: "test-repo" },
				};

				const result = yield* run(state, graphql<{ viewer: { login: string } }>(query));
				expect(result).toEqual({ viewer: { login: "test-user" } });
			}),
		);

		it.effect("fails on unrecorded query", () =>
			Effect.gen(function* () {
				const exit = yield* runExitEmpty(graphql("query { viewer { login } }"));
				expect(Exit.isFailure(exit)).toBe(true);
			}),
		);
	});

	describe("repo", () => {
		it.effect("returns owner and repo from test state", () =>
			Effect.gen(function* () {
				const state: GitHubClientTestState = {
					restResponses: new Map(),
					graphqlResponses: new Map(),
					paginateResponses: new Map(),
					repo: { owner: "my-org", repo: "my-repo" },
				};

				const result = yield* run(state, repo);
				expect(result).toEqual({ owner: "my-org", repo: "my-repo" });
			}),
		);

		it.effect("returns defaults from empty()", () =>
			Effect.gen(function* () {
				const result = yield* runEmpty(repo);
				expect(result).toEqual({ owner: "test-owner", repo: "test-repo" });
			}),
		);
	});

	describe("GitHubClientError", () => {
		it("is a tagged error with correct fields", () => {
			const error = new GitHubClientError({
				operation: "repos.get",
				status: 404,
				reason: "Not Found",
				retryable: false,
				retryAfterMs: undefined,
			});
			expect(error._tag).toBe("GitHubClientError");
			expect(error.operation).toBe("repos.get");
			expect(error.status).toBe(404);
			expect(error.reason).toBe("Not Found");
			expect(error.retryable).toBe(false);
		});

		it("has retryable flag for rate limits", () => {
			const error = new GitHubClientError({
				operation: "repos.list",
				status: 429,
				reason: "Rate limit exceeded",
				retryable: true,
				retryAfterMs: undefined,
			});
			expect(error.retryable).toBe(true);
		});

		it("carries an optional retryAfterMs hint", () => {
			const error = new GitHubClientError({
				operation: "repos.list",
				status: 429,
				reason: "Secondary rate limit",
				retryable: true,
				retryAfterMs: 5000,
			});
			expect(error.retryAfterMs).toBe(5000);
		});

		it("supports undefined status", () => {
			const error = new GitHubClientError({
				operation: "graphql",
				status: undefined,
				reason: "Network error",
				retryable: false,
				retryAfterMs: undefined,
			});
			expect(error.status).toBeUndefined();
		});
	});
});
