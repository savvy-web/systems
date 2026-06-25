import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { GitHubClientTestState, RestResponse } from "../../src/layers/GitHubClientTest.js";
import { GitHubClientTest } from "../../src/layers/GitHubClientTest.js";
import { GitHubCommitLive } from "../../src/layers/GitHubCommitLive.js";
import { GitHubCommit } from "../../src/services/GitHubCommit.js";

const clientState = (overrides: {
	rest?: Array<[string, RestResponse]>;
	paginate?: Array<[string, Array<unknown[]>]>;
}): GitHubClientTestState => ({
	restResponses: new Map(overrides.rest ?? []),
	paginateResponses: new Map(overrides.paginate ?? []),
	graphqlResponses: new Map(),
	repo: { owner: "owner", repo: "repo" },
});

describe("GitHubCommitLive", () => {
	it("get maps a commit to CommitDetail with parents", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* GitHubCommit;
				return yield* svc.get("sha1");
			}).pipe(
				Effect.provide(GitHubCommitLive),
				Effect.provide(
					GitHubClientTest.layer(
						clientState({
							rest: [
								[
									"repos.getCommit",
									{
										data: {
											sha: "sha1",
											commit: { message: "feat: x", author: { name: "Ann" } },
											parents: [{ sha: "parent-sha" }],
										},
									},
								],
							],
						}),
					),
				),
			),
		);
		expect(result).toEqual({
			sha: "sha1",
			message: "feat: x",
			author: "Ann",
			parents: [{ sha: "parent-sha" }],
		});
	});

	it("list maps paginated commits to CommitSummary[]", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* GitHubCommit;
				return yield* svc.list("main");
			}).pipe(
				Effect.provide(GitHubCommitLive),
				Effect.provide(
					GitHubClientTest.layer(
						clientState({
							paginate: [["repos.listCommits", [[{ sha: "c1", commit: { message: "m1", author: { name: "A" } } }]]]],
						}),
					),
				),
			),
		);
		expect(result).toEqual([{ sha: "c1", message: "m1", author: "A" }]);
	});

	it("compare maps a comparison to commits and files", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* GitHubCommit;
				return yield* svc.compare("base", "head");
			}).pipe(
				Effect.provide(GitHubCommitLive),
				Effect.provide(
					GitHubClientTest.layer(
						clientState({
							rest: [
								[
									"repos.compareCommits",
									{
										data: {
											commits: [{ sha: "c1", commit: { message: "m1" } }],
											files: [{ filename: "a/package.json", status: "modified" }],
										},
									},
								],
							],
						}),
					),
				),
			),
		);
		expect(result).toEqual({
			commits: [{ sha: "c1", message: "m1", author: "Unknown" }],
			files: [{ filename: "a/package.json", status: "modified" }],
		});
	});

	it("changedFiles aggregates files across all paginated getCommit pages", async () => {
		// Regression: a squash-merged release commit changed 554 files; the
		// compareCommits endpoint paginates by commit and caps a single-commit
		// comparison at 300 files, dropping packages whose package.json sorts
		// past #300. changedFiles must surface every page's files.
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* GitHubCommit;
				return yield* svc.changedFiles("squash-sha");
			}).pipe(
				Effect.provide(GitHubCommitLive),
				Effect.provide(
					GitHubClientTest.layer(
						clientState({
							paginate: [
								[
									"repos.getCommit",
									[
										[{ filename: "packages/cli/package.json", status: "modified" }],
										[{ filename: "packages/silk/package.json", status: "modified" }],
									],
								],
							],
						}),
					),
				),
			),
		);
		expect(result).toEqual([
			{ filename: "packages/cli/package.json", status: "modified" },
			{ filename: "packages/silk/package.json", status: "modified" },
		]);
	});

	it("changedFiles wraps client errors as GitHubCommitError carrying the ref", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* GitHubCommit;
				return yield* svc.changedFiles("squash-sha");
			}).pipe(Effect.provide(GitHubCommitLive), Effect.provide(GitHubClientTest.layer(clientState({}))), Effect.flip),
		);
		expect(result._tag).toBe("GitHubCommitError");
		expect(result.operation).toBe("changedFiles");
		expect(result.ref).toBe("squash-sha");
	});

	it("compare wraps client errors as GitHubCommitError carrying the base...head ref", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* GitHubCommit;
				return yield* svc.compare("base", "head");
			}).pipe(Effect.provide(GitHubCommitLive), Effect.provide(GitHubClientTest.layer(clientState({}))), Effect.flip),
		);
		expect(result._tag).toBe("GitHubCommitError");
		expect(result.operation).toBe("compare");
		expect(result.ref).toBe("base...head");
	});
});
