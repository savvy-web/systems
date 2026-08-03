import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
// `vi` stays on the plain "vitest" entrypoint: vitest hoists its mock wiring
// above all imports, and a re-exported binding is not initialized in time.
import { vi } from "vitest";

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
import { GitHubService, makeGitHubTest } from "../../src/changesets/services/github.js";
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

	it.effect("returns configured response for known commit", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const github = yield* GitHubService;
				return yield* github.getInfo({ commit: "abc1234567890", repo: "owner/repo" });
			});

			const result = yield* program.pipe(Effect.provide(testLayer));
			expect(result.user).toBe("octocat");
			expect(result.pull).toBe(42);
			expect(result.links.commit).toContain("abc1234");
		}),
	);

	it.effect("fails with GitHubApiError for unknown commit", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const github = yield* GitHubService;
				return yield* github.getInfo({ commit: "unknown", repo: "owner/repo" });
			});

			const result = yield* program.pipe(Effect.provide(testLayer), Effect.flip);
			expect(result).toBeInstanceOf(GitHubApiError);
			expect(result._tag).toBe("GitHubApiError");
			expect(result.reason).toContain("unknown");
		}),
	);

	it.effect("provides correct operation field on error", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const github = yield* GitHubService;
				return yield* github.getInfo({ commit: "missing", repo: "owner/repo" });
			});

			const error = yield* program.pipe(Effect.provide(testLayer), Effect.flip);
			expect(error.operation).toBe("getInfo");
		}),
	);

	it.effect("GitHubService.layer provides the correct service shape", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const github = yield* GitHubService;
				expect(typeof github.getInfo).toBe("function");
			});

			yield* program.pipe(Effect.provide(GitHubService.layer));
		}),
	);

	it.effect("error includes descriptive reason for unknown commit", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const github = yield* GitHubService;
				return yield* github.getInfo({ commit: "deadbeef123", repo: "owner/repo" });
			});

			const error = yield* program.pipe(Effect.provide(testLayer), Effect.flip);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect(error.reason).toContain("No mock response for commit deadbeef123");
			expect(error.message).toContain("GitHub API error during getInfo");
		}),
	);
});

describe("getGitHubInfo (v3 adapter)", () => {
	it.effect("adapts CommitInfo to the legacy GitHubCommitInfo shape", () =>
		Effect.gen(function* () {
			const info = yield* getGitHubInfo({ commit: "abc1234", repo: "o/r" });
			expect(info.user).toBe("spencer");
			expect(info.pull).toBe(7);
			expect(info.links.pull).toBe("[#7](https://github.com/o/r/pull/7)");
			expect(info.links.user).toBe("[@spencer](https://github.com/spencer)");
			expect(info.links.commit).toContain("commit/abc");
		}),
	);

	it.effect("fails with GitHubApiError when the commit is not found", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				return yield* getGitHubInfo({ commit: "missing", repo: "o/r" });
			});

			const error = yield* program.pipe(Effect.flip);
			expect(error).toBeInstanceOf(GitHubApiError);
			expect(error.reason).toContain("not found");
		}),
	);
});
