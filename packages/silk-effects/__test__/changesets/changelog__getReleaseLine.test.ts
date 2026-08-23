import { expect, it, layer } from "@effect/vitest";
import { Effect } from "effect";
import { getReleaseLine } from "../../src/changesets/changelog/getReleaseLine.js";
import type { ChangesetOptions } from "../../src/changesets/schemas/options.js";
import { makeGitHubTest } from "../../src/changesets/services/github.js";
import type { GitHubCommitInfo } from "../../src/changesets/vendor/github-info.js";

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

layer(testLayer)("getReleaseLine", (it) => {
	it.effect("formats a flat-text changeset with GitHub info", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "test-changeset",
					summary: "feat: add authentication system",
					releases: [{ name: "@savvy-web/changesets", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("add authentication system");
			expect(result).toContain("[#42]");
			expect(result).toContain("@octocat");
			expect(result.startsWith("- ")).toBe(true);
		}),
	);

	it.effect("formats a changeset without commit", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "no-commit",
					summary: "fix: resolve memory leak",
					releases: [{ name: "@savvy-web/changesets", type: "patch" }],
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("resolve memory leak");
			expect(result.startsWith("- ")).toBe(true);
			expect(result).not.toContain("[`");
		}),
	);

	it.effect("formats changeset with h2 sections", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "sectioned",
					summary: "## Features\n\n- Added login system\n\n## Bug Fixes\n\n- Fixed logout",
					releases: [{ name: "@savvy-web/changesets", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("### Features");
			expect(result).toContain("### Bug Fixes");
			expect(result).toContain("Added login system");
			expect(result).toContain("Fixed logout");
		}),
	);

	it.effect("formats changeset with preamble + sections", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "preamble",
					summary: "Overview of changes\n\n## Features\n\n- New thing",
					releases: [{ name: "@savvy-web/changesets", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("Overview of changes");
			expect(result).toContain("### Features");
			expect(result).toContain("New thing");
		}),
	);

	it.effect("indents multi-line prose section content inside the list item", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "prose-section",
					summary: "## Features\n\nFirst prose line\nsecond prose line",
					releases: [{ name: "@savvy-web/changesets", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("- First prose line\n  second prose line");
		}),
	);

	it.effect("backward-compat flat-text summary", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "flat",
					summary: "Simple change description",
					releases: [{ name: "@savvy-web/changesets", type: "patch" }],
				},
				"minor",
				OPTIONS,
			);
			expect(result).toBe("- Simple change description");
		}),
	);

	it.effect("includes issue references in flat-text mode", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "issues",
					summary: "fix: resolve bug\n\nCloses #123",
					releases: [{ name: "@savvy-web/changesets", type: "patch" }],
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("Closes:");
			expect(result).toContain("[#123]");
		}),
	);

	it.effect("does not inject a commit link prefix in section-aware mode", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "no-prefix-1",
					summary: "## Features\n\n- Added search",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).not.toContain("commit/abc1234567890");
			expect(result).not.toContain("[`abc1234`]");
			expect(result).toContain("Added search");
		}),
	);

	it.effect("does not inject a commit link prefix in flat-text mode", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "no-prefix-2",
					summary: "feat: add search",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).not.toContain("commit/abc1234567890");
		}),
	);

	it.effect("promotes ### sub-headings in section content to #### blocks", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "sub-heading",
					summary: "## Features\n\n### Sub-feature\n\nProse about it.",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("### Features");
			expect(result).toMatch(/\n#### Sub-feature\n/);
			expect(result).not.toContain("- ###");
			expect(result).not.toContain("  ###");
		}),
	);

	it.effect("passes an authored dependency table through as a block, attribution outside the table", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "dep-table",
					summary:
						"## Dependencies\n\n| Dependency | Type | Action | From | To |\n| --- | --- | --- | --- | --- |\n| effect | dependency | updated | 4.0.0 | 4.1.0 |",
					releases: [{ name: "pkg", type: "patch" }],
					commit: "abc1234567890",
				},
				"patch",
				OPTIONS,
			);
			expect(result).toContain("### Dependencies");
			// remark-stringify pads table cells, so match structurally
			expect(result).toMatch(/\n\| Dependency \| Type\s+\| Action/);
			expect(result).not.toMatch(/^\s*[-*] \|/m);
			for (const line of result.split("\n")) {
				if (line.trimStart().startsWith("|")) {
					expect(line).not.toContain("Thanks");
				}
			}
			// attribution still present, as its own trailing block
			expect(result).toContain("@octocat");
		}),
	);

	it.effect("appends attribution to the deepest trailing bullet of a nested trailing list", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "nested-list",
					summary: "## Features\n\n- Parent bullet\n  - Child bullet",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			// The attribution lands on the final RENDERED bullet — the deepest
			// trailing item of the nested list — never on its parent, where it
			// would visually attach to the wrong line.
			expect(result).toMatch(/Child bullet \[#42\]/);
			expect(result).not.toMatch(/Parent bullet \[#42\]/);
		}),
	);

	it.effect("renders each top-level paragraph of a section as its own bullet", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "two-paragraphs",
					summary: "## Features\n\nFirst change.\n\nSecond change.",
					releases: [{ name: "pkg", type: "minor" }],
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("- First change.");
			expect(result).toContain("- Second change.");
		}),
	);

	it.effect("omits the thanks credit when options.thanks is false", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "no-thanks",
					summary: "## Features\n\n- Added search",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				{ repo: "owner/repo", thanks: false },
			);
			expect(result).not.toContain("Thanks");
			expect(result).not.toContain("@octocat");
			// PR reference is provenance, not thanks — it stays
			expect(result).toContain("[#42]");
		}),
	);

	it.effect("omits the thanks credit in flat-text mode when options.thanks is false", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "no-thanks-flat",
					summary: "feat: add search",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				{ repo: "owner/repo", thanks: false },
			);
			expect(result).not.toContain("Thanks");
			expect(result).not.toContain("@octocat");
		}),
	);

	it.effect("preserves links the author wrote in the changeset body", () =>
		Effect.gen(function* () {
			const result = yield* getReleaseLine(
				{
					id: "authored-link",
					summary: "## Features\n\n- See [the RFC](https://github.com/owner/repo/issues/9)",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			);
			expect(result).toContain("[the RFC](https://github.com/owner/repo/issues/9)");
		}),
	);
});

// Kept OUTSIDE the `layer(...)` block on purpose: this test needs a DIFFERENT
// GitHub layer (an empty map, so lookups miss). A suite-boundary layer cannot
// vary per test, so a distinct fixture gets its own provide.
it.effect("handles API failure gracefully", () =>
	Effect.gen(function* () {
		const failLayer = makeGitHubTest(new Map());
		const result = yield* getReleaseLine(
			{
				id: "fail-test",
				summary: "chore: update deps",
				releases: [{ name: "@savvy-web/changesets", type: "patch" }],
				commit: "deadbeef1234567",
			},
			"patch",
			OPTIONS,
		).pipe(Effect.provide(failLayer));
		expect(result).toContain("update deps");
		// Should not throw, just omit GitHub info
	}),
);
