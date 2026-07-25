import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import { GitHubClientError } from "../../src/errors/GitHubClientError.js";
import { GitCommitLive } from "../../src/layers/GitCommitLive.js";
import { GitCommit } from "../../src/services/GitCommit.js";
import { GitHubClient } from "../../src/services/GitHubClient.js";

const mockCreateTree = vi.fn();
const mockCreateCommit = vi.fn();
const mockGetRef = vi.fn();
const mockUpdateRef = vi.fn();

const mockClient: typeof GitHubClient.Service = {
	rest: <T>(_operation: string, fn: (octokit: unknown) => Promise<{ data: T }>) =>
		Effect.tryPromise({
			try: () =>
				fn({
					rest: {
						git: {
							createTree: mockCreateTree,
							createCommit: mockCreateCommit,
							getRef: mockGetRef,
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

const testLayer = Layer.provide(GitCommitLive, Layer.succeed(GitHubClient, mockClient));

const run = <A, E>(effect: Effect.Effect<A, E, GitCommit>) => Effect.provide(effect, testLayer);

const runExit = <A, E>(effect: Effect.Effect<A, E, GitCommit>) => Effect.exit(Effect.provide(effect, testLayer));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GitCommitLive", () => {
	describe("createTree", () => {
		it.effect("calls git.createTree with correct args", () =>
			Effect.gen(function* () {
				mockCreateTree.mockResolvedValue({ data: { sha: "tree-abc" } });
				const sha = yield* run(
					Effect.flatMap(GitCommit, (svc) =>
						svc.createTree([{ path: "file.txt", mode: "100644", content: "hello" }], "base-sha"),
					),
				);
				expect(sha).toBe("tree-abc");
				expect(mockCreateTree).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						base_tree: "base-sha",
						tree: [{ path: "file.txt", mode: "100644", type: "blob", content: "hello" }],
					}),
				);
			}),
		);

		it.effect("passes sha: null for deletion entries", () =>
			Effect.gen(function* () {
				mockCreateTree.mockResolvedValue({ data: { sha: "tree-del" } });
				const sha = yield* run(
					Effect.flatMap(GitCommit, (svc) =>
						svc.createTree([
							{ path: "keep.txt", mode: "100644", content: "hello" },
							{ path: "remove.txt", mode: "100644", sha: null },
						]),
					),
				);
				expect(sha).toBe("tree-del");
				expect(mockCreateTree).toHaveBeenCalledWith(
					expect.objectContaining({
						tree: [
							{ path: "keep.txt", mode: "100644", type: "blob", content: "hello" },
							{ path: "remove.txt", mode: "100644", sha: null },
						],
					}),
				);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockCreateTree.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(
					Effect.flatMap(GitCommit, (svc) => svc.createTree([{ path: "f", mode: "100644", content: "c" }])),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("createCommit", () => {
		it.effect("calls git.createCommit with correct args", () =>
			Effect.gen(function* () {
				mockCreateCommit.mockResolvedValue({ data: { sha: "commit-abc" } });
				const sha = yield* run(Effect.flatMap(GitCommit, (svc) => svc.createCommit("msg", "tree-sha", ["parent-sha"])));
				expect(sha).toBe("commit-abc");
				expect(mockCreateCommit).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						message: "msg",
						tree: "tree-sha",
						parents: ["parent-sha"],
					}),
				);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockCreateCommit.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(Effect.flatMap(GitCommit, (svc) => svc.createCommit("msg", "tree", ["parent"])));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("updateRef", () => {
		it.effect("calls git.updateRef with correct args", () =>
			Effect.gen(function* () {
				mockUpdateRef.mockResolvedValue({ data: {} });
				yield* run(Effect.flatMap(GitCommit, (svc) => svc.updateRef("main", "commit-sha", true)));
				expect(mockUpdateRef).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						ref: "heads/main",
						sha: "commit-sha",
						force: true,
					}),
				);
			}),
		);

		it.effect("defaults force to false", () =>
			Effect.gen(function* () {
				mockUpdateRef.mockResolvedValue({ data: {} });
				yield* run(Effect.flatMap(GitCommit, (svc) => svc.updateRef("main", "sha")));
				expect(mockUpdateRef).toHaveBeenCalledWith(
					expect.objectContaining({
						force: false,
					}),
				);
			}),
		);

		it.effect("fails on API error", () =>
			Effect.gen(function* () {
				mockUpdateRef.mockRejectedValue(new Error("api error"));
				const exit = yield* runExit(Effect.flatMap(GitCommit, (svc) => svc.updateRef("main", "sha")));
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("commitFiles", () => {
		it.effect("orchestrates getRef, createTree, createCommit, updateRef", () =>
			Effect.gen(function* () {
				mockGetRef.mockResolvedValue({ data: { object: { sha: "parent-sha" } } });
				mockCreateTree.mockResolvedValue({ data: { sha: "new-tree-sha" } });
				mockCreateCommit.mockResolvedValue({ data: { sha: "new-commit-sha" } });
				mockUpdateRef.mockResolvedValue({ data: {} });

				const sha = yield* run(
					Effect.flatMap(GitCommit, (svc) =>
						svc.commitFiles("main", "add files", [{ path: "README.md", content: "# Hello" }]),
					),
				);

				expect(sha).toBe("new-commit-sha");

				expect(mockGetRef).toHaveBeenCalledWith(
					expect.objectContaining({
						owner: "test-owner",
						repo: "test-repo",
						ref: "heads/main",
					}),
				);

				expect(mockCreateTree).toHaveBeenCalledWith(
					expect.objectContaining({
						base_tree: "parent-sha",
						tree: [{ path: "README.md", mode: "100644", type: "blob", content: "# Hello" }],
					}),
				);

				expect(mockCreateCommit).toHaveBeenCalledWith(
					expect.objectContaining({
						message: "add files",
						tree: "new-tree-sha",
						parents: ["parent-sha"],
					}),
				);

				expect(mockUpdateRef).toHaveBeenCalledWith(
					expect.objectContaining({
						ref: "heads/main",
						sha: "new-commit-sha",
						force: false,
					}),
				);
			}),
		);

		it.effect("handles mixed additions and deletions", () =>
			Effect.gen(function* () {
				mockGetRef.mockResolvedValue({ data: { object: { sha: "parent-sha" } } });
				mockCreateTree.mockResolvedValue({ data: { sha: "new-tree-sha" } });
				mockCreateCommit.mockResolvedValue({ data: { sha: "new-commit-sha" } });
				mockUpdateRef.mockResolvedValue({ data: {} });

				yield* run(
					Effect.flatMap(GitCommit, (svc) =>
						svc.commitFiles("main", "mixed changes", [
							{ path: "added.md", content: "# New" },
							{ path: "removed.md", sha: null },
						]),
					),
				);

				expect(mockCreateTree).toHaveBeenCalledWith(
					expect.objectContaining({
						tree: [
							{ path: "added.md", mode: "100644", type: "blob", content: "# New" },
							{ path: "removed.md", mode: "100644", sha: null },
						],
					}),
				);
			}),
		);

		it.effect("fails when getRef fails", () =>
			Effect.gen(function* () {
				mockGetRef.mockRejectedValue(new Error("not found"));
				const exit = yield* runExit(
					Effect.flatMap(GitCommit, (svc) => svc.commitFiles("missing", "msg", [{ path: "f", content: "c" }])),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});
});
