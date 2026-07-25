import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { ChangelogTransformer } from "../../src/changesets/api/transformer.js";
import { getDependencyReleaseLine } from "../../src/changesets/changelog/getDependencyReleaseLine.js";
import { getReleaseLine } from "../../src/changesets/changelog/getReleaseLine.js";
import { AggregateDependencyTablesPlugin } from "../../src/changesets/remark/plugins/aggregate-dependency-tables.js";
import { DependencyTableFormatRule } from "../../src/changesets/remark/rules/dependency-table-format.js";
import type { ChangesetOptions } from "../../src/changesets/schemas/options.js";
import { makeGitHubTest } from "../../src/changesets/services/github.js";
import type { GitHubCommitInfo } from "../../src/changesets/vendor/github-info.js";
import type { NewChangesetWithCommit } from "../../src/changesets/vendor/types.js";

const OPTIONS: ChangesetOptions = { repo: "owner/repo" };

const MOCK_ALICE: GitHubCommitInfo = {
	user: "alice",
	pull: 10,
	links: {
		commit: "[`aaa1234`](https://github.com/owner/repo/commit/aaa1234567890)",
		pull: "https://github.com/owner/repo/pull/10",
		user: "https://github.com/alice",
	},
};

const MOCK_BOB: GitHubCommitInfo = {
	user: "bob",
	pull: 20,
	links: {
		commit: "[`bbb1234`](https://github.com/owner/repo/commit/bbb1234567890)",
		pull: "https://github.com/owner/repo/pull/20",
		user: "https://github.com/bob",
	},
};

const testLayer = makeGitHubTest(
	new Map([
		["aaa1234567890", MOCK_ALICE],
		["bbb1234567890", MOCK_BOB],
	]),
);

/** The release-line effect; the GitHub layer is provided at the suite boundary. */
const releaseLine = (changeset: NewChangesetWithCommit) => getReleaseLine(changeset, "minor", OPTIONS);

function assembleChangelog(version: string, ...entries: string[]): string {
	return `## ${version}\n\n${entries.join("\n\n")}\n`;
}

layer(testLayer)("Full pipeline integration", (it) => {
	it.effect("single changeset, flat text passes through transformer", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine({
				id: "cs-1",
				summary: "feat: add authentication",
				releases: [{ name: "pkg", type: "minor" }],
				commit: "aaa1234567890",
			});

			const raw = assembleChangelog("1.0.0", entry);
			const result = ChangelogTransformer.transformContent(raw);

			expect(result).toContain("## 1.0.0");
			expect(result).toContain("add authentication");
		}),
	);

	it.effect("single changeset, section-aware preserves order", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine({
				id: "cs-2",
				summary: "## Features\n\n- Added login\n\n## Bug Fixes\n\n- Fixed logout",
				releases: [{ name: "pkg", type: "minor" }],
				commit: "aaa1234567890",
			});

			const raw = assembleChangelog("1.0.0", entry);
			const result = ChangelogTransformer.transformContent(raw);

			expect(result).toContain("## 1.0.0");
			expect(result).toContain("### Features");
			expect(result).toContain("### Bug Fixes");
			expect(result).toContain("Added login");
			expect(result).toContain("Fixed logout");

			// Features should come before Bug Fixes (priority order)
			const featIdx = result.indexOf("### Features");
			const fixIdx = result.indexOf("### Bug Fixes");
			expect(featIdx).toBeLessThan(fixIdx);
		}),
	);

	it.effect("multiple changesets, duplicate sections merged", () =>
		Effect.gen(function* () {
			const entry1 = yield* releaseLine({
				id: "cs-3a",
				summary: "## Features\n\n- Added search",
				releases: [{ name: "pkg", type: "minor" }],
				commit: "aaa1234567890",
			});

			const entry2 = yield* releaseLine({
				id: "cs-3b",
				summary: "## Features\n\n- Added filter",
				releases: [{ name: "pkg", type: "minor" }],
				commit: "bbb1234567890",
			});

			const raw = assembleChangelog("1.0.0", entry1, entry2);
			const result = ChangelogTransformer.transformContent(raw);

			// Should have only one ### Features heading after merge
			const matches = result.match(/### Features/g);
			expect(matches).toHaveLength(1);

			expect(result).toContain("Added search");
			expect(result).toContain("Added filter");
		}),
	);

	it.effect("multiple changesets, mixed categories reordered", () =>
		Effect.gen(function* () {
			// Bug fix first, feature second — assembles in "wrong" order
			const fixEntry = yield* releaseLine({
				id: "cs-4a",
				summary: "## Bug Fixes\n\n- Fixed crash",
				releases: [{ name: "pkg", type: "patch" }],
				commit: "aaa1234567890",
			});

			const featEntry = yield* releaseLine({
				id: "cs-4b",
				summary: "## Features\n\n- Added dashboard",
				releases: [{ name: "pkg", type: "minor" }],
				commit: "bbb1234567890",
			});

			// Assemble with Bug Fixes before Features
			const raw = assembleChangelog("1.0.0", fixEntry, featEntry);
			const result = ChangelogTransformer.transformContent(raw);

			// Transformer should reorder: Features (priority 2) before Bug Fixes (priority 3)
			const featIdx = result.indexOf("### Features");
			const fixIdx = result.indexOf("### Bug Fixes");
			expect(featIdx).toBeGreaterThan(-1);
			expect(fixIdx).toBeGreaterThan(-1);
			expect(featIdx).toBeLessThan(fixIdx);
		}),
	);

	it.effect("breaking changes float to top", () =>
		Effect.gen(function* () {
			const featEntry = yield* releaseLine({
				id: "cs-5a",
				summary: "## Features\n\n- Added widget",
				releases: [{ name: "pkg", type: "minor" }],
				commit: "aaa1234567890",
			});

			const breakingEntry = yield* releaseLine({
				id: "cs-5b",
				summary: "## Breaking Changes\n\n- Removed legacy API",
				releases: [{ name: "pkg", type: "major" }],
				commit: "bbb1234567890",
			});

			// Assemble with Features before Breaking Changes
			const raw = assembleChangelog("2.0.0", featEntry, breakingEntry);
			const result = ChangelogTransformer.transformContent(raw);

			// Breaking Changes (priority 1) should come before Features (priority 2)
			const breakingIdx = result.indexOf("### Breaking Changes");
			const featIdx = result.indexOf("### Features");
			expect(breakingIdx).toBeGreaterThan(-1);
			expect(featIdx).toBeGreaterThan(-1);
			expect(breakingIdx).toBeLessThan(featIdx);
		}),
	);

	it.effect("dependency update integration", () =>
		Effect.gen(function* () {
			const releaseEntry = yield* releaseLine({
				id: "cs-6a",
				summary: "feat: add feature",
				releases: [{ name: "pkg", type: "minor" }],
				commit: "aaa1234567890",
			});

			const depEntry = yield* getDependencyReleaseLine(
				[{ id: "cs-6b", summary: "bump deps", releases: [], commit: "bbb1234567890" }],
				[
					{
						name: "some-lib",
						type: "patch",
						oldVersion: "1.0.0",
						newVersion: "2.0.0",
						changesets: [],
						packageJson: { name: "some-lib", version: "2.0.0" },
						dir: "/packages/some-lib",
					},
				],
				OPTIONS,
			);

			const raw = assembleChangelog("1.0.0", releaseEntry, depEntry);
			const result = ChangelogTransformer.transformContent(raw);

			expect(result).toContain("## 1.0.0");
			expect(result).toContain("add feature");
			// remark-stringify escapes @ to \@
			expect(result).toContain("some-lib");
			expect(result).toContain("2.0.0");
		}),
	);

	it.effect("issue references in flat text", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine({
				id: "cs-7",
				summary: "fix: resolve crash\n\nCloses #123, Fixes #456",
				releases: [{ name: "pkg", type: "patch" }],
				commit: "aaa1234567890",
			});

			const raw = assembleChangelog("1.0.1", entry);
			const result = ChangelogTransformer.transformContent(raw);

			expect(result).toContain("[#123]");
			expect(result).toContain("[#456]");
		}),
	);

	it.effect("preamble + sections preserved through pipeline", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine({
				id: "cs-8",
				summary: "Major overhaul of the system\n\n## Features\n\n- New architecture\n\n## Bug Fixes\n\n- Legacy compat",
				releases: [{ name: "pkg", type: "major" }],
				commit: "aaa1234567890",
			});

			const raw = assembleChangelog("2.0.0", entry);
			const result = ChangelogTransformer.transformContent(raw);

			expect(result).toContain("Major overhaul");
			expect(result).toContain("### Features");
			expect(result).toContain("### Bug Fixes");
			expect(result).toContain("New architecture");
			expect(result).toContain("Legacy compat");
		}),
	);

	// Pure — no Effect. Stays a plain `it()` inside the layer block.
	it("round-trips dependency table through lint → format → transform", () => {
		const changeset = `## Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| typescript | devDependency | updated | ^5.4.0 | ^5.6.0 |
| new-pkg | dependency | added | — | ^1.0.0 |
`;

		// Layer 1: lint validation
		const lintFile = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(DependencyTableFormatRule)
			.use(remarkStringify)
			.processSync(changeset);
		expect(lintFile.messages).toHaveLength(0);

		// Layer 3: transform (simulate changelog with version heading)
		const changelog = `## 1.0.0\n\n### Dependencies\n\n${changeset.split("\n\n").slice(1).join("\n\n")}`;
		const transformed = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(AggregateDependencyTablesPlugin)
			.use(remarkStringify)
			.processSync(changelog)
			.toString();

		expect(transformed).toContain("typescript");
		expect(transformed).toContain("new-pkg");
		// Should be sorted: added comes after updated
		const tsIdx = transformed.indexOf("typescript");
		const newIdx = transformed.indexOf("new-pkg");
		expect(tsIdx).toBeLessThan(newIdx);
	});
});
