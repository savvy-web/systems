/**
 * Compatibility tests verifying transformer output is parseable by
 * silk-release-action's extractVersionSection logic.
 */

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { ChangelogTransformer } from "../../src/changesets/api/transformer.js";
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

/**
 * Minimal extractVersionSection adapted from silk-release-action.
 * See silk-release-action/src/utils/generate-release-notes-preview.ts
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVersionSection(changelogContent: string, version: string): string | null {
	const versionPattern = new RegExp(`^#+\\s+\\[?${escapeRegex(version)}\\]?.*$`, "im");
	const match = changelogContent.match(versionPattern);

	if (!match || match.index === undefined) return null;

	const startIndex = match.index;
	const lines = changelogContent.slice(startIndex).split("\n");
	const headingLevel = (match[0].match(/^#+/) || ["##"])[0].length;
	const endPattern = new RegExp(`^#{1,${headingLevel}}\\s+`);

	let endIndex = lines.length;
	for (let i = 1; i < lines.length; i++) {
		if (endPattern.test(lines[i])) {
			endIndex = i;
			break;
		}
	}

	const section = lines.slice(0, endIndex).join("\n").trim();
	const contentLines = section.split("\n").slice(1);
	return contentLines.join("\n").trim();
}

const buildChangelog = (version: string, summary: string): Effect.Effect<string> =>
	Effect.gen(function* () {
		const entry = yield* getReleaseLine(
			{
				id: "compat-cs",
				summary,
				releases: [{ name: "pkg", type: "minor" }],
				commit: "abc1234567890",
			},
			"minor",
			OPTIONS,
		).pipe(Effect.provide(testLayer));
		return ChangelogTransformer.transformContent(`## ${version}\n\n${entry}\n`);
	});

describe("silk-release-action compatibility", () => {
	it.effect("version heading extraction matches regex", () =>
		Effect.gen(function* () {
			const changelog = yield* buildChangelog("1.0.0", "feat: add feature");

			const section = extractVersionSection(changelog, "1.0.0");
			expect(section).not.toBeNull();
			expect(section).toContain("add feature");
		}),
	);

	it.effect("section boundary detection with multiple versions", () =>
		Effect.gen(function* () {
			const entry1 = yield* getReleaseLine(
				{ id: "v2", summary: "feat: new thing", releases: [{ name: "pkg", type: "minor" }], commit: "abc1234567890" },
				"minor",
				OPTIONS,
			).pipe(Effect.provide(testLayer));

			const entry2 = yield* getReleaseLine(
				{ id: "v1", summary: "fix: old fix", releases: [{ name: "pkg", type: "patch" }] },
				"patch",
				OPTIONS,
			).pipe(Effect.provide(testLayer));

			const raw = `## 2.0.0\n\n${entry1}\n\n## 1.0.0\n\n${entry2}\n`;
			const changelog = ChangelogTransformer.transformContent(raw);

			const v2 = extractVersionSection(changelog, "2.0.0");
			const v1 = extractVersionSection(changelog, "1.0.0");

			expect(v2).not.toBeNull();
			expect(v1).not.toBeNull();
			expect(v2).toContain("new thing");
			expect(v2).not.toContain("old fix");
			expect(v1).toContain("old fix");
			expect(v1).not.toContain("new thing");
		}),
	);

	it("multi-version document extracts each independently", () => {
		const changelog = ChangelogTransformer.transformContent(
			[
				"## 3.0.0",
				"",
				"### Breaking Changes",
				"",
				"- Removed legacy API",
				"",
				"## 2.0.0",
				"",
				"### Features",
				"",
				"- Added search",
				"",
				"## 1.0.0",
				"",
				"### Bug Fixes",
				"",
				"- Fixed crash",
				"",
			].join("\n"),
		);

		const v3 = extractVersionSection(changelog, "3.0.0");
		const v2 = extractVersionSection(changelog, "2.0.0");
		const v1 = extractVersionSection(changelog, "1.0.0");

		expect(v3).toContain("Removed legacy API");
		expect(v2).toContain("Added search");
		expect(v1).toContain("Fixed crash");

		// Each section is isolated
		expect(v3).not.toContain("Added search");
		expect(v2).not.toContain("Fixed crash");
	});

	it("GFM features preserved through transformation", () => {
		const changelog = ChangelogTransformer.transformContent(
			[
				"## 1.0.0",
				"",
				"### Features",
				"",
				"- Added support for `code blocks`",
				"",
				"  ```typescript",
				"  const x = 1;",
				"  ```",
				"",
				"- Table support:",
				"",
				"  | Column A | Column B |",
				"  | -------- | -------- |",
				"  | value1   | value2   |",
				"",
			].join("\n"),
		);

		const section = extractVersionSection(changelog, "1.0.0");
		expect(section).not.toBeNull();
		expect(section).toContain("```typescript");
		expect(section).toContain("const x = 1;");
		expect(section).toContain("Column A");
		expect(section).toContain("value1");
	});
});
