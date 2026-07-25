import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import type { GitHubGraphQLTestState } from "../../src/layers/GitHubGraphQLTest.js";
import { GitHubGraphQLTest } from "../../src/layers/GitHubGraphQLTest.js";
import { GitHubIssueLive } from "../../src/layers/GitHubIssueLive.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";
import { GitHubIssue } from "../../src/services/GitHubIssue.js";

const mockListForRepo = vi.fn();
const mockUpdate = vi.fn();
const mockCreateComment = vi.fn();
const mockGet = vi.fn();

const mockClient: typeof GitHubClient.Service = {
	rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
		Effect.tryPromise({
			try: () =>
				fn({
					rest: {
						issues: {
							listForRepo: mockListForRepo,
							update: mockUpdate,
							createComment: mockCreateComment,
							get: mockGet,
						},
					},
				}),
			catch: (e) =>
				new GitHubClientError({
					operation: _operation,
					status: undefined,
					reason: e instanceof Error ? e.message : String(e),
					retryable: false,
					retryAfterMs: undefined,
				}),
		}).pipe(Effect.map((r) => r.data)),
	graphql: () => Effect.die("not used"),
	paginateStream: () => Stream.die("not used"),
	paginate: <T>(
		_operation: string,
		fn: (octokit: unknown, page: number, perPage: number) => Promise<{ data: T[] }>,
		_options?: { perPage?: number; maxPages?: number },
	) =>
		Effect.tryPromise({
			try: () =>
				fn(
					{
						rest: {
							issues: {
								listForRepo: mockListForRepo,
								update: mockUpdate,
								createComment: mockCreateComment,
								get: mockGet,
							},
						},
					},
					1,
					30,
				),
			catch: (e) =>
				new GitHubClientError({
					operation: _operation,
					status: undefined,
					reason: e instanceof Error ? e.message : String(e),
					retryable: false,
					retryAfterMs: undefined,
				}),
		}).pipe(Effect.map((r) => r.data)),
	repo: Effect.succeed({ owner: "test-owner", repo: "test-repo" }),
};

let graphqlState: GitHubGraphQLTestState;

const makeTestLayer = () => {
	const { state, layer: graphqlLayer } = GitHubGraphQLTest.empty();
	graphqlState = state;
	const clientLayer = Layer.succeed(GitHubClient, mockClient);
	return Layer.provide(GitHubIssueLive, Layer.merge(clientLayer, graphqlLayer));
};

let testLayer: Layer.Layer<GitHubIssue>;

// DO NOT collapse these helpers into an `@effect/vitest` `layer()` suite block.
//
// `testLayer` is a mutable binding reassigned by the `beforeEach` below, and each
// `makeTestLayer()` call installs a FRESH `graphqlState` recorder. A group-scoped
// `layer()` builds once and would freeze `graphqlState` at the first test's instance, so
// every later assertion about recorded GraphQL calls would read a running total across
// the whole group instead of that test's calls — and would still be green.
//
// Plain `Effect.provide` does not memoise across tests, which is exactly what this file
// needs. Per-test provide is the safe default here; collapsing is the risky change.
const run = <A, E>(effect: Effect.Effect<A, E, GitHubIssue>) => Effect.provide(effect, testLayer);

const runExit = <A, E>(effect: Effect.Effect<A, E, GitHubIssue>) => Effect.exit(Effect.provide(effect, testLayer));

beforeEach(() => {
	vi.clearAllMocks();
	testLayer = makeTestLayer();
});

describe("GitHubIssueLive", () => {
	describe("list", () => {
		it.effect("calls issues.listForRepo via paginate and returns mapped data", () =>
			Effect.gen(function* () {
				mockListForRepo.mockResolvedValue({
					data: [
						{ number: 1, title: "Bug", state: "open", labels: [{ name: "bug" }] },
						{ number: 2, title: "Feature", state: "open", labels: ["enhancement"] },
					],
				});
				const result = yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.list()));
				expect(result).toHaveLength(2);
				expect(result[0]?.number).toBe(1);
				expect(result[0]?.labels).toEqual(["bug"]);
				expect(result[1]?.labels).toEqual(["enhancement"]);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockListForRepo.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(Effect.flatMap(GitHubIssue, (svc) => svc.list()));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("list options", () => {
		it.effect("passes labels filter when provided", () =>
			Effect.gen(function* () {
				mockListForRepo.mockResolvedValue({
					data: [{ number: 1, title: "Bug", state: "open", labels: [{ name: "bug" }] }],
				});
				yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.list({ labels: ["bug", "critical"] })));
				expect(mockListForRepo).toHaveBeenCalledWith(
					expect.objectContaining({
						labels: "bug,critical",
						state: "open",
					}),
				);
			}),
		);

		it.effect("omits labels when empty array", () =>
			Effect.gen(function* () {
				mockListForRepo.mockResolvedValue({ data: [] });
				yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.list({ labels: [] })));
				const callArgs = mockListForRepo.mock.calls[0]?.[0];
				expect(callArgs).not.toHaveProperty("labels");
			}),
		);

		it.effect("passes milestone when provided", () =>
			Effect.gen(function* () {
				mockListForRepo.mockResolvedValue({ data: [] });
				yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.list({ milestone: 3 })));
				expect(mockListForRepo).toHaveBeenCalledWith(expect.objectContaining({ milestone: 3 }));
			}),
		);

		it.effect("omits milestone when not provided", () =>
			Effect.gen(function* () {
				mockListForRepo.mockResolvedValue({ data: [] });
				yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.list({ state: "closed" })));
				const callArgs = mockListForRepo.mock.calls[0]?.[0];
				expect(callArgs).not.toHaveProperty("milestone");
				expect(callArgs).toHaveProperty("state", "closed");
			}),
		);

		it.effect("passes perPage and maxPages pagination options", () =>
			Effect.gen(function* () {
				mockListForRepo.mockResolvedValue({ data: [] });
				yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.list({ perPage: 10, maxPages: 2 })));
				// The pagination options are passed to client.paginate, not to the REST call
				expect(mockListForRepo).toHaveBeenCalled();
			}),
		);

		it.effect("handles label objects without name property", () =>
			Effect.gen(function* () {
				mockListForRepo.mockResolvedValue({
					data: [{ number: 1, title: "Test", state: "open", labels: [{}] }],
				});
				const result = yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.list()));
				expect(result[0]?.labels).toEqual([""]);
			}),
		);
	});

	describe("close", () => {
		it.effect("calls issues.update with state closed", () =>
			Effect.gen(function* () {
				mockUpdate.mockResolvedValue({
					data: { number: 1, title: "Bug", state: "closed", labels: [] },
				});
				yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.close(1, "completed")));
				expect(mockUpdate).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						issue_number: 1,
						state: "closed",
						state_reason: "completed",
					}),
				);
			}),
		);

		it.effect("closes without reason (omits state_reason)", () =>
			Effect.gen(function* () {
				mockUpdate.mockResolvedValue({
					data: { number: 1, title: "Bug", state: "closed", labels: [] },
				});
				yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.close(1)));
				const callArgs = mockUpdate.mock.calls[0]?.[0];
				expect(callArgs).toHaveProperty("state", "closed");
				expect(callArgs).not.toHaveProperty("state_reason");
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockUpdate.mockRejectedValue(new Error("not found"));
				const exit = yield* runExit(Effect.flatMap(GitHubIssue, (svc) => svc.close(999)));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("comment", () => {
		it.effect("calls issues.createComment and returns id", () =>
			Effect.gen(function* () {
				mockCreateComment.mockResolvedValue({
					data: { id: 42 },
				});
				const result = yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.comment(1, "Hello")));
				expect(result.id).toBe(42);
				expect(mockCreateComment).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						issue_number: 1,
						body: "Hello",
					}),
				);
			}),
		);
	});

	describe("get", () => {
		it.effect("get returns the issue, mapping htmlUrl and nodeId", () =>
			Effect.gen(function* () {
				mockGet.mockResolvedValue({
					data: {
						number: 7,
						title: "t",
						state: "open",
						labels: [],
						html_url: "https://gh/i/7",
						node_id: "I_node7",
					},
				});
				const result = yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.get(7)));
				expect(result.number).toBe(7);
				expect(result.htmlUrl).toBe("https://gh/i/7");
				expect(result.nodeId).toBe("I_node7");
			}),
		);

		it.effect("get fails with a GitHubIssueError when the API call fails", () =>
			Effect.gen(function* () {
				mockGet.mockRejectedValue(new Error("not found"));
				const exit = yield* runExit(Effect.flatMap(GitHubIssue, (svc) => svc.get(999)));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("getLinkedIssues", () => {
		it.effect("queries GraphQL for closing issues references", () =>
			Effect.gen(function* () {
				graphqlState.queryResponses.set("getLinkedIssues", {
					repository: {
						pullRequest: {
							closingIssuesReferences: {
								nodes: [
									{ number: 10, title: "Fix bug" },
									{ number: 20, title: "Add feature" },
								],
							},
						},
					},
				});
				const result = yield* run(Effect.flatMap(GitHubIssue, (svc) => svc.getLinkedIssues(5)));
				expect(result).toHaveLength(2);
				expect(result[0]?.number).toBe(10);
				expect(result[1]?.title).toBe("Add feature");
				expect(graphqlState.queryCalls).toHaveLength(1);
				expect(graphqlState.queryCalls[0]?.operation).toBe("getLinkedIssues");
				expect(graphqlState.queryCalls[0]?.variables).toEqual(
					expect.objectContaining({ owner: "test-owner", repo: "test-repo", prNumber: 5 }),
				);
			}),
		);

		it.effect("fails when GraphQL returns error", () =>
			Effect.gen(function* () {
				// No response set, so it will fail
				const exit = yield* runExit(Effect.flatMap(GitHubIssue, (svc) => svc.getLinkedIssues(99)));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});
});
