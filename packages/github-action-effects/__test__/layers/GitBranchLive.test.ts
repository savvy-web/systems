import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Cause, Duration, Effect, Exit, Fiber, Layer, Stream } from "effect";
import { TestClock } from "effect/testing";
import type { GitBranchError } from "../../src/errors/GitBranchError.js";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import { GitBranchLive } from "../../src/layers/GitBranchLive.js";
import { GitBranch } from "../../src/services/GitBranch.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";

const mockCreateRef = vi.fn();
const mockGetRef = vi.fn();
const mockDeleteRef = vi.fn();
const mockUpdateRef = vi.fn();

const mockClient: typeof GitHubClient.Service = {
	rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
		Effect.tryPromise({
			try: () =>
				fn({
					rest: {
						git: {
							createRef: mockCreateRef,
							getRef: mockGetRef,
							deleteRef: mockDeleteRef,
							updateRef: mockUpdateRef,
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
	paginate: () => Effect.die("not used"),
	paginateStream: () => Stream.die("not used"),
	repo: Effect.succeed({ owner: "test-owner", repo: "test-repo" }),
};

const makeMockClient = (): typeof GitHubClient.Service => ({
	rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
		Effect.tryPromise({
			try: () =>
				fn({
					rest: {
						git: {
							createRef: mockCreateRef,
							getRef: mockGetRef,
							deleteRef: mockDeleteRef,
							updateRef: mockUpdateRef,
						},
					},
				}),
			catch: (e) => {
				const status =
					typeof e === "object" && e !== null && "status" in e ? (e as { status: number }).status : undefined;
				let message = e instanceof Error ? e.message : String(e);
				if (message.includes("<!DOCTYPE") || message.includes("<html")) {
					message =
						status !== undefined
							? `GitHub API returned ${status} (server error)`
							: "GitHub API returned an HTML error page";
				}
				return new GitHubClientError({
					operation: _operation,
					status,
					reason: message,
					retryable: status !== undefined && (status === 429 || status >= 500),
					retryAfterMs: undefined,
				});
			},
		}).pipe(Effect.map((r) => r.data)),
	graphql: () => Effect.die("not used"),
	paginate: () => Effect.die("not used"),
	paginateStream: () => Stream.die("not used"),
	repo: Effect.succeed({ owner: "test-owner", repo: "test-repo" }),
});

const testLayer = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, mockClient));

const run = <A, E>(effect: Effect.Effect<A, E, GitBranch>) => Effect.provide(effect, testLayer);

const runExit = <A, E>(effect: Effect.Effect<A, E, GitBranch>) => Effect.exit(Effect.provide(effect, testLayer));

/** Run an effect that uses retries with TestClock so delays are instant. */
const runWithTestClock = <A, E>(
	effect: Effect.Effect<A, E, GitBranch>,
	retryLayer: Layer.Layer<GitBranch, never, never>,
): Effect.Effect<Exit.Exit<A, E>> =>
	Effect.gen(function* () {
		const fiber = yield* Effect.forkChild(Effect.provide(effect, retryLayer));
		// Advance clock enough to cover all retry delays (1s + 2s + 4s = 7s)
		yield* TestClock.adjust(Duration.seconds(10));
		return yield* Fiber.join(fiber);
	}).pipe(Effect.exit);

beforeEach(() => {
	vi.clearAllMocks();
});

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("GitBranchLive", () => {
	describe("create", () => {
		it.effect("calls git.createRef with correct args", () =>
			Effect.gen(function* () {
				mockCreateRef.mockResolvedValue({ data: {} });
				yield* run(Effect.flatMap(GitBranch, (svc) => svc.create("feature/new", "abc123")));
				expect(mockCreateRef).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						ref: "refs/heads/feature/new",
						sha: "abc123",
					}),
				);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockCreateRef.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(Effect.flatMap(GitBranch, (svc) => svc.create("branch", "sha")));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("already-exists discriminant", () => {
		const runCreateExit = (branch: string, sha: string) => {
			const layer = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, makeMockClient()));
			return Effect.exit(
				Effect.provide(
					Effect.flatMap(GitBranch, (svc) => svc.create(branch, sha)),
					layer,
				),
			);
		};

		const squashed = (exit: Exit.Exit<void, unknown>): GitBranchError => {
			expect(Exit.isFailure(exit)).toBe(true);
			if (!Exit.isFailure(exit)) {
				throw new Error("expected failure exit");
			}
			return Cause.squash(exit.cause) as GitBranchError;
		};

		it.effect("sets alreadyExists and status on a 422 Reference already exists create failure", () =>
			Effect.gen(function* () {
				mockCreateRef.mockRejectedValue(Object.assign(new Error("Reference already exists"), { status: 422 }));
				const error = squashed(yield* runCreateExit("racy-branch", "sha123"));
				expect(error._tag).toBe("GitBranchError");
				expect(error.branch).toBe("racy-branch");
				expect(error.operation).toBe("create");
				expect(error.status).toBe(422);
				expect(error.alreadyExists).toBe(true);
			}),
		);

		it.effect("sets alreadyExists on a 409 already-exists create failure", () =>
			Effect.gen(function* () {
				mockCreateRef.mockRejectedValue(Object.assign(new Error("Reference already exists"), { status: 409 }));
				const error = squashed(yield* runCreateExit("racy-branch", "sha123"));
				expect(error.status).toBe(409);
				expect(error.alreadyExists).toBe(true);
			}),
		);

		it.effect("does not set alreadyExists for a 422 with an unrelated message", () =>
			Effect.gen(function* () {
				mockCreateRef.mockRejectedValue(Object.assign(new Error("Reference cannot be updated"), { status: 422 }));
				const error = squashed(yield* runCreateExit("branch", "sha123"));
				expect(error.status).toBe(422);
				expect(error.alreadyExists).toBe(false);
			}),
		);

		it.effect("does not set alreadyExists for a non-422/409 failure, but carries the status", () =>
			Effect.gen(function* () {
				mockCreateRef.mockRejectedValue(Object.assign(new Error("Reference already exists"), { status: 403 }));
				const error = squashed(yield* runCreateExit("branch", "sha123"));
				expect(error.status).toBe(403);
				expect(error.alreadyExists).toBe(false);
			}),
		);
	});

	describe("exists", () => {
		it.effect("returns true when ref exists", () =>
			Effect.gen(function* () {
				mockGetRef.mockResolvedValue({ data: { object: { sha: "abc" } } });
				const result = yield* run(Effect.flatMap(GitBranch, (svc) => svc.exists("main")));
				expect(result).toBe(true);
				expect(mockGetRef).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						ref: "heads/main",
					}),
				);
			}),
		);

		it.effect("fails with GitBranchError on non-404 error", () =>
			Effect.gen(function* () {
				const mockClientWith500: typeof GitHubClient.Service = {
					...mockClient,
					rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
						Effect.tryPromise({
							try: () =>
								fn({
									rest: {
										git: {
											createRef: mockCreateRef,
											getRef: mockGetRef,
											deleteRef: mockDeleteRef,
											updateRef: mockUpdateRef,
										},
									},
								}),
							catch: () =>
								new GitHubClientError({
									operation: _operation,
									status: 500,
									reason: "Internal Server Error",
									retryable: false,
									retryAfterMs: undefined,
								}),
						}).pipe(Effect.map((r) => r.data)),
				};
				mockGetRef.mockRejectedValue(new Error("Server Error"));
				const layer500 = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, mockClientWith500));
				const exit = yield* Effect.exit(
					Effect.provide(
						Effect.flatMap(GitBranch, (svc) => svc.exists("branch")),
						layer500,
					),
				);
				expect(exit._tag).toBe("Failure");
				if (Exit.isFailure(exit)) {
					const error = Cause.squash(exit.cause) as GitBranchError;
					expect(error._tag).toBe("GitBranchError");
					expect(error.status).toBe(500);
					expect(error.alreadyExists).toBe(false);
				}
			}),
		);

		it.effect("returns false on 404", () =>
			Effect.gen(function* () {
				mockGetRef.mockRejectedValue(new Error("Not Found"));
				const mockClientWith404: typeof GitHubClient.Service = {
					...mockClient,
					rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
						Effect.tryPromise({
							try: () =>
								fn({
									rest: {
										git: {
											createRef: mockCreateRef,
											getRef: mockGetRef,
											deleteRef: mockDeleteRef,
											updateRef: mockUpdateRef,
										},
									},
								}),
							catch: () =>
								new GitHubClientError({
									operation: _operation,
									status: 404,
									reason: "Not Found",
									retryable: false,
									retryAfterMs: undefined,
								}),
						}).pipe(Effect.map((r) => r.data)),
				};
				const layer404 = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, mockClientWith404));
				const result = yield* Effect.provide(
					Effect.flatMap(GitBranch, (svc) => svc.exists("missing")),
					layer404,
				);
				expect(result).toBe(false);
			}),
		);
	});

	describe("delete", () => {
		it.effect("calls git.deleteRef with correct args", () =>
			Effect.gen(function* () {
				mockDeleteRef.mockResolvedValue({ data: {} });
				yield* run(Effect.flatMap(GitBranch, (svc) => svc.delete("feature/old")));
				expect(mockDeleteRef).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						ref: "heads/feature/old",
					}),
				);
			}),
		);
	});

	describe("getSha", () => {
		it.effect("returns the SHA from the ref", () =>
			Effect.gen(function* () {
				mockGetRef.mockResolvedValue({ data: { object: { sha: "def456" } } });
				const result = yield* run(Effect.flatMap(GitBranch, (svc) => svc.getSha("main")));
				expect(result).toBe("def456");
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockGetRef.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(Effect.flatMap(GitBranch, (svc) => svc.getSha("missing")));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("reset", () => {
		it.effect("calls git.updateRef with force: true", () =>
			Effect.gen(function* () {
				mockUpdateRef.mockResolvedValue({ data: {} });
				yield* run(Effect.flatMap(GitBranch, (svc) => svc.reset("main", "new-sha")));
				expect(mockUpdateRef).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						ref: "heads/main",
						sha: "new-sha",
						force: true,
					}),
				);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockUpdateRef.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(Effect.flatMap(GitBranch, (svc) => svc.reset("branch", "sha")));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("retry on transient errors", () => {
		it.effect("retries delete on transient 500 error then succeeds", () =>
			Effect.gen(function* () {
				mockDeleteRef
					.mockRejectedValueOnce(Object.assign(new Error("Server Error"), { status: 500 }))
					.mockResolvedValueOnce({ data: {} });

				const retryClient = makeMockClient();
				const retryLayer = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, retryClient));

				const exit = yield* runWithTestClock(
					Effect.flatMap(GitBranch, (svc) => svc.delete("feature/old")),
					retryLayer,
				);
				expect(exit._tag).toBe("Success");
				expect(mockDeleteRef).toHaveBeenCalledTimes(2);
			}),
		);

		it.effect("gives up after max retries on persistent 500", () =>
			Effect.gen(function* () {
				mockDeleteRef.mockRejectedValue(Object.assign(new Error("Server Error"), { status: 500 }));

				const retryClient = makeMockClient();
				const retryLayer = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, retryClient));

				const exit = yield* runWithTestClock(
					Effect.flatMap(GitBranch, (svc) => svc.delete("feature/old")),
					retryLayer,
				);
				expect(exit._tag).toBe("Failure");
				// 1 initial + 3 retries = 4 total calls
				expect(mockDeleteRef).toHaveBeenCalledTimes(4);
			}),
		);

		it.effect("does not retry on non-retryable errors (e.g., 404)", () =>
			Effect.gen(function* () {
				mockDeleteRef.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));

				const retryClient = makeMockClient();
				const retryLayer = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, retryClient));

				const exit = yield* runWithTestClock(
					Effect.flatMap(GitBranch, (svc) => svc.delete("branch")),
					retryLayer,
				);
				expect(exit._tag).toBe("Failure");
				expect(mockDeleteRef).toHaveBeenCalledTimes(1);
			}),
		);

		it.effect("retries create on transient 500 error", () =>
			Effect.gen(function* () {
				mockCreateRef
					.mockRejectedValueOnce(Object.assign(new Error("Server Error"), { status: 500 }))
					.mockResolvedValueOnce({ data: {} });

				const retryClient = makeMockClient();
				const retryLayer = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, retryClient));

				const exit = yield* runWithTestClock(
					Effect.flatMap(GitBranch, (svc) => svc.create("new-branch", "sha123")),
					retryLayer,
				);
				expect(exit._tag).toBe("Success");
				expect(mockCreateRef).toHaveBeenCalledTimes(2);
			}),
		);
	});

	describe("HTML error handling", () => {
		it.effect("produces clean error for HTML 500 responses", () =>
			Effect.gen(function* () {
				const htmlError = Object.assign(new Error("<!DOCTYPE html><html><body>Unicorn!</body></html>"), {
					status: 500,
				});
				mockDeleteRef.mockRejectedValue(htmlError);

				const htmlClient = makeMockClient();
				const htmlLayer = Layer.provide(GitBranchLive, Layer.succeed(GitHubClient, htmlClient));

				const exit = yield* runWithTestClock(
					Effect.flatMap(GitBranch, (svc) => svc.delete("branch")),
					htmlLayer,
				);
				expect(exit._tag).toBe("Failure");
				if (Exit.isFailure(exit)) {
					const error = Cause.squash(exit.cause);
					expect((error as { reason: string }).reason).toBe("GitHub API returned 500 (server error)");
					expect((error as { reason: string }).reason).not.toContain("<!DOCTYPE");
				}
			}),
		);
	});
});
