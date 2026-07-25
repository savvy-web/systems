import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Option, Stream } from "effect";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import { PullRequestCommentLive } from "../../src/layers/PullRequestCommentLive.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";
import { PullRequestComment } from "../../src/services/PullRequestComment.js";

const mockRestFn = vi.fn();

const mockClient: typeof GitHubClient.Service = {
	rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
		Effect.tryPromise({
			try: () => fn({ rest: { issues: mockRestFn() } }),
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
	paginate: () => Effect.die("not used"),
	paginateStream: () => Stream.die("not used"),
	repo: Effect.succeed({ owner: "test-owner", repo: "test-repo" }),
};

const testLayer = Layer.provide(PullRequestCommentLive, Layer.succeed(GitHubClient, mockClient));

const run = <A, E>(effect: Effect.Effect<A, E, PullRequestComment>) => Effect.provide(effect, testLayer);

const runExit = <A, E>(effect: Effect.Effect<A, E, PullRequestComment>) =>
	Effect.exit(Effect.provide(effect, testLayer));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("PullRequestCommentLive", () => {
	describe("create", () => {
		it.effect("creates a comment and returns id", () =>
			Effect.gen(function* () {
				mockRestFn.mockReturnValue({
					createComment: vi.fn().mockResolvedValue({ data: { id: 42 } }),
				});
				const result = yield* run(Effect.flatMap(PullRequestComment, (svc) => svc.create(1, "hello")));
				expect(result).toBe(42);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockRestFn.mockReturnValue({
					createComment: vi.fn().mockRejectedValue(new Error("api error")),
				});
				const exit = yield* runExit(Effect.flatMap(PullRequestComment, (svc) => svc.create(1, "hello")));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("upsert", () => {
		it.effect("creates new comment when no existing match", () =>
			Effect.gen(function* () {
				const issuesMock = {
					listComments: vi.fn().mockResolvedValue({ data: [] }),
					createComment: vi.fn().mockResolvedValue({ data: { id: 99 } }),
				};
				mockRestFn.mockReturnValue(issuesMock);
				const result = yield* run(Effect.flatMap(PullRequestComment, (svc) => svc.upsert(1, "test-key", "body")));
				expect(result).toBe(99);
			}),
		);

		it.effect("updates existing comment when marker found", () =>
			Effect.gen(function* () {
				const issuesMock = {
					listComments: vi.fn().mockResolvedValue({
						data: [{ id: 50, body: "<!-- savvy-web:test-key -->\nold body" }],
					}),
					updateComment: vi.fn().mockResolvedValue({ data: { id: 50 } }),
				};
				mockRestFn.mockReturnValue(issuesMock);
				const result = yield* run(Effect.flatMap(PullRequestComment, (svc) => svc.upsert(1, "test-key", "new body")));
				expect(result).toBe(50);
			}),
		);
	});

	describe("find", () => {
		it.effect("returns Some when comment found", () =>
			Effect.gen(function* () {
				mockRestFn.mockReturnValue({
					listComments: vi.fn().mockResolvedValue({
						data: [{ id: 10, body: "<!-- savvy-web:find-key -->\ncontent" }],
					}),
				});
				const result = yield* run(Effect.flatMap(PullRequestComment, (svc) => svc.find(1, "find-key")));
				expect(Option.isSome(result)).toBe(true);
			}),
		);

		it.effect("returns None when no match", () =>
			Effect.gen(function* () {
				mockRestFn.mockReturnValue({
					listComments: vi.fn().mockResolvedValue({ data: [] }),
				});
				const result = yield* run(Effect.flatMap(PullRequestComment, (svc) => svc.find(1, "missing")));
				expect(Option.isNone(result)).toBe(true);
			}),
		);
	});

	describe("delete", () => {
		it.effect("deletes a comment", () =>
			Effect.gen(function* () {
				mockRestFn.mockReturnValue({
					deleteComment: vi.fn().mockResolvedValue({ data: {} }),
				});
				yield* run(Effect.flatMap(PullRequestComment, (svc) => svc.delete(1, 42)));
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockRestFn.mockReturnValue({
					deleteComment: vi.fn().mockRejectedValue(new Error("delete failed")),
				});
				const exit = yield* runExit(Effect.flatMap(PullRequestComment, (svc) => svc.delete(1, 42)));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});
});
