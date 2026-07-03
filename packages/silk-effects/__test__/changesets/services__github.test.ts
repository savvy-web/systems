import { Effect, Exit } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@changesets/get-github-info", () => ({
	getCommitInfo: vi.fn(async ({ commit }: { commit: string }) =>
		commit === "missing"
			? undefined
			: {
					commit: {
						sha: commit,
						url: "https://github.com/o/r/commit/abc",
						markdownLink: "[`abc1234`](https://github.com/o/r/commit/abc)",
					},
					author: {
						login: "spencer",
						url: "https://github.com/spencer",
						markdownLink: "[@spencer](https://github.com/spencer)",
					},
					pull: {
						number: 7,
						url: "https://github.com/o/r/pull/7",
						markdownLink: "[#7](https://github.com/o/r/pull/7)",
					},
				},
	),
}));

import { GitHubApiError } from "../../src/changesets/errors.js";
import { GitHubLive, GitHubService, makeGitHubTest } from "../../src/changesets/services/github.js";
import type { GitHubCommitInfo } from "../../src/changesets/vendor/github-info.js";
import { getGitHubInfo } from "../../src/changesets/vendor/github-info.js";

const MOCK_INFO: GitHubCommitInfo = {
	user: "octocat",
	pull: 42,
	links: {
		commit: "[`abc1234`](https://github.com/owner/repo/commit/abc1234)",
		pull: "[#42](https://github.com/owner/repo/pull/42)",
		user: "[@octocat](https://github.com/octocat)",
	},
};

describe("GitHubService (test layer)", () => {
	const testLayer = makeGitHubTest(new Map([["abc1234567890", MOCK_INFO]]));

	it("returns configured response for known commit", async () => {
		const program = Effect.gen(function* () {
			const github = yield* GitHubService;
			return yield* github.getInfo({ commit: "abc1234567890", repo: "owner/repo" });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
		expect(result.user).toBe("octocat");
		expect(result.pull).toBe(42);
		expect(result.links.commit).toContain("abc1234");
	});

	it("fails with GitHubApiError for unknown commit", async () => {
		const program = Effect.gen(function* () {
			const github = yield* GitHubService;
			return yield* github.getInfo({ commit: "unknown", repo: "owner/repo" });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer), Effect.flip));
		expect(result).toBeInstanceOf(GitHubApiError);
		expect(result._tag).toBe("GitHubApiError");
		expect(result.reason).toContain("unknown");
	});

	it("provides correct operation field on error", async () => {
		const program = Effect.gen(function* () {
			const github = yield* GitHubService;
			return yield* github.getInfo({ commit: "missing", repo: "owner/repo" });
		});

		const error = await Effect.runPromise(program.pipe(Effect.provide(testLayer), Effect.flip));
		expect(error.operation).toBe("getInfo");
	});

	it("GitHubLive provides the correct service shape", async () => {
		const program = Effect.gen(function* () {
			const github = yield* GitHubService;
			expect(typeof github.getInfo).toBe("function");
		});

		await Effect.runPromise(program.pipe(Effect.provide(GitHubLive)));
	});

	it("error includes descriptive reason for unknown commit", async () => {
		const program = Effect.gen(function* () {
			const github = yield* GitHubService;
			return yield* github.getInfo({ commit: "deadbeef123", repo: "owner/repo" });
		});

		const error = await Effect.runPromise(program.pipe(Effect.provide(testLayer), Effect.flip));
		expect(error).toBeInstanceOf(GitHubApiError);
		expect(error.reason).toContain("No mock response for commit deadbeef123");
		expect(error.message).toContain("GitHub API error during getInfo");
	});
});

describe("getGitHubInfo (v3 adapter)", () => {
	it("adapts CommitInfo to the legacy GitHubCommitInfo shape", async () => {
		const info = await Effect.runPromise(getGitHubInfo({ commit: "abc1234", repo: "o/r" }));
		expect(info.user).toBe("spencer");
		expect(info.pull).toBe(7);
		expect(info.links.pull).toBe("[#7](https://github.com/o/r/pull/7)");
		expect(info.links.user).toBe("[@spencer](https://github.com/spencer)");
		expect(info.links.commit).toContain("commit/abc");
	});

	it("fails with GitHubApiError when the commit is not found", async () => {
		const program = Effect.gen(function* () {
			return yield* getGitHubInfo({ commit: "missing", repo: "o/r" });
		});

		const error = await Effect.runPromise(program.pipe(Effect.flip));
		expect(error).toBeInstanceOf(GitHubApiError);
		expect(error.reason).toContain("not found");
	});
});
