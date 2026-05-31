import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { getReleaseLine } from "../../src/changesets/changelog/getReleaseLine.js";
import type { ChangesetOptions } from "../../src/changesets/schemas/options.js";
import { makeGitHubTest } from "../../src/changesets/services/github.js";
import type { GitHubCommitInfo } from "../../src/changesets/vendor/github-info.js";
import type { NewChangesetWithCommit } from "../../src/changesets/vendor/types.js";

const OPTIONS: ChangesetOptions = { repo: "owner/repo" };

const MOCK_INFO: GitHubCommitInfo = {
	user: "octocat",
	pull: 42,
	links: {
		commit: "[`abc1234`](https://github.com/owner/repo/commit/abc1234567890)",
		pull: "https://github.com/owner/repo/pull/42",
		user: "https://github.com/octocat",
	},
};

const testLayer = makeGitHubTest(new Map([["abc1234567890", MOCK_INFO]]));

function run(changeset: NewChangesetWithCommit) {
	return Effect.runPromise(getReleaseLine(changeset, "minor", OPTIONS).pipe(Effect.provide(testLayer)));
}

describe("getReleaseLine", () => {
	it("formats a flat-text changeset with GitHub info", async () => {
		const result = await run({
			id: "test-changeset",
			summary: "feat: add authentication system",
			releases: [{ name: "@savvy-web/changesets", type: "minor" }],
			commit: "abc1234567890",
		});
		expect(result).toContain("[`abc1234`]");
		expect(result).toContain("add authentication system");
		expect(result).toContain("[#42]");
		expect(result).toContain("@octocat");
		expect(result.startsWith("- ")).toBe(true);
	});

	it("formats a changeset without commit", async () => {
		const result = await run({
			id: "no-commit",
			summary: "fix: resolve memory leak",
			releases: [{ name: "@savvy-web/changesets", type: "patch" }],
		});
		expect(result).toContain("resolve memory leak");
		expect(result.startsWith("- ")).toBe(true);
		expect(result).not.toContain("[`");
	});

	it("handles API failure gracefully", async () => {
		const failLayer = makeGitHubTest(new Map());
		const result = await Effect.runPromise(
			getReleaseLine(
				{
					id: "fail-test",
					summary: "chore: update deps",
					releases: [{ name: "@savvy-web/changesets", type: "patch" }],
					commit: "deadbeef1234567",
				},
				"patch",
				OPTIONS,
			).pipe(Effect.provide(failLayer)),
		);
		expect(result).toContain("update deps");
		// Should not throw, just omit GitHub info
	});

	it("formats changeset with h2 sections", async () => {
		const result = await run({
			id: "sectioned",
			summary: "## Features\n\n- Added login system\n\n## Bug Fixes\n\n- Fixed logout",
			releases: [{ name: "@savvy-web/changesets", type: "minor" }],
			commit: "abc1234567890",
		});
		expect(result).toContain("### Features");
		expect(result).toContain("### Bug Fixes");
		expect(result).toContain("Added login system");
		expect(result).toContain("Fixed logout");
	});

	it("formats changeset with preamble + sections", async () => {
		const result = await run({
			id: "preamble",
			summary: "Overview of changes\n\n## Features\n\n- New thing",
			releases: [{ name: "@savvy-web/changesets", type: "minor" }],
			commit: "abc1234567890",
		});
		expect(result).toContain("Overview of changes");
		expect(result).toContain("### Features");
		expect(result).toContain("New thing");
	});

	it("backward-compat flat-text summary", async () => {
		const result = await run({
			id: "flat",
			summary: "Simple change description",
			releases: [{ name: "@savvy-web/changesets", type: "patch" }],
		});
		expect(result).toBe("- Simple change description");
	});

	it("includes issue references in flat-text mode", async () => {
		const result = await run({
			id: "issues",
			summary: "fix: resolve bug\n\nCloses #123",
			releases: [{ name: "@savvy-web/changesets", type: "patch" }],
		});
		expect(result).toContain("Closes:");
		expect(result).toContain("[#123]");
	});
});
