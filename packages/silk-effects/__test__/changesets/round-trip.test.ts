/**
 * Round-trip tests verifying transformer output is well-formed
 * and consistent with lint rules.
 */

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { ChangesetLinter } from "../../src/changesets/api/linter.js";
import { ChangelogTransformer } from "../../src/changesets/api/transformer.js";
import { isValidHeading } from "../../src/changesets/categories/index.js";
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

/** Extract all h3 heading texts from markdown content. */
function extractH3Headings(content: string): string[] {
	const matches = content.match(/^### (.+)$/gm);
	if (!matches) return [];
	return matches.map((m) => m.replace(/^### /, ""));
}

describe("Round-trip: lint → format → transform", () => {
	it.effect("transformed output has valid category headings", () =>
		Effect.gen(function* () {
			const changesetContent = "## Features\n\n- Added auth\n\n## Bug Fixes\n\n- Fixed crash";

			const entry = yield* getReleaseLine(
				{
					id: "rt-1",
					summary: changesetContent,
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			).pipe(Effect.provide(testLayer));

			const raw = `## 1.0.0\n\n${entry}\n`;
			const result = ChangelogTransformer.transformContent(raw);

			// All h3 headings should be valid category names
			const headings = extractH3Headings(result);
			expect(headings.length).toBeGreaterThan(0);
			for (const heading of headings) {
				expect(isValidHeading(heading)).toBe(true);
			}
		}),
	);

	it.effect("transform is idempotent", () =>
		Effect.gen(function* () {
			const entry = yield* getReleaseLine(
				{
					id: "rt-2",
					summary:
						"## Features\n\n- Added search\n\n## Bug Fixes\n\n- Fixed filter\n\n## Performance\n\n- Optimized query",
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			).pipe(Effect.provide(testLayer));

			const raw = `## 1.0.0\n\n${entry}\n`;
			const first = ChangelogTransformer.transformContent(raw);
			const second = ChangelogTransformer.transformContent(first);

			expect(second).toBe(first);
		}),
	);

	it.effect("lint, format, transform cycle produces valid headings", () =>
		Effect.gen(function* () {
			const changesetContent = "## Features\n\n- Added login system\n\n## Documentation\n\n- Updated README";

			// Step 1: Verify changeset passes lint
			const lintMessages = ChangesetLinter.validateContent(changesetContent);
			expect(lintMessages).toHaveLength(0);

			// Step 2: Format via getReleaseLine
			const entry = yield* getReleaseLine(
				{
					id: "rt-3",
					summary: changesetContent,
					releases: [{ name: "pkg", type: "minor" }],
					commit: "abc1234567890",
				},
				"minor",
				OPTIONS,
			).pipe(Effect.provide(testLayer));

			// Step 3: Assemble and transform
			const raw = `## 1.0.0\n\n${entry}\n`;
			const result = ChangelogTransformer.transformContent(raw);

			// Step 4: All section headings in the output are valid categories
			const headings = extractH3Headings(result);
			expect(headings.length).toBeGreaterThan(0);
			for (const heading of headings) {
				expect(isValidHeading(heading)).toBe(true);
			}

			// Verify both original sections survived
			expect(headings).toContain("Features");
			expect(headings).toContain("Documentation");
		}),
	);

	it.effect("collapses byte-identical entries from two changesets into one item", () =>
		Effect.gen(function* () {
			const mk = (id: string) =>
				getReleaseLine(
					{ id, summary: "## Bug Fixes\n\n- Fixed the crash", releases: [{ name: "pkg", type: "patch" }] },
					"patch",
					OPTIONS,
				).pipe(Effect.provide(testLayer));
			const [a, b] = yield* Effect.all([mk("dup-1"), mk("dup-2")]);
			const result = ChangelogTransformer.transformContent(`## 1.0.1\n\n${a}\n\n${b}\n`);
			const occurrences = (result.match(/Fixed the crash/g) || []).length;
			expect(occurrences).toBe(1);
		}),
	);
});
