/**
 * Golden-corpus e2e tests for the changelog renderer.
 *
 * Drives realistic changeset markdown through `getReleaseLine` /
 * `getDependencyReleaseLine` and the full transform preset
 * (`ChangelogTransformer.transformContent`), pinning the rendering defects
 * behind the broken silk 3.9.1 / 3.10.0 release notes:
 *
 * - changeset `###` sub-headings must survive as `####` (never bullet-wrapped)
 * - authored dependency tables must pass through as tables and merge with
 *   synthesized dependency release lines into ONE `### Dependencies` table
 * - attribution never lands inside a table cell; thanks aggregate into a
 *   `### Thanks` section (suppressed entirely by `thanks: false`)
 * - the transformer is idempotent over all of it
 */

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { ChangelogTransformer } from "../../src/changesets/api/transformer.js";
import { getDependencyReleaseLine } from "../../src/changesets/changelog/getDependencyReleaseLine.js";
import { getReleaseLine } from "../../src/changesets/changelog/getReleaseLine.js";
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

const testLayer = makeGitHubTest(new Map([["aaa1234567890", MOCK_ALICE]]));

const releaseLine = (summary: string, options: ChangesetOptions = OPTIONS) =>
	getReleaseLine(
		{
			id: "corpus",
			summary,
			releases: [{ name: "pkg", type: "minor" }],
			commit: "aaa1234567890",
		} satisfies NewChangesetWithCommit,
		"minor",
		options,
	);

const depLine = (options: ChangesetOptions = OPTIONS) =>
	getDependencyReleaseLine(
		[],
		[
			{
				name: "some-lib",
				type: "patch",
				oldVersion: "1.0.0",
				newVersion: "1.1.0",
				changesets: [],
				packageJson: { name: "some-lib", version: "1.1.0", dependencies: { "some-lib": "1.1.0" } },
				dir: "/packages/some-lib",
			},
		],
		options,
	);

function assemble(version: string, ...entries: string[]): string {
	return `## ${version}\n\n${entries.filter((e) => e.length > 0).join("\n\n")}\n`;
}

/** The Structured-tier shape from plugins/silk/skills/changeset-style/SKILL.md. */
const STRUCTURED_TIER = [
	"## Features",
	"",
	"### Hybrid Transformation Pipeline",
	"",
	"Replaces custom dependency resolution with `@pnpm/exportable-manifest` while maintaining RSLib-specific transformations.",
	"",
	"- Stage 1: Apply pnpm transformations",
	"- Stage 2: Apply RSLib transformations",
	"",
	"## Breaking Changes",
	"",
	"- Removed unused `transformer` option from `PackageJsonTransformPlugin`",
].join("\n");

const AUTHORED_DEP_TABLE = [
	"## Dependencies",
	"",
	"| Dependency | Type | Action | From | To |",
	"| --- | --- | --- | --- | --- |",
	"| effect | dependency | updated | 4.0.0 | 4.1.0 |",
].join("\n");

layer(testLayer)("changelog corpus", (it) => {
	it.effect("(a) structured-tier sub-heading survives as #### under ### Features", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine(STRUCTURED_TIER);

			// getReleaseLine output: never bullet-wrapped, promoted one level
			expect(entry).toContain("### Features");
			expect(entry).toContain("\n#### Hybrid Transformation Pipeline");
			expect(entry).not.toContain("- ###");
			expect(entry).not.toContain("  ###");

			const result = ChangelogTransformer.transformContent(assemble("2.0.0", entry));
			expect(result).toContain("### Features");
			expect(result).toContain("#### Hybrid Transformation Pipeline");
			expect(result).not.toContain("- ###");
			// category depth untouched: sub-heading did not become a category
			expect(result).not.toMatch(/^### Hybrid Transformation Pipeline$/m);
			// Breaking Changes reordered before Features
			expect(result.indexOf("### Breaking Changes")).toBeLessThan(result.indexOf("### Features"));
		}),
	);

	it.effect("(b) sub-heading mid-section is neither bulleted nor continuation-indented", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine("## Features\n\n- Added search\n\n### Configuration\n\n- New `mode` option");
			expect(entry).toMatch(/\n#### Configuration\n/);
			expect(entry).not.toContain("- #### Configuration");
			expect(entry).not.toContain("  #### Configuration");

			const result = ChangelogTransformer.transformContent(assemble("1.1.0", entry));
			expect(result).toContain("#### Configuration");
			expect(result).not.toContain("- #### Configuration");
		}),
	);

	it.effect("(c) authored dep table + synthesized dep line merge into one table, attribution outside", () =>
		Effect.gen(function* () {
			const authored = yield* releaseLine(AUTHORED_DEP_TABLE);
			const synthesized = yield* depLine();

			// the authored table must not be bullet-wrapped by the formatter
			// (remark-stringify pads table cells, so match structurally)
			expect(authored).toMatch(/\n\| Dependency \| Type\s+\| Action/);
			expect(authored).not.toMatch(/^\s*[-*] \|/m);

			const result = ChangelogTransformer.transformContent(assemble("3.10.0", authored, synthesized));

			const headings = result.match(/### Dependencies/g) ?? [];
			expect(headings).toHaveLength(1);
			const headerRows = result.match(/\| Dependency \|/g) ?? [];
			expect(headerRows).toHaveLength(1);
			expect(result).toMatch(/\| effect\s+\|/);
			expect(result).toMatch(/\| some-lib\s+\|/);

			// no bullet-wrapped table rows, no attribution inside any table cell
			expect(result).not.toMatch(/^\s*[-*] \|/m);
			for (const line of result.split("\n")) {
				if (line.trimStart().startsWith("|")) {
					expect(line).not.toContain("Thanks");
					expect(line).not.toContain("#10");
				}
			}
		}),
	);

	it.effect("(d) thanks: true yields a single ### Thanks section placed last", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine("## Features\n\n- Added search");
			const result = ChangelogTransformer.transformContent(assemble("1.1.0", entry));

			const thanksHeadings = result.match(/### Thanks/g) ?? [];
			expect(thanksHeadings).toHaveLength(1);
			expect(result).toContain("@alice");
			// no inline thanks left on the bullet
			expect(result).not.toMatch(/Added search.*Thanks/);
			// Thanks section is the last section heading in the block
			const lastHeading = [...result.matchAll(/^### .+$/gm)].at(-1);
			expect(lastHeading?.[0]).toBe("### Thanks");
		}),
	);

	it.effect("(d) thanks: false strips attribution everywhere", () =>
		Effect.gen(function* () {
			const opts: ChangesetOptions = { repo: "owner/repo", thanks: false };
			const entry = yield* releaseLine("## Features\n\n- Added search", opts);
			expect(entry).not.toContain("Thanks");
			expect(entry).not.toContain("@alice");

			const result = ChangelogTransformer.transformContent(assemble("1.1.0", entry), { thanks: false });
			expect(result).not.toContain("Thanks");
			expect(result).not.toContain("@alice");
		}),
	);

	it.effect("(e) transformer is idempotent over the full corpus", () =>
		Effect.gen(function* () {
			const structured = yield* releaseLine(STRUCTURED_TIER);
			const authored = yield* releaseLine(AUTHORED_DEP_TABLE);
			const synthesized = yield* depLine();
			const raw = assemble("2.0.0", structured, authored, synthesized);

			const once = ChangelogTransformer.transformContent(raw);
			const twice = ChangelogTransformer.transformContent(once);
			expect(twice).toBe(once);
		}),
	);

	it.effect("(f) code fence as first content node passes through as a block", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine("## Features\n\n```ts\nconst x = 1;\n```");
			expect(entry).toContain("```ts");
			expect(entry).toContain("const x = 1;");
			expect(entry).not.toContain("- ```");
			expect(entry).not.toContain("  ```");

			const result = ChangelogTransformer.transformContent(assemble("1.1.0", entry));
			expect(result).toContain("const x = 1;");
			expect(result).not.toContain("- ```");
		}),
	);

	it.effect("(f) canonical emit uses - bullets and keeps language-less fences fenced", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine("## Features\n\n- Added search\n\n```\npnpm add x\n```");
			const result = ChangelogTransformer.transformContent(assemble("1.1.0", entry));

			// Deliberate byte pins on the canonical emit boundary: the bullet
			// marker is `-` (the kit's canonical choice; remark-stringify
			// defaulted `*`) ...
			expect(result).toMatch(/^- Added search/m);
			expect(result).not.toMatch(/^\* /m);

			// ... and a language-less fence stays FENCED (the emit helper's
			// fence-normalization policy over the canonical indented default).
			expect(result).toContain("```\npnpm add x\n```");
			expect(result).not.toMatch(/^ {4}pnpm add x/m);
		}),
	);

	it.effect("(f) blockquote as first content node passes through as a block", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine("## Features\n\n> Deprecation notice: use `newApi` instead");
			expect(entry).toMatch(/^> Deprecation notice/m);
			expect(entry).not.toContain("- > Deprecation");

			const result = ChangelogTransformer.transformContent(assemble("1.1.0", entry));
			expect(result).toMatch(/^> Deprecation notice/m);
		}),
	);

	it.effect("normalize-format keeps a depth-3 section whose only lead content is a promoted #### sub-heading", () =>
		Effect.gen(function* () {
			const entry = yield* releaseLine("## Features\n\n### Sub-feature\n\n- Detail");
			const result = ChangelogTransformer.transformContent(assemble("1.1.0", entry));
			expect(result).toContain("### Features");
			expect(result).toContain("#### Sub-feature");
			expect(result).toContain("Detail");
		}),
	);
});
